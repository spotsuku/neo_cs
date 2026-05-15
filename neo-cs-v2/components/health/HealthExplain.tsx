// Health スコアの根拠表示コンポーネント
// - スコア + 色バッジ
// - factor 別の寄与度バー (weighted score)
// - トップ要因 (改善で最も効く因子) を強調
//
// 設計トークン: text-body / text-caption / surface / focus-ring 準拠

import type { HealthBreakdown, HealthColor } from "@/lib/domain/health/health";

const COLOR_BG: Record<HealthColor, string> = {
  green: "bg-blue-50 text-blue-700 border-blue-100",
  yellow: "bg-warning-50 text-warning-700 border-warning-100",
  red: "bg-danger-50 text-danger-700 border-danger-100"
};

const COLOR_LABEL: Record<HealthColor, string> = {
  green: "Healthy",
  yellow: "Yellow",
  red: "Red"
};

const TONE_BAR: Record<"positive" | "neutral" | "negative", string> = {
  positive: "bg-success-500",
  neutral: "bg-warning-500",
  negative: "bg-danger-500"
};

const TONE_TEXT: Record<"positive" | "neutral" | "negative", string> = {
  positive: "text-success-700",
  neutral: "text-warning-700",
  negative: "text-danger-700"
};

export function HealthExplain({
  breakdown,
  compact = false
}: {
  breakdown: HealthBreakdown;
  compact?: boolean;
}) {
  const { score, color, contributions, topNegative } = breakdown;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-metric font-bold text-neutral-900 tabular-nums">
          {score}
        </span>
        <span className="text-caption text-neutral-500">/100</span>
        <span
          className={`inline-flex px-2 py-0.5 rounded-pill border text-caption font-medium ${COLOR_BG[color]}`}
        >
          {COLOR_LABEL[color]}
        </span>
      </div>

      {topNegative && (
        <div className="text-body text-neutral-700">
          <span className="text-caption text-neutral-500">最大の改善ポイント: </span>
          <span className={`font-medium ${TONE_TEXT[topNegative.tone]}`}>
            {topNegative.label}
          </span>
          <span className="text-caption text-neutral-500"> — {topNegative.hint}</span>
        </div>
      )}

      {!compact && (
        <ul className="space-y-2 mt-2">
          {contributions.map((c) => (
            <li key={c.key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-caption">
                <span className="text-neutral-700">
                  {c.label}{" "}
                  <span className="text-neutral-500">({c.rawDisplay})</span>
                </span>
                <span className="text-neutral-500 tabular-nums">
                  <span className={`font-medium ${TONE_TEXT[c.tone]}`}>
                    {c.weightedScore}
                  </span>
                  <span className="text-neutral-300"> / {c.weight}</span>
                </span>
              </div>
              <div className="h-1.5 rounded-pill bg-neutral-100 overflow-hidden">
                <div
                  className={`h-full ${TONE_BAR[c.tone]}`}
                  style={{ width: `${c.normalizedScore}%` }}
                />
              </div>
              <p className="text-caption text-neutral-500">{c.hint}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
