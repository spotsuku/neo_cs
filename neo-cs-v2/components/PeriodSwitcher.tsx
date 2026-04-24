"use client";

import { useState } from "react";
import { periodPerformance, Period, yen } from "@/lib/mock/data";

const periods: { value: Period; label: string }[] = [
  { value: "thisMonth", label: "今月" },
  { value: "thisQuarter", label: "今四半期" },
  { value: "thisFY", label: "今年度" }
];

export function PeriodSwitcher() {
  const [current, setCurrent] = useState<Period>("thisMonth");
  const p = periodPerformance[current];

  return (
    <div className="liquid-surface p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs text-ink-500 font-medium">期間パフォーマンス</div>
          <div className="mt-0.5 text-sm font-semibold text-ink-900">{p.label}</div>
        </div>
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-ink-50 border border-ink-100">
          {periods.map((x) => (
            <button
              key={x.value}
              onClick={() => setCurrent(x.value)}
              className={[
                "px-3 py-1 rounded-full text-xs transition",
                current === x.value
                  ? "bg-white shadow-liquid font-medium"
                  : "text-ink-500 hover:text-ink-700"
              ].join(" ")}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <PeriodKpi label="新規ロゴ" value={`${p.newLogos} 社`} accent="#10B981" />
        <PeriodKpi label="新規契約" value={`${p.newContracts} 件`} accent="#3D9EFF" />
        <PeriodKpi label="更新完了" value={`${p.renewedContracts} 件`} accent="#8B5CF6" />
        <PeriodKpi
          label="チャーン"
          value={`${p.churnedContracts} 件`}
          accent="#EF4444"
          warning={p.churnedContracts > 0}
        />
      </div>

      <div className="mt-4 pt-4 border-t border-ink-100 grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] text-ink-500">期間売上（MRR相当+単発GMV）</div>
          <div className="mt-0.5 text-xl font-bold">{yen(p.grossRevenue)}</div>
        </div>
        <div>
          <div className="text-[10px] text-ink-500">うち単発GMV（AIKEN）</div>
          <div className="mt-0.5 text-xl font-bold">{yen(p.oneshotGmv)}</div>
        </div>
      </div>
    </div>
  );
}

function PeriodKpi({ label, value, accent, warning = false }: { label: string; value: string; accent: string; warning?: boolean }) {
  return (
    <div className="rounded-2xl border border-ink-100 p-3 relative overflow-hidden">
      {warning && (
        <div className="absolute -top-4 -right-4 w-10 h-10 rounded-full opacity-20" style={{ background: accent }} />
      )}
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
        <div className="text-[10px] text-ink-500">{label}</div>
      </div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
}
