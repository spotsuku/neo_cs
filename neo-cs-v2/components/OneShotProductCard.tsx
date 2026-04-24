import { oneShotSummary, productByCode, yen, pct } from "@/lib/mock/data";

export function OneShotProductCard({ code }: { code: "aiken" }) {
  const p = productByCode[code];
  const s = oneShotSummary[code];

  return (
    <button className="liquid-surface p-5 text-left relative overflow-hidden hover:shadow-liquid-lg transition group">
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: p.accent }} />

      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] text-ink-500 font-medium uppercase tracking-wider">単発型</div>
          <div className="mt-0.5 text-base font-bold tracking-tight">{p.shortName}</div>
          <div className="text-[11px] text-ink-500">{p.name}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <div>
          <div className="text-[10px] text-ink-500">開講中コース</div>
          <div className="text-lg font-bold">{s.activeCourses} <span className="text-xs font-normal text-ink-500">コース</span></div>
        </div>
        <div>
          <div className="text-[10px] text-ink-500">現在受講中</div>
          <div className="text-lg font-bold">{s.currentParticipants} <span className="text-xs font-normal text-ink-500">名</span></div>
        </div>
        <div>
          <div className="text-[10px] text-ink-500">今年度GMV</div>
          <div className="text-lg font-bold">{yen(s.fyGmv)}</div>
        </div>
        <div>
          <div className="text-[10px] text-ink-500">今年度修了者</div>
          <div className="text-lg font-bold">{s.fyGraduates} <span className="text-xs font-normal text-ink-500">名</span></div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-ink-100">
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <div className="text-ink-500">修了率</div>
            <div className="font-bold text-ink-900">{pct(s.completionRate)}</div>
          </div>
          <div>
            <div className="text-ink-500">リピート率</div>
            <div className="font-bold text-ink-900">{pct(s.repeatRate)}</div>
          </div>
          <div>
            <div className="text-ink-500">NPS</div>
            <div className="font-bold text-ink-900">{s.nps}</div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px]">
        <span className="text-ink-500">次回開講</span>
        <span className="text-ink-900 font-medium">{s.nextOpeningDate}</span>
      </div>
    </button>
  );
}
