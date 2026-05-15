// 経営ダッシュボード「全社 Inner Rings 総覧」用の集計純関数。
//
// 既存資産:
//   - aggregateEngagementTier  (engagement-aggregation.ts) : 企業集約 tier
//   - computeStakeholderEngagement (engagement-builder.ts) : stakeholder ごとの suggestedTier + reasons
//
// ここでは Repository に触れず、上記の出力を引数として受け取り、
//   - tierCounts          : 全社 stakeholder の tier 別件数 (未測定含む)
//   - companyTierCounts   : 企業単位で集約した tier 別件数
//   - promotionCandidates : 自動算出が現 tier を上回る stakeholder の上位 N 件
//   - atRiskCompanies     : 集約 tier が at_risk な企業の上位 N 件
// を組み立てる。

import type { Stakeholder, EngagementTierValue } from "@/lib/repository/types";
import {
  aggregateEngagementTier,
  TIER_RANK
} from "./engagement-aggregation";
import type { EngagementTier } from "./engagement";

export type CommunityOverviewTierKey =
  | EngagementTierValue
  | "unmeasured";

export type CommunityOverviewPromotionCandidate = {
  stakeholderId: string;
  stakeholderName: string;
  companyId: string;
  companyName: string;
  currentTier: EngagementTier | null;
  suggestedTier: EngagementTier;
  reasons: string[];
};

export type CommunityOverviewAtRiskCompany = {
  companyId: string;
  companyName: string;
  ownerName?: string;
  stakeholderAtRiskCount: number;
};

export type CommunityOverview = {
  tierCounts: Record<CommunityOverviewTierKey, number>;
  companyTierCounts: Record<CommunityOverviewTierKey, number>;
  promotionCandidates: CommunityOverviewPromotionCandidate[];
  atRiskCompanies: CommunityOverviewAtRiskCompany[];
};

export type BuildCommunityOverviewInput = {
  companies: Array<{ id: string; name: string; ownerName?: string }>;
  stakeholders: Stakeholder[];
  /** stakeholderId -> { suggestedTier, reasons } (computeStakeholderEngagement の出力から抜粋) */
  stakeholderEngagement: Record<
    string,
    { suggestedTier: EngagementTier; reasons: string[] }
  >;
  /** 上位 N 件 (promotionCandidates / atRiskCompanies 両方に適用). 既定 5 */
  limit?: number;
};

const EMPTY_TIER_COUNTS: Record<CommunityOverviewTierKey, number> = {
  core: 0,
  active: 0,
  casual: 0,
  at_risk: 0,
  unmeasured: 0
};

function freshCounts(): Record<CommunityOverviewTierKey, number> {
  return { ...EMPTY_TIER_COUNTS };
}

export function buildCommunityOverview(
  input: BuildCommunityOverviewInput
): CommunityOverview {
  const limit = input.limit ?? 5;

  // 企業 id -> 企業情報
  const companyById = new Map<
    string,
    { id: string; name: string; ownerName?: string }
  >();
  for (const c of input.companies) companyById.set(c.id, c);

  // 企業 id -> stakeholder 配列
  const stakeholdersByCompany = new Map<string, Stakeholder[]>();
  for (const s of input.stakeholders) {
    const arr = stakeholdersByCompany.get(s.companyId) ?? [];
    arr.push(s);
    stakeholdersByCompany.set(s.companyId, arr);
  }

  // ── tierCounts: 全 stakeholder の tier 別件数 ───────────────────────────
  const tierCounts = freshCounts();
  for (const s of input.stakeholders) {
    const t = s.engagementTier;
    if (t == null) tierCounts.unmeasured += 1;
    else tierCounts[t] += 1;
  }

  // ── companyTierCounts: 企業単位で集約 tier を計算しカウント ────────────
  const companyTierCounts = freshCounts();
  for (const c of input.companies) {
    const arr = stakeholdersByCompany.get(c.id) ?? [];
    const agg = aggregateEngagementTier(arr);
    if (agg == null) companyTierCounts.unmeasured += 1;
    else companyTierCounts[agg] += 1;
  }

  // ── promotionCandidates: suggested > current rank の stakeholder を抽出 ──
  const promotionAll: CommunityOverviewPromotionCandidate[] = [];
  for (const s of input.stakeholders) {
    const computed = input.stakeholderEngagement[s.id];
    if (!computed) continue;
    const currentTier = s.engagementTier ?? null;
    const currentRank = currentTier != null ? TIER_RANK[currentTier] : -1;
    const suggestedRank = TIER_RANK[computed.suggestedTier];
    if (suggestedRank <= currentRank) continue;
    const company = companyById.get(s.companyId);
    if (!company) continue;
    promotionAll.push({
      stakeholderId: s.id,
      stakeholderName: s.name,
      companyId: s.companyId,
      companyName: company.name,
      currentTier,
      suggestedTier: computed.suggestedTier,
      reasons: computed.reasons ?? []
    });
  }
  // ソート: (suggested rank - current rank) 降順 → reasons 多い順 → 名前安定
  promotionAll.sort((a, b) => {
    const ar = TIER_RANK[a.suggestedTier] - (a.currentTier != null ? TIER_RANK[a.currentTier] : -1);
    const br = TIER_RANK[b.suggestedTier] - (b.currentTier != null ? TIER_RANK[b.currentTier] : -1);
    if (ar !== br) return br - ar;
    if (a.reasons.length !== b.reasons.length) return b.reasons.length - a.reasons.length;
    return a.stakeholderName.localeCompare(b.stakeholderName);
  });
  const promotionCandidates = promotionAll.slice(0, limit);

  // ── atRiskCompanies: 集約 at_risk な企業 + at_risk stakeholder 件数 ─────
  const atRiskAll: CommunityOverviewAtRiskCompany[] = [];
  for (const c of input.companies) {
    const arr = stakeholdersByCompany.get(c.id) ?? [];
    const agg = aggregateEngagementTier(arr);
    if (agg !== "at_risk") continue;
    const stakeholderAtRiskCount = arr.filter(
      (s) => s.engagementTier === "at_risk"
    ).length;
    atRiskAll.push({
      companyId: c.id,
      companyName: c.name,
      ownerName: c.ownerName,
      stakeholderAtRiskCount
    });
  }
  atRiskAll.sort((a, b) => {
    if (a.stakeholderAtRiskCount !== b.stakeholderAtRiskCount) {
      return b.stakeholderAtRiskCount - a.stakeholderAtRiskCount;
    }
    return a.companyName.localeCompare(b.companyName);
  });
  const atRiskCompanies = atRiskAll.slice(0, limit);

  return {
    tierCounts,
    companyTierCounts,
    promotionCandidates,
    atRiskCompanies
  };
}
