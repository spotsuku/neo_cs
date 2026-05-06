// Email スレッド / メッセージ Supabase リポジトリ
// マイグレーション: supabase/migrations/0031_email.sql
//
// write 系 (createMessage / setStatus / setAssignee) は runAfterWrite で
// audit_logs に流す。listThreads / getThread / listMessages は読み取りのみ。

import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import type {
  EmailRepo,
  EmailThread,
  EmailMessage,
  EmailMessageCreateInput,
  EmailThreadStatus,
  EmailAssigneeReason
} from "../types";

type ThreadRow = {
  id: string;
  organization_id: string;
  company_id: string | null;
  subject: string;
  status: EmailThreadStatus;
  assignee_user_id: string | null;
  assignee_reason: EmailAssigneeReason | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  thread_id: string;
  direction: "inbound" | "outbound";
  body: string;
  sender_email: string;
  recipient_emails: string[] | null;
  sent_at: string;
  ai_summary: string | null;
  created_at: string;
};

function toThread(r: ThreadRow): EmailThread {
  return {
    id: r.id,
    organizationId: r.organization_id,
    companyId: r.company_id ?? undefined,
    subject: r.subject,
    status: r.status,
    assigneeUserId: r.assignee_user_id ?? undefined,
    assigneeReason: r.assignee_reason ?? undefined,
    lastInboundAt: r.last_inbound_at ?? undefined,
    lastOutboundAt: r.last_outbound_at ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

function toMessage(r: MessageRow): EmailMessage {
  return {
    id: r.id,
    threadId: r.thread_id,
    direction: r.direction,
    body: r.body,
    senderEmail: r.sender_email,
    recipientEmails: r.recipient_emails ?? [],
    sentAt: r.sent_at,
    aiSummary: r.ai_summary ?? undefined,
    createdAt: r.created_at
  };
}

function genMessageId(): string {
  // text PK のため UUID 風文字列を生成
  return `em-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const supabaseEmailRepo: EmailRepo = {
  async listThreads(opts) {
    const sb = getServiceClient();
    let q = sb.from("email_threads").select("*");
    if (opts?.organizationId) q = q.eq("organization_id", opts.organizationId);
    if (opts?.companyId) q = q.eq("company_id", opts.companyId);
    const { data, error } = await q.order("updated_at", { ascending: false });
    if (error) throw new Error(`email_threads.list: ${error.message}`);
    return (data ?? []).map((r) => toThread(r as ThreadRow));
  },

  async getThread(id) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("email_threads")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`email_threads.get: ${error.message}`);
    return data ? toThread(data as ThreadRow) : null;
  },

  async listMessages(threadId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("email_messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("sent_at", { ascending: true });
    if (error) throw new Error(`email_messages.list: ${error.message}`);
    return (data ?? []).map((r) => toMessage(r as MessageRow));
  },

  async createMessage(input: EmailMessageCreateInput) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const id = input.id ?? genMessageId();
    const sentAt = input.sentAt ?? new Date().toISOString();
    const { data, error } = await sb
      .from("email_messages")
      .insert({
        id,
        thread_id: input.threadId,
        direction: input.direction,
        body: input.body,
        sender_email: input.senderEmail,
        recipient_emails: input.recipientEmails ?? [],
        sent_at: sentAt,
        ai_summary: input.aiSummary ?? null
      })
      .select("*")
      .single();
    if (error) throw new Error(`email_messages.insert: ${error.message}`);
    const msg = toMessage(data as MessageRow);

    // 親スレッドの last_*_at / updated_at を更新
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.direction === "inbound") patch.last_inbound_at = sentAt;
    else patch.last_outbound_at = sentAt;
    const { error: tErr } = await sb
      .from("email_threads")
      .update(patch)
      .eq("id", input.threadId);
    if (tErr) throw new Error(`email_threads.touch: ${tErr.message}`);

    await runAfterWrite({
      entityType: "email_messages",
      entityId: msg.id,
      after: msg,
      action: "create",
      ctx
    });
    return msg;
  },

  async setStatus(threadId, status: EmailThreadStatus) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb
      .from("email_threads")
      .select("*")
      .eq("id", threadId)
      .maybeSingle();
    const { data, error } = await sb
      .from("email_threads")
      .update({ status })
      .eq("id", threadId)
      .select("*")
      .single();
    if (error) throw new Error(`email_threads.setStatus: ${error.message}`);
    await runAfterWrite({
      entityType: "email_threads",
      entityId: threadId,
      before: before ? toThread(before as ThreadRow) : undefined,
      after: toThread(data as ThreadRow),
      action: "update",
      ctx
    });
  },

  async setAssignee(threadId, userId, reason: EmailAssigneeReason) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb
      .from("email_threads")
      .select("*")
      .eq("id", threadId)
      .maybeSingle();
    const { data, error } = await sb
      .from("email_threads")
      .update({ assignee_user_id: userId, assignee_reason: reason })
      .eq("id", threadId)
      .select("*")
      .single();
    if (error) throw new Error(`email_threads.setAssignee: ${error.message}`);
    await runAfterWrite({
      entityType: "email_threads",
      entityId: threadId,
      before: before ? toThread(before as ThreadRow) : undefined,
      after: toThread(data as ThreadRow),
      action: "update",
      ctx
    });
  }
};
