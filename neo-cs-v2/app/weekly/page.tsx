// 週次レビュー一覧ページ (Server Component)
//
// 旧実装は "use client" 全体で MOCK (companies / activeContracts / weeklyReviews)
// を直接 import していたため、本番 (REPO_DRIVER=supabase) でもダミーが見えていた。
// このページではサーバ側でリポジトリから取得し、UI ロジックは WeeklyView (Client) に渡す。

import { companyRepo, contractRepo, weeklyReviewRepo } from "@/lib/repository/server";
import { WeeklyView } from "./WeeklyView";

export const dynamic = "force-dynamic";

export default async function WeeklyPage() {
  const [companies, contracts, weeklyReviews] = await Promise.all([
    companyRepo.list(),
    contractRepo.list({ activeOnly: true }),
    weeklyReviewRepo.list()
  ]);

  return (
    <WeeklyView
      companies={companies}
      contracts={contracts}
      weeklyReviews={weeklyReviews}
    />
  );
}
