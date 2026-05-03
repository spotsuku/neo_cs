// Health スコアの時系列スパークライン
// 与えられた snapshot 配列から SVG 折れ線を描く

import type { HealthSnapshot } from "@/lib/repository";

export function HealthSparkline({
  snapshots,
  width = 200,
  height = 48
}: {
  snapshots: HealthSnapshot[];
  width?: number;
  height?: number;
}) {
  if (snapshots.length < 2) {
    return (
      <div
        className="text-caption text-neutral-400 flex items-center"
        style={{ height }}
      >
        履歴データ不足
      </div>
    );
  }

  const sorted = [...snapshots].sort((a, b) => a.asOf.localeCompare(b.asOf));
  const xs = sorted.map((_, i) => (i / (sorted.length - 1)) * (width - 4) + 2);
  const ys = sorted.map((s) => height - 2 - (s.score / 100) * (height - 4));

  const path = sorted
    .map((_, i) => `${i === 0 ? "M" : "L"}${xs[i].toFixed(1)},${ys[i].toFixed(1)}`)
    .join(" ");

  const last = sorted[sorted.length - 1];
  const first = sorted[0];
  const delta = last.score - first.score;
  const lastColor = last.color;

  const stroke =
    lastColor === "green"
      ? "#10B981"
      : lastColor === "yellow"
      ? "#F59E0B"
      : "#EF4444";

  // 75 / 55 のしきい値線
  const y75 = height - 2 - (75 / 100) * (height - 4);
  const y55 = height - 2 - (55 / 100) * (height - 4);

  return (
    <div className="flex items-center gap-2">
      <svg width={width} height={height} className="block">
        <line
          x1={0}
          x2={width}
          y1={y75}
          y2={y75}
          stroke="#D1FAE5"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
        <line
          x1={0}
          x2={width}
          y1={y55}
          y2={y55}
          stroke="#FEF3C7"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
        <path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={2.5} fill={stroke} />
      </svg>
      <span className="text-caption text-neutral-500 tabular-nums">
        {delta >= 0 ? "+" : ""}
        {delta}
      </span>
    </div>
  );
}
