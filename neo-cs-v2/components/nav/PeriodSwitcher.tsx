"use client";

// 期間パフォーマンス (今月/今四半期/今年度)
//
// reviews/06_財務経理.md 「Q1値とFY値が同一」の不具合を解消するため、
// すべての値を lib/domain/kpi.ts の純関数で算出する。
// Q1 と FY は from/to が別物 (kpi.periodFor) になり、結果も別になる。

import { useMemo, useState } from "react";
import type { ActiveContract } from "@/lib/mock/onboarding";
import { yen } from "@/lib/mock/data";
import {
  computePeriodPerformance,
  periodFor,
  type PeriodKey
} from "@/lib/domain/kpi/kpi";
import { KpiExplainButton } from "../kpi/KpiExplainButton";

const ASOF = "2026-04-24";

const periods: { value: PeriodKey; label: string }[] = [
  { value: "thisMonth", label: "今月" },
  { value: "thisQuarter", label: "今四半期" },
  { value: "thisFY", label: "今年度" }
];

export function PeriodSwitcher({ contracts }: { contracts: ActiveContract[] }) {
  const [current, setCurrent] = useState<PeriodKey>("thisMonth");
  const breakdown = useMemo(() => {
    const window = periodFor(current, ASOF);
    return computePeriodPerformance(contracts, window);
  }, [current, contracts]);

  return (
    <div className="liquid-surface p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-3">
          <div>
            <div className="text-caption text-neutral-500 font-medium">期間パフォーマンス</div>
            <div className="mt-0.5 text-body font-semibold text-neutral-900">
              {breakdown.period.label}
            </div>
            <div className="text-caption text-neutral-500">
              {breakdown.period.from} 〜 {breakdown.period.to} (前日まで)
            </div>
          </div>
          <KpiExplainButton
            title={`期間パフォーマンス: ${breakdown.period.label}`}
            formula={breakdown.formula}
            asOf={ASOF}
            entries={[
              { label: "新規ロゴ", value: `${breakdown.newLogos} 社` },
              { label: "新規契約", value: `${breakdown.newContracts} 件` },
              { label: "更新完了", value: `${breakdown.renewedContracts} 件` },
              { label: "チャーン", value: `${breakdown.churnedContracts} 件` },
              { label: "期末MRR", value: yen(breakdown.grossMrrAtEnd), highlight: true },
              {
                label: "期間内 MRR 純増減",
                value: `${breakdown.netMrrChange >= 0 ? "+" : ""}${yen(breakdown.netMrrChange)}`
              }
            ]}
          />
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
        <PeriodKpi label="新規ロゴ" value={`${breakdown.newLogos} 社`} accent="#10B981" />
        <PeriodKpi label="新規契約" value={`${breakdown.newContracts} 件`} accent="#3D9EFF" />
        <PeriodKpi label="更新完了" value={`${breakdown.renewedContracts} 件`} accent="#8B5CF6" />
        <PeriodKpi
          label="チャーン"
          value={`${breakdown.churnedContracts} 件`}
          accent="#EF4444"
          warning={breakdown.churnedContracts > 0}
        />
      </div>

      <div className="mt-4 pt-4 border-t border-ink-100 grid grid-cols-2 gap-3">
        <div>
          <div className="text-caption text-neutral-500">期末MRR</div>
          <div className="mt-0.5 text-h2 font-bold">{yen(breakdown.grossMrrAtEnd)}</div>
        </div>
        <div>
          <div className="text-caption text-neutral-500">期間内 純増減</div>
          <div
            className={`mt-0.5 text-h2 font-bold ${breakdown.netMrrChange >= 0 ? "text-success-700" : "text-danger-700"}`}
          >
            {breakdown.netMrrChange >= 0 ? "+" : ""}
            {yen(breakdown.netMrrChange)}
          </div>
        </div>
      </div>
    </div>
  );
}

function PeriodKpi({
  label,
  value,
  accent,
  warning = false
}: {
  label: string;
  value: string;
  accent: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-ink-100 p-3 relative overflow-hidden">
      {warning && (
        <div
          aria-hidden
          className="absolute -top-4 -right-4 w-10 h-10 rounded-full opacity-20"
          style={{ background: accent }}
        />
      )}
      <div className="flex items-center gap-1.5">
        <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
        <div className="text-caption text-neutral-500">{label}</div>
      </div>
      <div className="mt-1 text-h3 font-bold">{value}</div>
    </div>
  );
}
