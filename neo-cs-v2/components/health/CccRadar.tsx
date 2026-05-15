import {
  CCC_PILLAR_LABEL,
  CCC_PILLAR_ORDER,
  CCC_STATUS_COLOR,
  type CccBreakdown
} from "@/lib/domain/ccc/breakdown";

type Props = {
  breakdown: CccBreakdown;
  size?: number;
};

/**
 * CCC レーダーチャート (SVG)。
 * 5 軸を 72° 間隔で配置し、25/50/75/100 の同心五角形をグリッドとして描画する。
 * 塗色は overallStatus に応じて青 (healthy) / 黄 (watch) / 赤 (risk) を 0.3 alpha で塗る。
 */
export function CccRadar({ breakdown, size = 320 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  // 軸ラベル分のマージン
  const r = size / 2 - 48;
  const color = CCC_STATUS_COLOR[breakdown.overallStatus];

  // 5 軸の角度 (上 = 0°)。SVG は y 軸下向きなので -90° 始点に。
  const angles = CCC_PILLAR_ORDER.map(
    (_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / 5
  );

  const pointFor = (axisIdx: number, ratio: number) => {
    const a = angles[axisIdx];
    return {
      x: cx + Math.cos(a) * r * ratio,
      y: cy + Math.sin(a) * r * ratio
    };
  };

  const gridLevels = [0.25, 0.5, 0.75, 1];
  const polygonForRatio = (ratio: number) =>
    angles
      .map((_, i) => {
        const p = pointFor(i, ratio);
        return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
      })
      .join(" ");

  // スコア多角形
  const scorePoints = CCC_PILLAR_ORDER.map((key, i) => {
    const ratio = breakdown.pillars[key].score / 100;
    const p = pointFor(i, ratio);
    return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  }).join(" ");

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="CCC レーダーチャート"
    >
      {/* グリッド (同心五角形) */}
      {gridLevels.map((lv) => (
        <polygon
          key={lv}
          points={polygonForRatio(lv)}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={1}
        />
      ))}
      {/* 軸線 */}
      {CCC_PILLAR_ORDER.map((_, i) => {
        const p = pointFor(i, 1);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="#E5E7EB"
            strokeWidth={1}
          />
        );
      })}
      {/* スコア多角形 */}
      <polygon
        points={scorePoints}
        fill={color.fill}
        stroke={color.stroke}
        strokeWidth={2}
      />
      {/* 各頂点の点 */}
      {CCC_PILLAR_ORDER.map((key, i) => {
        const ratio = breakdown.pillars[key].score / 100;
        const p = pointFor(i, ratio);
        return (
          <circle
            key={key}
            cx={p.x}
            cy={p.y}
            r={3}
            fill={color.stroke}
          />
        );
      })}
      {/* 軸ラベル */}
      {CCC_PILLAR_ORDER.map((key, i) => {
        const p = pointFor(i, 1.18);
        const label = CCC_PILLAR_LABEL[key];
        const pillar = breakdown.pillars[key];
        return (
          <g key={key}>
            <text
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={11}
              fontWeight={600}
              fill="#374151"
            >
              {label}
            </text>
            <text
              x={p.x}
              y={p.y + 14}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10}
              fill="#6B7280"
            >
              {pillar.score}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
