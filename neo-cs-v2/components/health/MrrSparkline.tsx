export function MrrSparkline({ data }: { data: { month: string; mrr: number }[] }) {
  const w = 600;
  const h = 120;
  const pad = 8;
  const max = Math.max(...data.map((d) => d.mrr));
  const min = Math.min(...data.map((d) => d.mrr));
  const range = max - min || 1;
  const step = (w - pad * 2) / (data.length - 1);
  const points = data.map((d, i) => {
    const x = pad + i * step;
    const y = pad + (h - pad * 2) * (1 - (d.mrr - min) / range);
    return [x, y] as const;
  });
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
  const areaPath = `${path} L ${points[points.length - 1][0]} ${h - pad} L ${points[0][0]} ${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-32">
      <defs>
        <linearGradient id="mrrGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#3D9EFF" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#3D9EFF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="mrrLine" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#4CD97B" />
          <stop offset="50%" stopColor="#3D9EFF" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#mrrGrad)" />
      <path d={path} fill="none" stroke="url(#mrrLine)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === points.length - 1 ? 4 : 0} fill="#3D9EFF" />
      ))}
    </svg>
  );
}
