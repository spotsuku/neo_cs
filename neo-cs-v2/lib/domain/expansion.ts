// エクスパンション機会検知ロジック (純関数 — health/churn/kpi と同じ設計)
//
// 設計原則:
//   - 副作用なし。Repository を引数で取らず、必要なファクトデータのみ受ける
//   - mock 時点はオンデマンドで全契約に map 実行
//   - Supabase 切替時はサーバー側 cron が同関数を呼んで expansion_opportunities に upsert
//
// 検知ルール (kind):
//   1. healthy_streak     Health score 80以上が3週連続 → 安定運用、上位プラン提案候補
//   2. survey_signal      サーベイ自由記述に「他コースも気になる」「人数増やしたい」等のキーワード
//   3. seat_at_capacity   利用率がプラン上限の80%以上 (seat 拡張)
//   4. champion_promoted  Champion ステークホルダーが昇進 (decision_maker への type 昇格)
//   5. renewal_uplift     T-90 以内かつ Health green (更新時の単価アップセル)
//
// kind ↔ suggestedAction の方向性:
//   - upsell_higher_plan      上位プランへ
//   - cross_sell_other_product 他研修プロダクトの提案
//   - seat_expansion          席数追加 / 受講人数追加
//   - renewal_uplift          更新時の単価アップ

import type { ProductCode } from "@/lib/mock/data";

export type ExpansionKind =
  | "upsell_higher_plan"
  | "cross_sell_other_product"
  | "seat_expansion"
  | "renewal_uplift";

export type ExpansionRule =
  | "healthy_streak"
  | "survey_signal"
  | "seat_at_capacity"
  | "champion_promoted"
  | "renewal_window_green";

export const EXPANSION_KIND_LABEL: Record<ExpansionKind, string> = {
  upsell_higher_plan: "上位プラン提案",
  cross_sell_other_product: "他研修クロスセル",
  seat_expansion: "受講枠拡張",
  renewal_uplift: "更新時単価アップ"
};

export const EXPANSION_RULE_LABEL: Record<ExpansionRule, string> = {
  healthy_streak: "Health安定継続",
  survey_signal: "サーベイ拡張シグナル",
  seat_at_capacity: "受講枠ほぼ満員",
  champion_promoted: "Championが昇進",
  renewal_window_green: "更新窓 + Green"
};

export type ExpansionOpportunity = {
  id: string;
  contractId: string;
  companyId: string;
  product: ProductCode;
  kind: ExpansionKind;
  rule: ExpansionRule;
  /** 0..100 機会の確度 */
  score: number;
  reason: string;
  evidence: Record<string, unknown>;
  suggestedAction: string;
  estimatedUpsellJpy?: number;
  detectedAt: string;
};

export type DetectExpansionInput = {
  contractId: string;
  companyId: string;
  product: ProductCode;
  /** 直近12週分のスコアスナップショット (asOf 古い順 or 新しい順どちらでも) */
  snapshots: { asOf: string; score: number }[];
  /** 契約の MRR (円) — 上位プラン提案額算出に使用 */
  mrr?: number;
  /** 契約終了日 (YYYY-MM-DD) */
  endDate?: string;
  /** 受講者数 / 上限 (上限が分かる場合のみ) */
  participantCount?: number;
  participantCap?: number;
  /** ステークホルダーの type 履歴 (古い順)。最後が最新。 */
  stakeholderHistory: { stakeholderId: string; type: "user" | "champion" | "decision_maker"; recordedAt: string }[];
  /** 直近サーベイの自由記述 (textArea応答) */
  recentSurveyTexts: string[];
  asOf?: string;
};

const RULE_TO_KIND: Record<ExpansionRule, ExpansionKind> = {
  healthy_streak: "upsell_higher_plan",
  survey_signal: "cross_sell_other_product",
  seat_at_capacity: "seat_expansion",
  champion_promoted: "renewal_uplift",
  renewal_window_green: "renewal_uplift"
};

const SCORE_BASE: Record<ExpansionRule, number> = {
  healthy_streak: 70,
  survey_signal: 80,
  seat_at_capacity: 75,
  champion_promoted: 85,
  renewal_window_green: 78
};

// ── 個別ルール ────────────────────────────────────────────────────

function ruleHealthyStreak(input: DetectExpansionInput): Omit<ExpansionOpportunity, "id" | "contractId" | "companyId" | "product" | "detectedAt"> | null {
  const sorted = [...input.snapshots].sort((a, b) => a.asOf.localeCompare(b.asOf));
  if (sorted.length < 3) return null;
  const last3 = sorted.slice(-3);
  if (!last3.every((s) => s.score >= 80)) return null;
  return {
    rule: "healthy_streak",
    kind: RULE_TO_KIND.healthy_streak,
    score: SCORE_BASE.healthy_streak,
    reason: `Healthスコア 80 以上が 3週連続 (${last3.map((s) => s.score).join(" → ")})`,
    evidence: { weeks: last3 },
    suggestedAction: "上位プラン (講師1on1付き等) を T-90 で提案",
    estimatedUpsellJpy: input.mrr ? Math.round(input.mrr * 0.3) : undefined
  };
}

const SURVEY_KEYWORDS = [
  "他コース",
  "別の研修",
  "他研修",
  "拡張",
  "人数",
  "増やし",
  "枠を増",
  "もっと",
  "次年度",
  "全社展開",
  "他部署"
];

function ruleSurveySignal(input: DetectExpansionInput): Omit<ExpansionOpportunity, "id" | "contractId" | "companyId" | "product" | "detectedAt"> | null {
  const matched: { text: string; keyword: string }[] = [];
  for (const text of input.recentSurveyTexts) {
    for (const k of SURVEY_KEYWORDS) {
      if (text.includes(k)) {
        matched.push({ text: text.slice(0, 80), keyword: k });
        break;
      }
    }
  }
  if (matched.length === 0) return null;
  return {
    rule: "survey_signal",
    kind: RULE_TO_KIND.survey_signal,
    score: Math.min(95, SCORE_BASE.survey_signal + matched.length * 3),
    reason: `サーベイで拡張意向のキーワード検出 (${matched.length}件)`,
    evidence: { matches: matched },
    suggestedAction: "他研修プロダクトのデモ MTG を提案 (1週以内)",
    estimatedUpsellJpy: input.mrr ? Math.round(input.mrr * 0.5) : undefined
  };
}

function ruleSeatAtCapacity(input: DetectExpansionInput): Omit<ExpansionOpportunity, "id" | "contractId" | "companyId" | "product" | "detectedAt"> | null {
  if (!input.participantCount || !input.participantCap) return null;
  if (input.participantCap <= 0) return null;
  const ratio = input.participantCount / input.participantCap;
  if (ratio < 0.8) return null;
  return {
    rule: "seat_at_capacity",
    kind: RULE_TO_KIND.seat_at_capacity,
    score: Math.min(95, Math.round(SCORE_BASE.seat_at_capacity + (ratio - 0.8) * 100)),
    reason: `受講枠 ${input.participantCount}/${input.participantCap} (${Math.round(ratio * 100)}%) — 枠拡張余地`,
    evidence: { count: input.participantCount, cap: input.participantCap, ratio },
    suggestedAction: "受講枠 +3 名 / 来期の追加プランを提案",
    estimatedUpsellJpy: input.mrr ? Math.round(input.mrr * 0.25) : undefined
  };
}

function ruleChampionPromoted(input: DetectExpansionInput): Omit<ExpansionOpportunity, "id" | "contractId" | "companyId" | "product" | "detectedAt"> | null {
  // stakeholderHistory に同一 stakeholderId で type が
  // user/champion → decision_maker に昇格した跡がある
  const byStakeholder = new Map<string, typeof input.stakeholderHistory>();
  for (const h of input.stakeholderHistory) {
    const arr = byStakeholder.get(h.stakeholderId) ?? [];
    arr.push(h);
    byStakeholder.set(h.stakeholderId, arr);
  }
  for (const [sid, history] of byStakeholder) {
    const sorted = [...history].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
    if (sorted.length < 2) continue;
    const last = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    if (last.type === "decision_maker" && prev.type !== "decision_maker") {
      return {
        rule: "champion_promoted",
        kind: RULE_TO_KIND.champion_promoted,
        score: SCORE_BASE.champion_promoted,
        reason: `Champion (${sid}) が決裁者に昇格 — 拡大提案の好機`,
        evidence: { stakeholderId: sid, prevType: prev.type, newType: last.type, at: last.recordedAt },
        suggestedAction: "昇進祝い + 全社展開プラン提案 (4週以内)",
        estimatedUpsellJpy: input.mrr ? Math.round(input.mrr * 0.6) : undefined
      };
    }
  }
  return null;
}

function ruleRenewalWindowGreen(input: DetectExpansionInput): Omit<ExpansionOpportunity, "id" | "contractId" | "companyId" | "product" | "detectedAt"> | null {
  if (!input.endDate) return null;
  const today = (input.asOf ?? new Date().toISOString()).slice(0, 10);
  const daysToEnd = Math.ceil(
    (new Date(input.endDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysToEnd < 0 || daysToEnd > 90) return null;
  // 直近スコアが green
  const sorted = [...input.snapshots].sort((a, b) => b.asOf.localeCompare(a.asOf));
  const latest = sorted[0];
  if (!latest || latest.score < 75) return null;
  return {
    rule: "renewal_window_green",
    kind: RULE_TO_KIND.renewal_window_green,
    score: SCORE_BASE.renewal_window_green,
    reason: `更新窓 (T-${daysToEnd}日) + Health Green (${latest.score})`,
    evidence: { daysToEnd, latestScore: latest.score },
    suggestedAction: "更新時の単価アップ (年間契約 + 早期割引) を提案",
    estimatedUpsellJpy: input.mrr ? Math.round(input.mrr * 0.15) : undefined
  };
}

// ── 公開関数 ──────────────────────────────────────────────────────

export function detectExpansionOpportunities(
  input: DetectExpansionInput
): ExpansionOpportunity[] {
  const detectedAt = input.asOf ?? new Date().toISOString();
  const candidates = [
    ruleHealthyStreak(input),
    ruleSurveySignal(input),
    ruleSeatAtCapacity(input),
    ruleChampionPromoted(input),
    ruleRenewalWindowGreen(input)
  ];
  return candidates
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .map((c) => ({
      ...c,
      id: `exp-${input.contractId}-${c.rule}`,
      contractId: input.contractId,
      companyId: input.companyId,
      product: input.product,
      detectedAt
    }));
}

/** score >= threshold を「通知すべき機会」とみなす */
export const EXPANSION_NOTIFY_THRESHOLD = 80;
