import Link from "next/link";
import { TopNavServer } from "@/components/TopNavServer";
import { allContracts } from "@/lib/mock/onboarding";
import { yen } from "@/lib/mock/data";
import {
  computeMrr,
  computeMrrTrend,
  computeChurnRate,
  computeNrr,
  periodFor,
  formatPct
} from "@/lib/domain/kpi";
import { ReportExportButtons } from "./ReportExportButtons";

const ASOF = "2026-04-24";

export default function ReportsPage() {
  const monthlyMrr = computeMrrTrend(allContracts, 12, ASOF);

  const monthlyMetrics = monthlyMrr.map((p, i) => {
    const monthEnd = `${p.month}-28`;
    const churnWindow = periodFor("last30d", monthEnd);
    const nrrWindow = periodFor("last30d", monthEnd);
    const churn = computeChurnRate(allContracts, churnWindow);
    const nrr = computeNrr(allContracts, nrrWindow);
    return {
      month: p.month,
      mrr: p.mrr,
      mrrChange: i > 0 ? p.mrr - monthlyMrr[i - 1].mrr : 0,
      churnRate: churn.rate,
      nrrRate: nrr.rate
    };
  });

  const latestMrr = computeMrr(allContracts, ASOF);
  const latestChurn = computeChurnRate(allContracts, periodFor("last30d", ASOF));
  const latestNrr = computeNrr(allContracts, periodFor("last90d", ASOF));

  return (
    <>
      <TopNavServer current="/reports" />
      <main className="mx-auto max-w-[1720px] px-6 py-8 space-y-6">
        <header className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <div className="text-caption text-neutral-500">
              <Link href="/" className="hover:text-neutral-700">
                ダッシュボード
              </Link>
              <span className="mx-1">/</span>
              <span>レポート</span>
            </div>
            <h1 className="text-xl font-bold text-neutral-900">月次レポート</h1>
            <p className="text-body text-neutral-500">
              MRR / Churn / NRR の月次推移。CSV エクスポートで監査用エビデンスを生成
            </p>
          </div>
          <ReportExportButtons rows={monthlyMetrics} />
        </header>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard label="現在 MRR" value={yen(latestMrr.totalMrr)} />
          <SummaryCard label="現在 ARR" value={yen(latestMrr.totalMrr * 12)} />
          <SummaryCard label="Churn Rate (30日)" value={formatPct(latestChurn.rate, 2)} />
          <SummaryCard label="NRR (90日)" value={formatPct(latestNrr.rate, 1)} />
        </section>

        <section className="surface overflow-hidden">
          <div className="px-5 py-3 border-b border-neutral-100 flex items-baseline justify-between">
            <h2 className="text-h4 font-semibold text-neutral-900">月次トレンド (12ヶ月)</h2>
            <span className="text-caption text-neutral-500">
              算出: lib/domain/kpi.ts (純関数)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-body">
              <thead className="bg-neutral-50 text-caption text-neutral-500">
                <tr>
                  <th className="px-4 py-2 text-left font-normal">月</th>
                  <th className="px-4 py-2 text-right font-normal">MRR</th>
                  <th className="px-4 py-2 text-right font-normal">前月比</th>
                  <th className="px-4 py-2 text-right font-normal">Churn (30日)</th>
                  <th className="px-4 py-2 text-right font-normal">NRR (30日)</th>
                </tr>
              </thead>
              <tbody>
                {monthlyMetrics.map((m, i) => (
                  <tr key={m.month} className="border-t border-neutral-100">
                    <td className="px-4 py-2 text-neutral-900">{m.month}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{yen(m.mrr)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {i === 0 ? (
                        <span className="text-neutral-400">—</span>
                      ) : (
                        <span className={m.mrrChange >= 0 ? "text-success-700" : "text-danger-700"}>
                          {m.mrrChange >= 0 ? "+" : ""}
                          {yen(m.mrrChange)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-neutral-700">
                      {formatPct(m.churnRate, 2)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-neutral-700">
                      {formatPct(m.nrrRate, 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="text-caption text-neutral-500">
          ※ mock データ駆動。Supabase 切替時は kpi_snapshots テーブルを直接 SELECT する想定。
        </p>
      </main>
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface p-4">
      <div className="text-caption text-neutral-500">{label}</div>
      <div className="mt-1 text-metric font-bold text-neutral-900 tabular-nums">
        {value}
      </div>
    </div>
  );
}

export type ReportRow = {
  month: string;
  mrr: number;
  mrrChange: number;
  churnRate: number;
  nrrRate: number;
};
