"use server";

// 未割当スレッド (companyId = null) の手動アサイン Server Action (F3)
//
// Gmail 同期で email_domains / company_contacts.email 解決に失敗したスレッドを
// 後から人手で正しい企業に紐付けるための薄いアクション。
// emailRepo.setCompany() をラップし、audit_logs に流れる。

import { revalidatePath } from "next/cache";
import {
  emailRepo,
  companyRepo,
  aiExtractionRepo
} from "@/lib/repository/server";
import { getPermissionContext } from "@/lib/auth/server";
import { DEFAULT_ORG_ID } from "@/lib/repository/types";
import type { AiExtractionReviewDecision } from "@/lib/repository/types";
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
// 事前計算済み company_suggestion の採用/却下
// ─────────────────────────────────────────────
// cron (dispatchUnassignedAiSuggestions) が事前に作った
// ai_extractions (extractionType='company_suggestion') を、
// 未割当キュー UI から人間が採用/却下する。
// 採用時のみ emailRepo.setCompany でスレッドにアサインする。
// 候補企業がアーカイブされている場合は弾く。

export type ReviewCompanySuggestionResult =
  | { ok: true; decision: AiExtractionReviewDecision; assignedCompanyId?: string }
  | { ok: false; message: string };

export async function reviewCompanySuggestionAction(
  extractionId: string,
  decision: AiExtractionReviewDecision
): Promise<ReviewCompanySuggestionResult> {
  if (decision !== "approved" && decision !== "rejected") {
    return { ok: false, message: "decision が不正です" };
  }
  const id = extractionId.trim();
  if (!id) return { ok: false, message: "extractionId が空です" };

  try {
    const ctx = await getPermissionContext();
    if (!ctx.actor) return { ok: false, message: "ログインが必要です" };

    const extraction = await aiExtractionRepo.getById(id);
    if (!extraction) return { ok: false, message: "候補が見つかりません" };
    if (extraction.extractionType !== "company_suggestion") {
      return { ok: false, message: "company_suggestion ではありません" };
    }
    if (extraction.reviewed) {
      return { ok: false, message: "この候補は既にレビュー済みです" };
    }

    if (decision === "approved") {
      const companyId = extraction.companyId;
      if (!companyId) {
        return { ok: false, message: "候補企業が記録されていません" };
      }
      // 候補企業がアーカイブ/削除されていないか確認 (FK 違反防止 + 誤マッピング防止)
      const company = await companyRepo.getById(companyId);
      if (!company) {
        return {
          ok: false,
          message: "候補企業が見つかりません (アーカイブされた可能性があります)"
        };
      }
      const threadId = extraction.sourceId;
      await emailRepo.setCompany(threadId, companyId);
      await aiExtractionRepo.markReviewed(id, ctx.actor.id, "approved");
      revalidatePath("/inbox/unassigned");
      revalidatePath("/inbox");
      revalidatePath(`/companies/${companyId}`);
      return { ok: true, decision: "approved", assignedCompanyId: companyId };
    }

    // rejected: 副作用なし
    await aiExtractionRepo.markReviewed(id, ctx.actor.id, "rejected");
    revalidatePath("/inbox/unassigned");
    return { ok: true, decision: "rejected" };
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
