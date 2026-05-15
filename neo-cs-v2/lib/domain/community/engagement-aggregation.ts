// Stakeholder 単位の engagementTier から企業全体の engagementTier を集約する純関数。
//
// 集約ルール (案 B: ハイブリッド)
//   - core が 1 人以上 && (core or active) が過半数 → core
//   - (core or active) が過半数                     → active
//   - (core or active or casual) が過半数           → casual
//   - 上記いずれも満たさない (at_risk が半数以上)   → at_risk
//   - 測定対象 0 名 (全員 null)                     → null
//
// 設計意図 (docs/COMMUNITY.md §6):
//   「core 1 人 + 他全員 at_risk」は core にしない (スターリーダー依存の罠)。
//   多数の active 以上が必要。
//
// null tier の stakeholder は「未測定」扱いで母数から除外する。

import type { EngagementTierValue } from "@/lib/repository/types";

export type StakeholderForAggregation = {
  engagementTier?: EngagementTierValue | null;
};

export type AggregatedEngagementTier = EngagementTierValue | null;

const TIER_RANK: Record<EngagementTierValue, number> = {
  core: 3,
  active: 2,
  casual: 1,
  at_risk: 0
};

export function aggregateEngagementTier(
  stakeholders: ReadonlyArray<StakeholderForAggregation>
): AggregatedEngagementTier {
  const measured = stakeholders.filter(
    (s): s is { engagementTier: EngagementTierValue } => s.engagementTier != null
  );
  if (measured.length === 0) return null;

  const total = measured.length;
  const counts = { core: 0, active: 0, casual: 0, at_risk: 0 };
  for (const s of measured) counts[s.engagementTier]++;

  const coreCount = counts.core;
  const activeOrAbove = counts.core + counts.active;
  const casualOrAbove = activeOrAbove + counts.casual;
  // 過半数 = 半数より多い (= total * 2 < count * 2 ではなく count * 2 > total)
  const isMajority = (count: number) => count * 2 > total;

  if (coreCount >= 1 && isMajority(activeOrAbove)) return "core";
  if (isMajority(activeOrAbove)) return "active";
  if (isMajority(casualOrAbove)) return "casual";
  return "at_risk";
}

// テスト・UI 用のラベル
export const ENGAGEMENT_TIER_LABEL: Record<EngagementTierValue, string> = {
  core: "コア",
  active: "アクティブ",
  casual: "カジュアル",
  at_risk: "離脱危機"
};

// TIER_RANK を export 用に再公開 (テスト/UI 用)
export { TIER_RANK };
