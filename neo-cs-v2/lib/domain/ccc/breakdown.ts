// CCC (Customer Community Construction) Framework スコア算出 (純関数)
//
// 設計原則:
//   - 副作用なし。Repository を引数で受け取らず、シグナルを props として受け取る
//   - 「2026 CCC Framework」5 本柱を 0-100 スケールで可視化
//   - 各柱に信頼度 (high / med / low) を付与し、score だけでなく確度も提示
//   - status は score 閾値で healthy / watch / risk の 3 段に振り分け
//
// 5 本柱と signal マッピング (Phase 1):
//   Retention   ─ attendance 率 + weeksSince + lastTouchDays + churn signal 数 (high)
//   Contribution ─ meetingLog 件数 + weeklyReview 提出率 proxy        (med)
//   Support      ─ VoC items の量 (低位推移 = 良)                     (low, 反転)
//   Growth       ─ 新規参加者数 / 紹介トラッキング placeholder        (low)
//   Relevance    ─ surveyScore + VoC 量 (能動的回答の proxy)          (med)
//
// 総合スコアは荷重平均: Retention 1.5 / Relevance 1.0 / Contribution 1.0 / Support 0.8 / Growth 0.8

export type CccPillarKey =
  | "retention"
  | "contribution"
  | "support"
  | "growth"
  | "relevance";

export type CccConfidence = "high" | "med" | "low";

export type CccStatus = "healthy" | "watch" | "risk";

export type CccPillarScore = {
  key: CccPillarKey;
  score: number; // 0..100
  confidence: CccConfidence;
  status: CccStatus;
  contributingSignals: string[];
};

export type CccBreakdown = {
  companyId: string;
  pillars: Record<CccPillarKey, CccPillarScore>;
  overallScore: number;
  overallStatus: CccStatus;
  engagementTier: "core" | "active" | "casual" | "at_risk" | null;
};

export type CccInput = {
  companyId: string;
  /** 出席率 0..1 (null = データ無し) */
  attendance?: number | null;
  /** 最終接点からの日数 (大きいほど悪い) */
  lastTouchDays?: number | null;
  /** 最終接点からの週数 (大きいほど悪い) */
  weeksSinceLastTouch?: number | null;
  /** 未解決 churn signal 件数 */
  churnSignalCount?: number | null;
  /** 直近 N 日の meeting log 件数 */
  meetingLogCount?: number | null;
  /** 週次レビュー提出率 0..1 (proxy) */
  weeklyReviewSubmissionRate?: number | null;
  /** open / in_progress な VoC item 件数 */
  vocItemCount?: number | null;
  /** 直近アンケートの 0..100 スコア */
  surveyScore?: number | null;
  /** 新規参加者数 (期内) */
  newParticipantCount?: number | null;
  /** 紹介経由の新規企業数 (未整備のため通常 null) */
  referralCount?: number | null;
  /** 関与度 (集約済み) */
  engagementTier?: CccBreakdown["engagementTier"];
};

const STATUS_HEALTHY = 70;
const STATUS_WATCH = 40;

const PILLAR_WEIGHTS: Record<CccPillarKey, number> = {
  retention: 1.5,
  relevance: 1.0,
  contribution: 1.0,
  support: 0.8,
  growth: 0.8
};

const SAFE_DEFAULT = 50;

function clamp(n: number, min = 0, max = 100): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function toStatus(score: number): CccStatus {
  if (score >= STATUS_HEALTHY) return "healthy";
  if (score >= STATUS_WATCH) return "watch";
  return "risk";
}

/* ──────────────── 柱ごとのスコアリング ──────────────── */

function scoreRetention(input: CccInput): CccPillarScore {
  const signals: string[] = [];
  const parts: number[] = [];

  if (input.attendance != null) {
    const s = clamp(input.attendance * 100);
    parts.push(s);
    signals.push(`出席率 ${Math.round(input.attendance * 100)}%`);
  }
  // 週数 (0=満点, 8週で 0) を 0..100 に
  const weeks =
    input.weeksSinceLastTouch ??
    (input.lastTouchDays != null ? input.lastTouchDays / 7 : null);
  if (weeks != null) {
    const s = clamp(100 - (weeks / 8) * 100);
    parts.push(s);
    signals.push(`最終接点 ${Math.round(weeks)}週前`);
  }
  if (input.churnSignalCount != null) {
    // 0件=100, 5件以上=0
    const s = clamp(100 - (input.churnSignalCount / 5) * 100);
    parts.push(s);
    signals.push(`未解決 churn 予兆 ${input.churnSignalCount}件`);
  }

  const dataPoints = parts.length;
  const score =
    dataPoints === 0
      ? SAFE_DEFAULT
      : Math.round(parts.reduce((a, b) => a + b, 0) / dataPoints);
  // Retention は実データ寄り: 2 点以上で high, 1 点で med, 0 で low
  const confidence: CccConfidence =
    dataPoints >= 2 ? "high" : dataPoints === 1 ? "med" : "low";

  return {
    key: "retention",
    score,
    confidence,
    status: toStatus(score),
    contributingSignals: signals.length ? signals : ["データ未収集"]
  };
}

function scoreContribution(input: CccInput): CccPillarScore {
  const signals: string[] = [];
  const parts: number[] = [];

  if (input.meetingLogCount != null) {
    // 0件=0, 10件以上=100
    const s = clamp((input.meetingLogCount / 10) * 100);
    parts.push(s);
    signals.push(`面談ログ ${input.meetingLogCount}件`);
  }
  if (input.weeklyReviewSubmissionRate != null) {
    const s = clamp(input.weeklyReviewSubmissionRate * 100);
    parts.push(s);
    signals.push(
      `週次レビュー提出率 ${Math.round(input.weeklyReviewSubmissionRate * 100)}%`
    );
  }

  const dataPoints = parts.length;
  const score =
    dataPoints === 0
      ? SAFE_DEFAULT
      : Math.round(parts.reduce((a, b) => a + b, 0) / dataPoints);
  // Contribution は proxy 由来: 最大 med
  const confidence: CccConfidence =
    dataPoints >= 1 ? "med" : "low";

  return {
    key: "contribution",
    score,
    confidence,
    status: toStatus(score),
    contributingSignals: signals.length ? signals : ["データ未収集"]
  };
}

function scoreSupport(input: CccInput): CccPillarScore {
  const signals: string[] = [];
  // 反転指標: VoC 件数が少ない = 良
  if (input.vocItemCount != null) {
    // 0件=100, 10件以上=0
    const score = clamp(100 - (input.vocItemCount / 10) * 100);
    signals.push(`未解決 VoC ${input.vocItemCount}件`);
    return {
      key: "support",
      score: Math.round(score),
      confidence: "low", // 反転指標は低信頼
      status: toStatus(score),
      contributingSignals: signals
    };
  }
  return {
    key: "support",
    score: SAFE_DEFAULT,
    confidence: "low",
    status: toStatus(SAFE_DEFAULT),
    contributingSignals: ["データ未収集"]
  };
}

function scoreGrowth(input: CccInput): CccPillarScore {
  const signals: string[] = [];
  const parts: number[] = [];

  if (input.newParticipantCount != null) {
    // 0=0, 5以上=100
    parts.push(clamp((input.newParticipantCount / 5) * 100));
    signals.push(`新規参加者 ${input.newParticipantCount}名`);
  }
  if (input.referralCount != null) {
    parts.push(clamp((input.referralCount / 3) * 100));
    signals.push(`紹介経由 ${input.referralCount}件`);
  }

  if (parts.length === 0) {
    return {
      key: "growth",
      score: SAFE_DEFAULT,
      confidence: "low",
      status: toStatus(SAFE_DEFAULT),
      contributingSignals: ["紹介トラッキング未整備"]
    };
  }
  const score = Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
  return {
    key: "growth",
    score,
    confidence: "low", // 体系的データが未整備
    status: toStatus(score),
    contributingSignals: signals
  };
}

function scoreRelevance(input: CccInput): CccPillarScore {
  const signals: string[] = [];
  const parts: number[] = [];

  if (input.surveyScore != null) {
    const s = clamp(input.surveyScore);
    parts.push(s);
    signals.push(`アンケート ${Math.round(s)}点`);
  }
  if (input.vocItemCount != null) {
    // VoC を上げてくれる=能動的=妥当性が高い。1件=20, 5件以上=100
    const s = clamp((input.vocItemCount / 5) * 100);
    parts.push(s);
    signals.push(`VoC 投稿 ${input.vocItemCount}件 (能動性)`);
  }

  const dataPoints = parts.length;
  const score =
    dataPoints === 0
      ? SAFE_DEFAULT
      : Math.round(parts.reduce((a, b) => a + b, 0) / dataPoints);
  const confidence: CccConfidence =
    dataPoints >= 2 ? "med" : dataPoints === 1 ? "med" : "low";

  return {
    key: "relevance",
    score,
    confidence,
    status: toStatus(score),
    contributingSignals: signals.length ? signals : ["データ未収集"]
  };
}

/* ──────────────── 総合 ──────────────── */

export function computeCccBreakdown(input: CccInput): CccBreakdown {
  const pillars: Record<CccPillarKey, CccPillarScore> = {
    retention: scoreRetention(input),
    contribution: scoreContribution(input),
    support: scoreSupport(input),
    growth: scoreGrowth(input),
    relevance: scoreRelevance(input)
  };

  let weightedSum = 0;
  let weightTotal = 0;
  (Object.keys(pillars) as CccPillarKey[]).forEach((k) => {
    const w = PILLAR_WEIGHTS[k];
    weightedSum += pillars[k].score * w;
    weightTotal += w;
  });
  const overallScore = Math.round(weightedSum / weightTotal);

  return {
    companyId: input.companyId,
    pillars,
    overallScore,
    overallStatus: toStatus(overallScore),
    engagementTier: input.engagementTier ?? null
  };
}

/** UI 用: status → tailwind カラークラス。色は青 / 黄 / 赤に統一 */
export const CCC_STATUS_COLOR: Record<
  CccStatus,
  { fill: string; stroke: string; bg: string; text: string; border: string }
> = {
  healthy: {
    fill: "rgba(59,130,246,0.30)", // blue-500 @ 0.3
    stroke: "rgb(59,130,246)",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200"
  },
  watch: {
    fill: "rgba(234,179,8,0.30)", // yellow-500 @ 0.3
    stroke: "rgb(234,179,8)",
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    border: "border-yellow-200"
  },
  risk: {
    fill: "rgba(239,68,68,0.30)", // red-500 @ 0.3
    stroke: "rgb(239,68,68)",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200"
  }
};

export const CCC_PILLAR_LABEL: Record<CccPillarKey, string> = {
  retention: "定着 Retention",
  contribution: "貢献 Contribution",
  support: "支援 Support",
  growth: "成長 Growth",
  relevance: "妥当性 Relevance"
};

export const CCC_PILLAR_ORDER: CccPillarKey[] = [
  "retention",
  "contribution",
  "support",
  "growth",
  "relevance"
];
