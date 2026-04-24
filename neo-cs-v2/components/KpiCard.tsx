export function KpiCard({
  label,
  value,
  sub,
  trend,
  accent
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: { value: string; direction: "up" | "down" | "flat" };
  accent?: string;
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
    <div className="liquid-surface p-5 relative overflow-hidden">
      {accent && (
        <div
          className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-10"
          style={{ background: accent }}
        />
      )}
      <div className="text-xs text-ink-500 font-medium">{label}</div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-ink-900">{value}</div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {trend && (
          <span className={`${trendColor} font-medium`}>
            {arrow} {trend.value}
          </span>
        )}
        {sub && <span className="text-ink-500">{sub}</span>}
      </div>
    </div>
  );
}
