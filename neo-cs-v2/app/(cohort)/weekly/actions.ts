"use server";

// 週次レビュー upsert Server Action
//
// app/weekly/CompanyWeeklyEditor.tsx と
// app/companies/[id]/WeeklyReviewPanel.tsx の両方から呼ばれる。
// 旧コードはクライアント側から weeklyReviewRepo.upsert を直接叩いていたため、
// 本番 (REPO_DRIVER=supabase) でも mock に書き込まれていた。

import { revalidatePath } from "next/cache";
import { weeklyReviewRepo, DEFAULT_ORG_ID } from "@/lib/repository/server";
import type {
  WeeklyAction,
  WeeklyNextAction,
  WeeklyReview,
  ProductCode
} from "@/lib/repository/server";

export type WeeklyReviewSubmit = {
  companyId: string;
  product: string;
  weekStart: string;
  actions: WeeklyAction[];
  good: string;
  more: string;
  nextActions: WeeklyNextAction[];
  authorName: string;
  locked: boolean;
};

export async function submitWeeklyReviewAction(input: WeeklyReviewSubmit): Promise<{
  ok: true;
} | {
  ok: false;
  message: string;
}> {
  try {
    await weeklyReviewRepo.upsert({
      organizationId: DEFAULT_ORG_ID,
      companyId: input.companyId,
      product: input.product as Parameters<typeof weeklyReviewRepo.upsert>[0]["product"],
      weekStart: input.weekStart,
      actions: input.actions,
      good: input.good,
      more: input.more,
      nextActions: input.nextActions,
      authorName: input.authorName,
      locked: input.locked
    });
    // 関係する画面を再レンダリング
    revalidatePath(`/companies/${input.companyId}`);
    revalidatePath("/weekly");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : String(e)
    };
  }
}

// ─────────────────────────────────────────────
// Realtime からの差分検知後に呼ばれる re-fetch action
//
// weekly_reviews / weekly_actions / weekly_next_actions の変更通知を受けた
// クライアントが、最新の確定レビュー (1 件) をサーバから取り直す。
// revalidatePath を踏まないので連発しても重くない。
// ─────────────────────────────────────────────

export async function refreshWeeklyReviewAction(input: {
  companyId: string;
  product: string;
  weekStart: string;
}): Promise<WeeklyReview | null> {
  try {
    return await weeklyReviewRepo.getByKey(
      input.companyId,
      input.product as ProductCode,
      input.weekStart
    );
  } catch {
    return null;
  }
}

export async function refreshWeeklyReviewByIdAction(
  id: string
): Promise<WeeklyReview | null> {
  try {
    return await weeklyReviewRepo.getById(id);
  } catch {
    return null;
  }
}
