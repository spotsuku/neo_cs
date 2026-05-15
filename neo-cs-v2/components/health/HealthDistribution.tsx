export function HealthDistribution({
  green,
  yellow,
  red,
  size = "md"
}: {
  green: number;
  yellow: number;
  red: number;
  size?: "sm" | "md";
}) {
  const total = green + yellow + red;
  if (total === 0) {
    return <span className="text-xs text-ink-500">対象外</span>;
  }
  const g = (green / total) * 100;
  const y = (yellow / total) * 100;
  const r = (red / total) * 100;
  const h = size === "sm" ? "h-1.5" : "h-2";
  return (
    <div>
      <div className={`flex ${h} w-full rounded-full overflow-hidden bg-ink-50`}>
        {g > 0 && <div style={{ width: `${g}%`, background: "#3B82F6" }} />}
        {y > 0 && <div style={{ width: `${y}%`, background: "#F59E0B" }} />}
        {r > 0 && <div style={{ width: `${r}%`, background: "#EF4444" }} />}
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-[11px]">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span className="text-ink-700 font-medium">{green}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span className="text-ink-700 font-medium">{yellow}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          <span className="text-ink-700 font-medium">{red}</span>
        </span>
      </div>
    </div>
  );
}
