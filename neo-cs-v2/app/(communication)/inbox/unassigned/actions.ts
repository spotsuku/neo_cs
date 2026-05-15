"use server";

// 未割当スレッド (companyId = null) の手動アサイン Server Action (F3)
//
// Gmail 同期で email_domains / company_contacts.email 解決に失敗したスレッドを
// 後から人手で正しい企業に紐付けるための薄いアクション。
// emailRepo.setCompany() をラップし、audit_logs に流れる。

import { revalidatePath } from "next/cache";
import { emailRepo, companyRepo } from "@/lib/repository/server";
import { getPermissionContext } from "@/lib/auth/server";
import { DEFAULT_ORG_ID } from "@/lib/repository/types";
import { suggestCompanyForThread } from "@/lib/integrations/email-ai";

export type AssignThreadCompanyResult =
  | { ok: true }
  | { ok: false; message: string };

export async function assignThreadCompanyAction(
  threadId: string,
  companyId: string
): Promise<AssignThreadCompanyResult> {
  const tid = threadId.trim();
  const cid = companyId.trim();
  if (!tid) return { ok: false, message: "threadId が空です" };
  if (!cid) return { ok: false, message: "企業を選択してください" };

  try {
    await emailRepo.setCompany(tid, cid);
    revalidatePath("/inbox/unassigned");
    revalidatePath("/inbox");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

// ─────────────────────────────────────────────
// AI 企業候補提示 (on-demand)
// ─────────────────────────────────────────────
export type SuggestCompanyForThreadResult =
  | {
      ok: true;
      suggestion: {
        companyId: string | null;
        companyName?: string;
        confidence: number;
        reasoning: string;
      };
    }
  | { ok: false; message: string };

export async function suggestCompanyForThreadAction(
  threadId: string
): Promise<SuggestCompanyForThreadResult> {
  const tid = threadId.trim();
  if (!tid) return { ok: false, message: "threadId が空です" };

  try {
    const ctx = await getPermissionContext();
    const orgId = ctx.actor?.organizationId ?? DEFAULT_ORG_ID;

    const thread = await emailRepo.getThread(tid);
    if (!thread) return { ok: false, message: "スレッドが見つかりません" };

    const [messages, companies] = await Promise.all([
      emailRepo.listMessages(tid),
      companyRepo.list()
    ]);

    // 直近 N 件 (= 3) の本文を結合 (古い順)
    const recent = messages.slice(-3);
    const combinedBody = recent
      .map((m) => `[${m.direction} @ ${m.sentAt}]\n${m.body}`)
      .join("\n\n---\n\n");
    const latest = recent[recent.length - 1];
    const senderEmail = latest?.senderEmail ?? "";
    const recipients = latest?.recipientEmails ?? [];

    const suggestion = await suggestCompanyForThread({
      organizationId: orgId,
      threadId: tid,
      subject: thread.subject,
      body: combinedBody,
      senderEmail,
      recipients,
      companies: companies.map((c) => ({ id: c.id, name: c.name }))
    });

    const matched = suggestion.companyId
      ? companies.find((c) => c.id === suggestion.companyId)
      : undefined;

    return {
      ok: true,
      suggestion: {
        companyId: suggestion.companyId,
        companyName: matched?.name,
        confidence: suggestion.confidence,
        reasoning: suggestion.reasoning
      }
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
