// Stakeholder Engagement (顧客側担当者の接点頻度) 算出ロジック (純関数)
//
// 設計原則:
//   - 副作用なし。Repository を引数で受け取らず、必要なファクトデータのみ受ける
//   - 既存 stakeholder.engagement (low|med|high — "意欲" の主観評価) とは別概念
//     こちらは「直近の接点頻度」を機械的に分類した tier
//   - tier は自動算出 (suggestedTier) と 手動上書き値 (tier) を分離
//   - suggested と override を比較すれば「自動と人手判断の乖離」を画面で可視化できる
//
// 4 区分:
//   core    : 月3回以上の接点 (= touchCount30d >= 3)
//   active  : 月1回以上     (= touchCount30d >= 1)
//   casual  : 四半期1回以上 (= touchCount90d >= 1)
//   at_risk : 90日以上接点なし
//
// 接点 (touch) の定義:
//   - 出席 (attendance_event status='present' or 'late')
//   - 面談ログ (meeting_log)
//   - 週次レビューでの言及 (weekly_review.actionsへの mention など — 呼び出し側で前処理)
//
// 呼び出し側の責務:
//   - stakeholder と関係するイベント群を asOf 時点で集計し touches[] を渡す
//   - 同一日に複数 touch があっても 1 件としてカウントしたい場合は呼び出し側で uniq

export type EngagementTier = "core" | "active" | "casual" | "at_risk";

export const engagementTierOrder: EngagementTier[] = [
  "core",
  "active",
  "casual",
  "at_risk"
];

export const engagementTierLabel: Record<EngagementTier, string> = {
  core: "コア",
  active: "アクティブ",
  casual: "カジュアル",
  at_risk: "離反リスク"
};

/** badge 表示用 (tailwind class). UI 側の参照ポイントを集約 */
export const engagementTierBadgeClass: Record<EngagementTier, string> = {
  core: "bg-success-50 text-success-700 border border-success-100",
  active: "bg-info-50 text-info-700 border border-info-100",
  casual: "bg-neutral-100 text-neutral-700 border border-neutral-300",
  at_risk: "bg-danger-50 text-danger-700 border border-danger-100"
};

export type EngagementTouch = {
  /** 接点の発生時刻 (ISO 文字列。日付のみでも OK) */
  occurredAt: string;
  /** 種別 (将来 weight 計算用、現状は score 加算のみ) */
  kind?: "attendance" | "meeting" | "weekly" | "other";
};

export type EngagementInput = {
  touches: EngagementTouch[];
  /** 評価基準日。未指定なら "今日" */
  asOf?: string;
  /** 手動上書き tier (画面側の上書き UI から渡す) */
  overrideTier?: EngagementTier | null;
};

export type EngagementResult = {
  /** 実値 (override があれば override 優先、なければ suggestedTier) */
  tier: EngagementTier;
  /** 自動算出値 (override が無い場合 tier と一致) */
  suggestedTier: EngagementTier;
  /** 0..100 の連続スコア (UI のソート/可視化用) */
  score: number;
  /** 直近接点日 (touches が空なら null) */
  lastTouchAt: string | null;
  touchCount30d: number;
  touchCount90d: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(s: string): number {
  // YYYY-MM-DD または ISO 文字列を受ける。失敗時は NaN
  const t = Date.parse(s);
  return Number.isNaN(t) ? Date.parse(s + "T00:00:00") : t;
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.floor((parseDate(toIso) - parseDate(fromIso)) / DAY_MS);
}

/**
 * 4 区分判定.
 *   - core   : 30日内 >= 3 件
 *   - active : 30日内 >= 1 件
 *   - casual : 90日内 >= 1 件
 *   - at_risk: それ以外 (90日以上接点なし or 接点ゼロ)
 */
export function classifyEngagement(input: {
  touchCount30d: number;
  touchCount90d: number;
}): EngagementTier {
  if (input.touchCount30d >= 3) return "core";
  if (input.touchCount30d >= 1) return "active";
  if (input.touchCount90d >= 1) return "casual";
  return "at_risk";
}

/** スコア化 (連続値). 将来「直近重み」「種別重み」を入れる余地を残す */
function computeScore(args: {
  touchCount30d: number;
  touchCount90d: number;
  daysSinceLastTouch: number | null;
}): number {
  // 30日内×3 + (90日内 - 30日内)×1 の単純加算 → 0..30 程度
  const recent = args.touchCount30d * 3;
  const mid = Math.max(0, args.touchCount90d - args.touchCount30d) * 1;
  let raw = recent + mid;
  // 90日以上接点なしは大幅減点
  if (args.daysSinceLastTouch === null || args.daysSinceLastTouch > 90) raw = 0;
  // 0..100 にクランプ (12 で 100 到達 = core 4 件相当)
  const score = Math.min(100, Math.round((raw / 12) * 100));
  return score;
}

export function computeEngagement(input: EngagementInput): EngagementResult {
  const asOf = input.asOf ?? new Date().toISOString().slice(0, 10);

  // 不正な日付は除外
  const sorted = [...input.touches]
    .filter((t) => !Number.isNaN(parseDate(t.occurredAt)))
    .sort((a, b) => parseDate(b.occurredAt) - parseDate(a.occurredAt));

  const touchCount30d = sorted.filter(
    (t) => daysBetween(t.occurredAt, asOf) <= 30 && daysBetween(t.occurredAt, asOf) >= 0
  ).length;
  const touchCount90d = sorted.filter(
    (t) => daysBetween(t.occurredAt, asOf) <= 90 && daysBetween(t.occurredAt, asOf) >= 0
  ).length;

  const lastTouchAt = sorted.length > 0 ? sorted[0].occurredAt : null;
  const daysSinceLastTouch = lastTouchAt ? daysBetween(lastTouchAt, asOf) : null;

  const suggestedTier = classifyEngagement({ touchCount30d, touchCount90d });
  const tier = input.overrideTier ?? suggestedTier;

  const score = computeScore({ touchCount30d, touchCount90d, daysSinceLastTouch });

  return {
    tier,
    suggestedTier,
    score,
    lastTouchAt,
    touchCount30d,
    touchCount90d
  };
}

/** 集計ヘルパ: tier ごとの件数 (UI の分布表示で使用) */
export function tallyByTier<T extends { tier: EngagementTier }>(
  rows: T[]
): Record<EngagementTier, number> {
  const tally: Record<EngagementTier, number> = {
    core: 0,
    active: 0,
    casual: 0,
    at_risk: 0
  };
  for (const r of rows) tally[r.tier] += 1;
  return tally;
}
