"use server";

// AI 抽出の承認/却下 Server Action。
//
// Phase A:
//   - markReviewed に decision ('approved' | 'rejected') を保存
//   - decision==='approved' かつ companyId あり → 企業カルテ ToDo を 1 件作成
//   - 却下時は副作用なし (reviewed=true + decision のみ)
//   - company_suggestion / companyId 未確定の抽出は副作用 skip
//
// 次フェーズ: churnSignal / expansionOpportunity / journeyCheckpoint への接続
//   (contractId 解決が必要なため別フェーズで)

import { revalidatePath } from "next/cache";
import {
  aiExtractionRepo,
  companyTaskRepo
} from "@/lib/repository/server";
import { getPermissionContext } from "@/lib/auth/server";
import type { AiExtractionReviewDecision } from "@/lib/repository/types";
import { buildTaskInputFromExtraction } from "@/lib/domain/email/extraction-review";

export type ReviewExtractionResult =
  | {
      ok: true;
      decision: AiExtractionReviewDecision;
      /** 承認時に CompanyTask を作成したかどうか */
      taskCreated: boolean;
    }
  | { ok: false; code: "UNAUTHORIZED" | "NOT_FOUND" | "UNKNOWN"; message: string };

export async function reviewExtractionAction(
  id: string,
  decision: AiExtractionReviewDecision
): Promise<ReviewExtractionResult> {
  const ctx = await getPermissionContext();
  if (!ctx.actor) {
    return { ok: false, code: "UNAUTHORIZED", message: "ログインが必要です" };
  }
  if (!id) {
    return { ok: false, code: "UNKNOWN", message: "id がありません" };
  }
  if (decision !== "approved" && decision !== "rejected") {
    return { ok: false, code: "UNKNOWN", message: "decision が不正です" };
  }

  try {
    const extraction = await aiExtractionRepo.getById(id);
    if (!extraction) {
      return { ok: false, code: "NOT_FOUND", message: "抽出が見つかりません" };
    }

    await aiExtractionRepo.markReviewed(id, ctx.actor.id, decision);

    let taskCreated = false;
    if (decision === "approved") {
      const taskInput = buildTaskInputFromExtraction(extraction, {
        createdBy: ctx.actor.id
      });
      if (taskInput) {
        await companyTaskRepo.create(taskInput);
        taskCreated = true;
        revalidatePath(`/companies/${taskInput.companyId}`);
      }
    }

    revalidatePath("/inbox/extractions");
    return { ok: true, decision, taskCreated };
  } catch (e) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: e instanceof Error ? e.message : String(e)
    };
  }
}
