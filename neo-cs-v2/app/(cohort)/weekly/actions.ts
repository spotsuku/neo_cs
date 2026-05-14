"use server";

// 週次レビュー upsert Server Action
//
// app/weekly/CompanyWeeklyEditor.tsx と
// app/companies/[id]/WeeklyReviewPanel.tsx の両方から呼ばれる。
// 旧コードはクライアント側から weeklyReviewRepo.upsert を直接叩いていたため、
// 本番 (REPO_DRIVER=supabase) でも mock に書き込まれていた。

import { revalidatePath } from "next/cache";
import { weeklyReviewRepo, DEFAULT_ORG_ID } from "@/lib/repository/server";
import type { WeeklyAction, WeeklyNextAction } from "@/lib/repository/server";

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
