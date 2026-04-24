import { renewalFunnel, yen } from "@/lib/mock/data";
import { ProductBadge } from "./ProductBadge";

const stageStyle = {
  committed: { label: "Committed", color: "#10B981", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
  likely: { label: "Likely", color: "#F59E0B", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-100" },
  at_risk: { label: "At Risk", color: "#EF4444", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-100" }
} as const;

export function RenewalFunnel() {
  const totalMrr = renewalFunnel.reduce(
    (acc, s) => acc + s.contracts.reduce((a, c) => a + c.mrr, 0),
    0
  );
  const totalCount = renewalFunnel.reduce((acc, s) => acc + s.contracts.length, 0);

  return (
    <div className="liquid-surface p-6">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-xs text-ink-500 font-medium">更新ファネル（今後90日）</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold">{totalCount}件</span>
            <span className="text-sm text-ink-500">/ MRR {yen(totalMrr)}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {renewalFunnel.map((s) => {
          const style = stageStyle[s.stage];
          const sum = s.contracts.reduce((a, c) => a + c.mrr, 0);
          return (
            <div key={s.stage} className={`rounded-2xl border ${style.border} ${style.bg} p-3`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: style.color }} />
                  <span className={`text-[11px] font-semibold ${style.text}`}>{style.label}</span>
                </div>
                <span className="text-[11px] text-ink-500">{s.contracts.length}件</span>
              </div>
              <div className="mt-1 text-base font-bold text-ink-900">{yen(sum)}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 space-y-1">
        {renewalFunnel
          .flatMap((s) => s.contracts.map((c) => ({ ...c, stage: s.stage })))
          .slice(0, 5)
          .map((c) => {
            const style = stageStyle[c.stage];
            return (
              <div
                key={c.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-ink-50 text-xs"
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: style.color }} />
                <ProductBadge code={c.product} size="sm" />
                <span className="font-medium truncate flex-1">{c.companyName}</span>
                <span className="text-ink-500 shrink-0">{c.endDate}</span>
                <span className="text-ink-700 shrink-0 font-medium w-16 text-right">
                  {yen(c.mrr)}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
