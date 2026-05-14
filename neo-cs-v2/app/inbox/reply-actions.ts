"use server";

import { revalidatePath } from "next/cache";
import { userRepo } from "@/lib/repository/server";
import { sendReply } from "@/lib/integrations/gmail-send";
import { getServiceClient } from "@/lib/supabase/server";

export type SendReplyInput = {
  inReplyToMessageId: string;
  body: string;
  subject?: string;
  /** 確認ダイアログで OK したことの client 側証跡。クライアントから "yes" を渡す */
  confirmed: boolean;
};

export type ReplyPreview = {
  ok: boolean;
  reason?: string;
  to?: string[];
  cc?: string[];
  subject?: string;
};

/**
 * 送信前の確認ダイアログに表示するための「宛先・件名」を返す。
 * このアクションは送信を行わない（純粋な情報取得）。
 */
export async function getReplyPreviewAction(
  inReplyToMessageId: string
): Promise<ReplyPreview> {
  const me = await userRepo.getCurrent();
  if (!me?.id) return { ok: false, reason: "not_authenticated" };
  const sb = getServiceClient();
  const { data: msg } = await sb
    .from("email_messages")
    .select("thread_id, sender_email, recipient_emails")
    .eq("id", inReplyToMessageId)
    .maybeSingle();
  if (!msg) return { ok: false, reason: "source_not_found" };
  const m = msg as {
    thread_id: string;
    sender_email: string;
    recipient_emails: string[] | null;
  };
  const { data: thread } = await sb
    .from("email_threads")
    .select("subject")
    .eq("id", m.thread_id)
    .maybeSingle();
  const tg = thread as { subject: string } | null;
  const { data: connRow } = await sb
    .from("user_gmail_connections")
    .select("email_address")
    .eq("user_id", me.id)
    .maybeSingle();
  const myEmail = (connRow as { email_address: string } | null)?.email_address ?? "";
  const cc = (m.recipient_emails ?? []).filter(
    (r) => r && r.toLowerCase() !== myEmail.toLowerCase()
  );
  const baseSubject = tg?.subject ?? "";
  return {
    ok: true,
    to: [m.sender_email],
    cc,
    subject: baseSubject.startsWith("Re:") ? baseSubject : `Re: ${baseSubject}`
  };
}

export async function sendReplyAction(
  input: SendReplyInput
): Promise<{ ok: boolean; messageId?: string; reason?: string }> {
  const me = await userRepo.getCurrent();
  if (!me?.id) return { ok: false, reason: "not_authenticated" };
  if (!input.confirmed) return { ok: false, reason: "not_confirmed" };
  if (!input.body || input.body.trim().length === 0) {
    return { ok: false, reason: "empty_body" };
  }
  const result = await sendReply({
    inReplyToMessageId: input.inReplyToMessageId,
    senderUserId: me.id,
    body: input.body,
    subject: input.subject
  });
  if (result.ok) {
    revalidatePath("/inbox");
  }
  return result;
}
