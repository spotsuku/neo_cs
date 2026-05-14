// Email スレッド / メッセージ mock 実装
//
// lib/mock/email.ts の emailThreads / emailMessages を Repo 型に橋渡しする。
// in-memory ストアに正規化済みデータを格納し、createMessage / setStatus /
// setAssignee で更新できる。assigneeUserId は mock では人名文字列を入れる
// (app_users.id 解決前のフォールバックとして許容)。

import type {
  EmailRepo,
  EmailThread,
  EmailMessage,
  EmailMessageCreateInput,
  EmailThreadStatus,
  EmailAssigneeReason,
  GmailThreadUpsertInput,
  GmailMessageInsertInput
} from "../types";
import { DEFAULT_ORG_ID } from "../types";
import {
  emailThreads as seedThreads,
  emailMessages as seedMessages
} from "@/lib/mock/email";
import { useGlobalStore } from "./_global-store";

// 互換用: mock の "古野" 等の名前を擬似 user_id として使う。本番 supabase 実装では
// app_users.id (uuid) が入る。
function seedThreadsToRepo(): EmailThread[] {
  return seedThreads.map((t) => {
    // sentAt 由来で last_inbound_at / last_outbound_at を最大値で算出
    const msgs = seedMessages.filter((m) => m.threadId === t.id);
    const lastInbound = msgs
      .filter((m) => m.direction === "inbound")
      .map((m) => m.sentAt)
      .sort()
      .at(-1);
    const lastOutbound = msgs
      .filter((m) => m.direction === "outbound")
      .map((m) => m.sentAt)
      .sort()
      .at(-1);
    return {
      id: t.id,
      organizationId: DEFAULT_ORG_ID,
      companyId: t.companyId,
      subject: t.subject,
      status: t.status,
      assigneeUserId: t.assignee,
      assigneeReason: t.assigneeReason,
      lastInboundAt: lastInbound,
      lastOutboundAt: lastOutbound,
      createdAt: t.lastMessageAt,
      updatedAt: t.lastMessageAt
    };
  });
}

function seedMessagesToRepo(): EmailMessage[] {
  return seedMessages.map((m) => ({
    id: m.id,
    threadId: m.threadId,
    direction: m.direction,
    body: m.body,
    senderEmail: m.from,
    recipientEmails: [...(m.to ?? []), ...(m.cc ?? [])],
    sentAt: m.sentAt,
    aiSummary: undefined,
    createdAt: m.sentAt
  }));
}

const threadStore = useGlobalStore<EmailThread[]>(
  "__emailThreadStore",
  seedThreadsToRepo
);
const messageStore = useGlobalStore<EmailMessage[]>(
  "__emailMessageStore",
  seedMessagesToRepo
);

let messageCounter = messageStore.length;

function genId(prefix: string): string {
  messageCounter += 1;
  return `${prefix}-mock-${messageCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

export const mockEmailRepo: EmailRepo = {
  async listThreads(opts) {
    let rows = threadStore.slice();
    if (opts?.organizationId) {
      rows = rows.filter((t) => t.organizationId === opts.organizationId);
    }
    if (opts?.companyId) {
      rows = rows.filter((t) => t.companyId === opts.companyId);
    }
    return rows
      .slice()
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .map((t) => ({ ...t }));
  },

  async getThread(id) {
    const t = threadStore.find((x) => x.id === id);
    return t ? { ...t } : null;
  },

  async listMessages(threadId) {
    return messageStore
      .filter((m) => m.threadId === threadId)
      .slice()
      .sort((a, b) => (a.sentAt < b.sentAt ? -1 : 1))
      .map((m) => ({ ...m }));
  },

  async createMessage(input: EmailMessageCreateInput) {
    const now = new Date().toISOString();
    const sentAt = input.sentAt ?? now;
    const msg: EmailMessage = {
      id: input.id ?? genId("em"),
      threadId: input.threadId,
      direction: input.direction,
      body: input.body,
      senderEmail: input.senderEmail,
      recipientEmails: input.recipientEmails ?? [],
      sentAt,
      aiSummary: input.aiSummary,
      createdAt: now
    };
    messageStore.push(msg);

    // スレッドの last_*_at / updated_at を更新
    const idx = threadStore.findIndex((t) => t.id === input.threadId);
    if (idx >= 0) {
      const t = threadStore[idx];
      threadStore[idx] = {
        ...t,
        lastInboundAt: input.direction === "inbound" ? sentAt : t.lastInboundAt,
        lastOutboundAt: input.direction === "outbound" ? sentAt : t.lastOutboundAt,
        updatedAt: now
      };
    }
    return { ...msg };
  },

  async setStatus(threadId, status: EmailThreadStatus) {
    const idx = threadStore.findIndex((t) => t.id === threadId);
    if (idx < 0) return;
    threadStore[idx] = {
      ...threadStore[idx],
      status,
      updatedAt: new Date().toISOString()
    };
  },

  async setAssignee(threadId, userId, reason: EmailAssigneeReason) {
    const idx = threadStore.findIndex((t) => t.id === threadId);
    if (idx < 0) return;
    threadStore[idx] = {
      ...threadStore[idx],
      assigneeUserId: userId,
      assigneeReason: reason,
      updatedAt: new Date().toISOString()
    };
  },

  // ─────────────────────────────────────────────
  // Gmail 同期向け (in-memory dedup)
  // ─────────────────────────────────────────────
  async upsertThreadByGmailId(input: GmailThreadUpsertInput) {
    const existing = threadStore.find(
      (t) =>
        t.organizationId === input.organizationId &&
        (t as EmailThread & { gmailThreadId?: string }).gmailThreadId === input.gmailThreadId
    );
    if (existing) {
      // last_*_at だけ追従
      const idx = threadStore.indexOf(existing);
      threadStore[idx] = {
        ...existing,
        lastInboundAt: input.lastInboundAt ?? existing.lastInboundAt,
        lastOutboundAt: input.lastOutboundAt ?? existing.lastOutboundAt,
        updatedAt: new Date().toISOString()
      };
      return { ...threadStore[idx] };
    }
    const now = new Date().toISOString();
    const created: EmailThread & { gmailThreadId: string } = {
      id: `et-gm-${input.gmailThreadId}`,
      organizationId: input.organizationId,
      companyId: input.companyId,
      subject: input.subject,
      status: "new",
      assigneeUserId: input.assigneeUserId,
      assigneeReason: input.assigneeUserId ? "received" : undefined,
      lastInboundAt: input.lastInboundAt,
      lastOutboundAt: input.lastOutboundAt,
      createdAt: now,
      updatedAt: now,
      gmailThreadId: input.gmailThreadId
    };
    threadStore.push(created);
    return { ...created };
  },

  async insertMessageByGmailId(input: GmailMessageInsertInput) {
    const existing = messageStore.find(
      (m) =>
        (m as EmailMessage & { gmailMessageId?: string }).gmailMessageId === input.gmailMessageId
    );
    if (existing) return { ...existing };
    const now = new Date().toISOString();
    const msg: EmailMessage & { gmailMessageId: string } = {
      id: `em-gm-${input.gmailMessageId}`,
      threadId: input.threadId,
      direction: input.direction,
      body: input.body,
      senderEmail: input.senderEmail,
      recipientEmails: input.recipientEmails,
      sentAt: input.sentAt,
      aiSummary: undefined,
      createdAt: now,
      gmailMessageId: input.gmailMessageId
    };
    messageStore.push(msg);
    return { ...msg };
  },

  async findCompanyByEmail(_organizationId, _email) {
    // mock: company_contacts は別 store に分かれているので簡易に null 返却。
    // Supabase 実装側でちゃんと探す。
    return null;
  }
};
