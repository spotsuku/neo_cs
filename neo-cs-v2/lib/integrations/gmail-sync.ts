// Gmail 受信箱同期エンジン
//
// 流れ:
//   1. 全 user_gmail_connections を取得
//   2. 各 connection で access_token をリフレッシュ (有効期限切れなら)
//   3. Gmail API users.messages.list で 2026-03-01 以降のメッセージを取得 (初回時)
//      / last_sync_at 以降を取得 (継続時)
//   4. 既存メッセージは dedup でスキップ、新規は thread + message を保存
//   5. 受信メールは category=mail の通知を enqueue
//
// Gmail API のレート制限: 250 quota units/user/sec、1日 1,000,000 units
// list (5 units) + get (5 units) なのでメッセージ 100件で ~500 units
// → 1秒ペーシングで十分余裕
//
// エラーハンドリング:
//   - refresh_token revoked (invalid_grant) → connection.last_sync_status='error' で記録
//   - 個別メッセージ取得失敗 → スキップして次へ (バッチを止めない)

import "server-only";
import {
  gmailConnectionRepo,
  emailRepo,
  userNotificationRepo,
  DEFAULT_ORG_ID
} from "@/lib/repository/server";
import type { GmailConnection } from "@/lib/repository/server";
import { refreshAccessToken } from "./gmail-oauth";
import { enqueueNotification } from "@/lib/notifications/inbox";
import { getServiceClient } from "@/lib/supabase/server";
import { getLogger } from "@/lib/observability/logger";

// 初回同期で遡る最古日付 (Gmail 検索クエリ用 yyyy/mm/dd)
const INITIAL_SYNC_AFTER = "2026/03/01";
// 1 ユーザあたりの 1 回 cron で取得する最大件数 (時間内で完走させる)
const MAX_MESSAGES_PER_RUN = 200;

type GmailMessageListItem = { id: string; threadId: string };
type GmailHeader = { name: string; value: string };
type GmailPayload = {
  partId?: string;
  mimeType?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number };
  parts?: GmailPayload[];
};
type GmailMessageFull = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPayload;
};

export type SyncResult = {
  connectionId: string;
  emailAddress: string;
  fetched: number;
  inserted: number;
  skipped: number;
  notified: number;
  errors: string[];
};

// ─────────────────────────────────────────────
// Gmail API リクエストヘルパ
// ─────────────────────────────────────────────
async function getActiveAccessToken(conn: GmailConnection): Promise<string> {
  const now = new Date();
  const expiresAt = conn.accessTokenExpiresAt
    ? new Date(conn.accessTokenExpiresAt)
    : null;
  if (conn.accessToken && expiresAt && expiresAt.getTime() > now.getTime() + 60_000) {
    return conn.accessToken;
  }
  const refreshed = await refreshAccessToken(conn.refreshToken);
  await gmailConnectionRepo.updateSyncStatus(conn.userId, {
    accessToken: refreshed.accessToken,
    accessTokenExpiresAt: refreshed.accessTokenExpiresAt
  });
  return refreshed.accessToken;
}

async function gmailListMessages(
  accessToken: string,
  query: string,
  pageToken?: string
): Promise<{ messages: GmailMessageListItem[]; nextPageToken?: string }> {
  const params = new URLSearchParams({
    maxResults: "100",
    q: query
  });
  if (pageToken) params.set("pageToken", pageToken);
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`gmail.list ${res.status}: ${text}`);
  }
  const json = (await res.json()) as {
    messages?: GmailMessageListItem[];
    nextPageToken?: string;
  };
  return { messages: json.messages ?? [], nextPageToken: json.nextPageToken };
}

async function gmailGetMessage(
  accessToken: string,
  messageId: string
): Promise<GmailMessageFull> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`gmail.get ${res.status}: ${text}`);
  }
  return (await res.json()) as GmailMessageFull;
}

// ─────────────────────────────────────────────
// メッセージ payload を扱う純関数
// ─────────────────────────────────────────────
function decodeBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64").toString("utf-8");
}

function extractBody(payload: GmailPayload | undefined): string {
  if (!payload) return "";
  // text/plain を優先、無ければ text/html、最後にスニペット
  const visit = (p: GmailPayload, preferText: boolean): string | null => {
    if (p.body?.data) {
      const decoded = decodeBase64Url(p.body.data);
      if (preferText && p.mimeType === "text/plain") return decoded;
      if (!preferText && p.mimeType === "text/html") return decoded;
    }
    if (p.parts) {
      for (const part of p.parts) {
        const v = visit(part, preferText);
        if (v) return v;
      }
    }
    return null;
  };
  return visit(payload, true) ?? visit(payload, false) ?? "";
}

function getHeader(payload: GmailPayload | undefined, name: string): string | null {
  const h = payload?.headers?.find(
    (x) => x.name.toLowerCase() === name.toLowerCase()
  );
  return h?.value ?? null;
}

function parseEmailList(value: string | null): string[] {
  if (!value) return [];
  // "Name <a@b>, c@d" のような形式を簡易パース
  return value
    .split(",")
    .map((s) => {
      const m = s.match(/<([^>]+)>/);
      return (m ? m[1] : s).trim().toLowerCase();
    })
    .filter(Boolean);
}

function parseSenderEmail(fromHeader: string | null): string {
  if (!fromHeader) return "";
  const m = fromHeader.match(/<([^>]+)>/);
  return (m ? m[1] : fromHeader).trim().toLowerCase();
}

function buildGmailQuery(conn: GmailConnection): string {
  // 初回 (last_sync_at が無い): INITIAL_SYNC_AFTER 以降
  // 継続: last_sync_at の日付以降 (重複は dedup で吸収)
  // category:promotions / chats / forums を除外して通常メールのみ取得
  let afterDate: string;
  if (!conn.lastSyncAt) {
    afterDate = INITIAL_SYNC_AFTER;
  } else {
    const d = new Date(conn.lastSyncAt);
    // 1 日前から取り直して取りこぼし防止 (dedup で重複は弾く)
    d.setDate(d.getDate() - 1);
    afterDate = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  }
  return `after:${afterDate} -category:promotions -category:social -in:chats`;
}

// ─────────────────────────────────────────────
// 単一 connection の同期
// ─────────────────────────────────────────────
export async function syncConnection(
  conn: GmailConnection
): Promise<SyncResult> {
  const log = (await getLogger()).child({
    connectionId: conn.id,
    userId: conn.userId
  });
  const result: SyncResult = {
    connectionId: conn.id,
    emailAddress: conn.emailAddress,
    fetched: 0,
    inserted: 0,
    skipped: 0,
    notified: 0,
    errors: []
  };

  let accessToken: string;
  try {
    accessToken = await getActiveAccessToken(conn);
  } catch (e) {
    const msg = (e as Error).message;
    log.error({ kind: "token_refresh_failed", message: msg });
    await gmailConnectionRepo.updateSyncStatus(conn.userId, {
      lastSyncAt: new Date().toISOString(),
      lastSyncStatus: "error",
      lastSyncNote: `token_refresh: ${msg.slice(0, 200)}`
    });
    result.errors.push(`token_refresh: ${msg}`);
    return result;
  }

  // 1. message list を取得 (ページング、上限 MAX_MESSAGES_PER_RUN)
  const query = buildGmailQuery(conn);
  const messageIds: GmailMessageListItem[] = [];
  let pageToken: string | undefined = undefined;
  while (messageIds.length < MAX_MESSAGES_PER_RUN) {
    const page: { messages: GmailMessageListItem[]; nextPageToken?: string } =
      await gmailListMessages(accessToken, query, pageToken).catch((e) => {
        log.error({ kind: "list_failed", message: (e as Error).message });
        result.errors.push(`list: ${(e as Error).message}`);
        return { messages: [] as GmailMessageListItem[], nextPageToken: undefined };
      });
    messageIds.push(...page.messages);
    if (!page.nextPageToken) break;
    pageToken = page.nextPageToken;
  }
  result.fetched = messageIds.length;

  // 2. 各メッセージを詳細取得 + 保存
  const sb = getServiceClient();
  for (const { id } of messageIds.slice(0, MAX_MESSAGES_PER_RUN)) {
    // 既に保存済みかチェック (gmail_message_id でユニーク)
    const { data: existing } = await sb
      .from("email_messages")
      .select("id")
      .eq("gmail_message_id", id)
      .maybeSingle();
    if (existing) {
      result.skipped++;
      continue;
    }

    let full: GmailMessageFull;
    try {
      full = await gmailGetMessage(accessToken, id);
    } catch (e) {
      result.errors.push(`get ${id}: ${(e as Error).message}`);
      continue;
    }

    const subject = getHeader(full.payload, "Subject") ?? "(件名なし)";
    const fromHeader = getHeader(full.payload, "From");
    const toHeader = getHeader(full.payload, "To");
    const ccHeader = getHeader(full.payload, "Cc");
    const senderEmail = parseSenderEmail(fromHeader);
    const recipients = [...parseEmailList(toHeader), ...parseEmailList(ccHeader)];
    const sentAt = full.internalDate
      ? new Date(Number(full.internalDate)).toISOString()
      : new Date().toISOString();
    const body = extractBody(full.payload) || full.snippet || "";

    // direction: 自分宛なら inbound、自分が送信者なら outbound
    const myEmailLower = conn.emailAddress.toLowerCase();
    const direction: "inbound" | "outbound" =
      senderEmail === myEmailLower ? "outbound" : "inbound";

    // 会社解決 (送信元アドレス → company_contacts)
    const lookupEmail = direction === "inbound" ? senderEmail : recipients[0] ?? "";
    const companyId = lookupEmail
      ? await emailRepo.findCompanyByEmail(conn.organizationId, lookupEmail)
      : null;

    const thread = await emailRepo
      .upsertThreadByGmailId({
        organizationId: conn.organizationId,
        gmailThreadId: full.threadId,
        subject,
        companyId: companyId ?? undefined,
        assigneeUserId: conn.userId,
        lastInboundAt: direction === "inbound" ? sentAt : undefined,
        lastOutboundAt: direction === "outbound" ? sentAt : undefined
      })
      .catch((e) => {
        result.errors.push(`upsertThread ${id}: ${(e as Error).message}`);
        return null;
      });
    if (!thread) continue;

    await emailRepo
      .insertMessageByGmailId({
        threadId: thread.id,
        gmailMessageId: id,
        direction,
        body: body.slice(0, 50_000), // 異常に長いメールを切り詰め
        senderEmail,
        recipientEmails: recipients,
        sentAt
      })
      .catch((e) => {
        result.errors.push(`insertMessage ${id}: ${(e as Error).message}`);
      });
    result.inserted++;

    // 受信メールのみ通知 (自分が送ったメールは通知しない)
    if (direction === "inbound") {
      await enqueueNotification({
        organizationId: conn.organizationId,
        userId: conn.userId,
        category: "mail",
        title: `新着メール: ${subject.slice(0, 60)}`,
        body: `From ${senderEmail}`,
        linkHref: companyId
          ? `/companies/${companyId}`
          : `/inbox`,
        relatedCompanyId: companyId ?? undefined,
        sourceType: "email_message",
        sourceId: id
      });
      result.notified++;
    }
  }

  // 3. 同期完了をマーク
  await gmailConnectionRepo.updateSyncStatus(conn.userId, {
    lastSyncAt: new Date().toISOString(),
    lastSyncStatus: result.errors.length > 0 ? "warning" : "success",
    lastSyncNote:
      result.errors.length > 0
        ? `${result.inserted} inserted, ${result.errors.length} errors`
        : `${result.inserted} inserted, ${result.skipped} skipped`
  });
  log.info({
    kind: "sync_done",
    fetched: result.fetched,
    inserted: result.inserted,
    skipped: result.skipped,
    notified: result.notified,
    errors: result.errors.length
  });
  return result;
}

// ─────────────────────────────────────────────
// 全 connection を同期
// ─────────────────────────────────────────────
export async function syncAllConnections(): Promise<{
  total: number;
  results: SyncResult[];
}> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("user_gmail_connections")
    .select("*")
    .order("last_sync_at", { ascending: true, nullsFirst: true });
  if (error) throw new Error(`list_connections: ${error.message}`);
  const rows = (data ?? []) as {
    id: string;
    organization_id: string;
    user_id: string;
    email_address: string;
    refresh_token: string;
    access_token: string | null;
    access_token_expires_at: string | null;
    granted_scopes: string;
    connected_at: string;
    last_sync_at: string | null;
    last_sync_status: GmailConnection["lastSyncStatus"] | null;
    last_sync_note: string | null;
  }[];
  const connections: GmailConnection[] = rows.map((r) => ({
    id: r.id,
    organizationId: r.organization_id ?? DEFAULT_ORG_ID,
    userId: r.user_id,
    emailAddress: r.email_address,
    refreshToken: r.refresh_token,
    accessToken: r.access_token ?? undefined,
    accessTokenExpiresAt: r.access_token_expires_at ?? undefined,
    grantedScopes: r.granted_scopes,
    connectedAt: r.connected_at,
    lastSyncAt: r.last_sync_at ?? undefined,
    lastSyncStatus: r.last_sync_status ?? undefined,
    lastSyncNote: r.last_sync_note ?? undefined
  }));

  const results: SyncResult[] = [];
  for (const conn of connections) {
    const r = await syncConnection(conn).catch((e) => ({
      connectionId: conn.id,
      emailAddress: conn.emailAddress,
      fetched: 0,
      inserted: 0,
      skipped: 0,
      notified: 0,
      errors: [(e as Error).message]
    }));
    results.push(r);
  }
  return { total: connections.length, results };
}
