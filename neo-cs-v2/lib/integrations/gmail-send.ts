// Gmail からメール送信 (返信)
//
// 役割:
//   - NEO CS の /inbox から返信を送る際に呼ばれる
//   - 接続済み Gmail の access_token を refresh して
//     Gmail API users.messages.send を叩く
//   - 元メッセージ (Message-ID / References) を引き継ぎスレッドとして送信
//   - 送信成功時は email_messages に direction='outbound' で記録
//   - email_threads.last_outbound_at と status を更新
//
// 送信内容の安全要件:
//   - 件名・本文は html ではなく plain text (text/plain) で送る
//   - To / Cc は受信メッセージから引き継ぎ (送信者を To に追加)
//   - サイズ上限なし (Gmail 側で 25MB)

import "server-only";
import {
  gmailConnectionRepo,
  userRepo,
  emailRepo,
  auditLogRepo,
  type EmailMessage,
  DEFAULT_ORG_ID
} from "@/lib/repository/server";
import { refreshAccessToken } from "./gmail-oauth";
import { getServiceClient } from "@/lib/supabase/server";
import { getLogger } from "@/lib/observability/logger";

const GMAIL_SEND_API = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

export type ReplyInput = {
  /** 返信元の email_messages.id (NEO CS 側 ID) */
  inReplyToMessageId: string;
  /** 送信者ユーザ (Gmail 接続済みの app_users.id) */
  senderUserId: string;
  /** 件名 (省略時は元メッセージの "Re: <subject>") */
  subject?: string;
  /** 本文 (text/plain) */
  body: string;
  /** To を上書き (省略時は元メッセージの送信者) */
  to?: string[];
  /** Cc を上書き (省略時は元メッセージの Cc) */
  cc?: string[];
};

export type ReplyResult = {
  ok: boolean;
  messageId?: string;
  threadId?: string;
  reason?: string;
};

function utf8Base64Url(s: string): string {
  return Buffer.from(s, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function encodeRfc2047(value: string): string {
  // 非 ASCII を含むヘッダ値を MIME encoded-word (UTF-8 / Base64) で包む
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7f]*$/.test(value)) return value;
  return `=?utf-8?B?${Buffer.from(value, "utf-8").toString("base64")}?=`;
}

function formatAddressList(addrs: string[]): string {
  return addrs.filter(Boolean).join(", ");
}

export async function sendReply(input: ReplyInput): Promise<ReplyResult> {
  const log = (await getLogger()).child({
    integration: "gmail-send",
    userId: input.senderUserId,
    inReplyTo: input.inReplyToMessageId
  });

  // ⚠ 安全ガード: 認証済み HTTP セッションからのみ送信を許可。
  // これにより cron / AI 抽出 / バックグラウンドジョブ等から「勝手に」呼ばれても弾く。
  // userRepo.getCurrent() は HTTP リクエストの Supabase セッション cookie を読むため、
  // cron route (CRON_SECRET 認証のみ) からは null が返り、自動的に拒否される。
  const me = await userRepo.getCurrent().catch(() => null);
  if (!me?.id) {
    log.error({ kind: "send_blocked", reason: "no_user_session" });
    return { ok: false, reason: "no_user_session" };
  }
  if (me.id !== input.senderUserId) {
    log.error({
      kind: "send_blocked",
      reason: "user_mismatch",
      sessionUserId: me.id
    });
    return { ok: false, reason: "user_mismatch" };
  }
  // kill switch (env で一発無効化)
  if (process.env.NEO_CS_DISABLE_GMAIL_SEND === "true") {
    log.warn({ kind: "send_blocked", reason: "kill_switch" });
    return { ok: false, reason: "send_disabled" };
  }

  // 1. 接続情報を取得 + access_token 更新
  const conn = await gmailConnectionRepo.getByUserId(input.senderUserId);
  if (!conn) return { ok: false, reason: "no_connection" };
  if (!conn.grantedScopes.includes("gmail.send")) {
    return { ok: false, reason: "scope_missing" };
  }
  let accessToken = conn.accessToken;
  const now = new Date();
  const exp = conn.accessTokenExpiresAt ? new Date(conn.accessTokenExpiresAt) : null;
  if (!accessToken || !exp || exp.getTime() < now.getTime() + 60_000) {
    const r = await refreshAccessToken(conn.refreshToken).catch((e) => {
      log.error({ kind: "token_refresh_failed", message: (e as Error).message });
      return null;
    });
    if (!r) return { ok: false, reason: "token_refresh_failed" };
    accessToken = r.accessToken;
    await gmailConnectionRepo.updateSyncStatus(input.senderUserId, {
      accessToken: r.accessToken,
      accessTokenExpiresAt: r.accessTokenExpiresAt
    });
  }

  // 2. 元メッセージとスレッドを引く
  const sb = getServiceClient();
  const { data: srcRow } = await sb
    .from("email_messages")
    .select("*")
    .eq("id", input.inReplyToMessageId)
    .maybeSingle();
  if (!srcRow) return { ok: false, reason: "source_message_not_found" };
  const src = srcRow as {
    id: string;
    thread_id: string;
    sender_email: string;
    recipient_emails: string[] | null;
    gmail_message_id: string | null;
  };
  const { data: threadRow } = await sb
    .from("email_threads")
    .select("*")
    .eq("id", src.thread_id)
    .maybeSingle();
  if (!threadRow) return { ok: false, reason: "thread_not_found" };
  const thread = threadRow as {
    id: string;
    subject: string;
    gmail_thread_id: string | null;
  };

  // 3. ヘッダ組み立て + RFC822 メッセージを base64url
  const toAddrs = input.to ?? [src.sender_email];
  const ccAddrs = input.cc ?? (src.recipient_emails ?? []).filter((r) =>
    r && r.toLowerCase() !== conn.emailAddress.toLowerCase()
  );
  const subject =
    input.subject ??
    (thread.subject.startsWith("Re:") ? thread.subject : `Re: ${thread.subject}`);

  const headers: string[] = [
    `From: ${conn.emailAddress}`,
    `To: ${formatAddressList(toAddrs)}`
  ];
  if (ccAddrs.length > 0) headers.push(`Cc: ${formatAddressList(ccAddrs)}`);
  headers.push(`Subject: ${encodeRfc2047(subject)}`);
  if (src.gmail_message_id) {
    // Gmail message id を In-Reply-To にそのまま入れる
    headers.push(`In-Reply-To: <${src.gmail_message_id}@mail.gmail.com>`);
    headers.push(`References: <${src.gmail_message_id}@mail.gmail.com>`);
  }
  headers.push(`MIME-Version: 1.0`);
  headers.push(`Content-Type: text/plain; charset="UTF-8"`);
  headers.push(`Content-Transfer-Encoding: base64`);

  const bodyB64 = Buffer.from(input.body, "utf-8").toString("base64");
  const raw = `${headers.join("\r\n")}\r\n\r\n${bodyB64}`;
  const rawB64Url = utf8Base64Url(raw);

  // 4. 送信
  const res = await fetch(GMAIL_SEND_API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      raw: rawB64Url,
      threadId: thread.gmail_thread_id ?? undefined
    })
  });
  if (!res.ok) {
    const text = await res.text();
    log.error({ kind: "send_failed", status: res.status, body: text.slice(0, 500) });
    return { ok: false, reason: `http_${res.status}` };
  }
  const sent = (await res.json()) as { id: string; threadId: string };

  // 5. NEO CS 側にも outbound として保存
  await emailRepo
    .insertMessageByGmailId({
      threadId: thread.id,
      gmailMessageId: sent.id,
      direction: "outbound",
      body: input.body,
      senderEmail: conn.emailAddress,
      recipientEmails: [...toAddrs, ...ccAddrs],
      sentAt: new Date().toISOString()
    })
    .catch((e) => {
      log.warn({ kind: "local_save_failed", message: (e as Error).message });
    });

  // 6. スレッドの status は "replied" に
  await emailRepo
    .setStatus(thread.id, "replied")
    .catch(() => undefined);

  // 7. 監査ログ (誰が・いつ・どのスレッドに・宛先) — 不正/予期せぬ送信の発見用
  await auditLogRepo
    .append({
      organizationId: conn.organizationId ?? DEFAULT_ORG_ID,
      actorUserId: input.senderUserId,
      action: "create",
      targetTable: "email_messages",
      targetId: sent.id,
      afterData: {
        kind: "email_send",
        thread_id: thread.id,
        to: toAddrs,
        cc: ccAddrs,
        subject,
        gmail_message_id: sent.id
      }
    })
    .catch((e) => log.warn({ kind: "audit_failed", message: (e as Error).message }));

  log.info({ kind: "sent", gmail_message_id: sent.id });
  return { ok: true, messageId: sent.id, threadId: sent.threadId };
}

/** UI から呼ぶ際に「返信可能か (scope OK か)」を判定するためのヘルパ */
export async function canReplyAsUser(userId: string): Promise<boolean> {
  const conn = await gmailConnectionRepo.getByUserId(userId);
  return Boolean(conn?.grantedScopes.includes("gmail.send"));
}

// EmailMessage 型を re-export (UI から使いやすいよう)
export type { EmailMessage };
