export function KpiCard({
  label,
  value,
  sub,
  trend,
  accent,
  explain
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: { value: string; direction: "up" | "down" | "flat" };
  accent?: string;
  /** 「ⓘ 根拠」ボタンを表示するノード (KpiExplainButton 等) */
  explain?: React.ReactNode;
}) {
  const trendColor =
    trend?.direction === "up"
      ? "text-emerald-600"
      : trend?.direction === "down"
      ? "text-rose-500"
      : "text-ink-500";
  const arrow =
    trend?.direction === "up" ? "↑" : trend?.direction === "down" ? "↓" : "→";
  return (
    <div className="liquid-surface px-4 py-3 relative overflow-hidden">
      {accent && (
        <div
          className="absolute -top-6 -right-6 w-16 h-16 rounded-full opacity-10"
          style={{ background: accent }}
        />
      )}
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-xs text-ink-500 font-medium">{label}</div>
        {explain}
      </div>
      <div className="mt-0.5 flex items-baseline gap-2 flex-wrap">
        <span className="text-xl font-bold tracking-tight text-ink-900 leading-tight">{value}</span>
        {trend && (
          <span className={`${trendColor} text-xs font-medium`}>
            {arrow} {trend.value}
          </span>
        )}
        {sub && <span className="text-caption text-ink-500">{sub}</span>}
      </div>
    </div>
  );
}
