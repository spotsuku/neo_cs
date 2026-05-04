import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { KpiCard } from "@/components/KpiCard";
import { ProductBadge } from "@/components/ProductBadge";
import { MrrSparkline } from "@/components/MrrSparkline";
import { HealthSection } from "@/components/HealthSection";
import { RenewalFunnel } from "@/components/RenewalFunnel";
import { ContinuousProductCard } from "@/components/ContinuousProductCard";
import { OneShotProductCard } from "@/components/OneShotProductCard";
import { PeriodSwitcher } from "@/components/PeriodSwitcher";
import { ChurnAlerts } from "@/components/ChurnAlerts";
import { MyTasksWidget } from "@/components/MyTasksWidget";
import { ExpansionOpportunities } from "@/components/ExpansionOpportunities";
import { KpiExplainButton } from "@/components/KpiExplainButton";
import { allContracts, activeContracts } from "@/lib/mock/onboarding";
import { participants } from "@/lib/mock/participants";
import { upcoming, yen } from "@/lib/mock/data";
import {
  computeMrr,
  computeAtRiskMrr,
  computeMrrTrend,
  formatYen,
  formatPct,
  computeChurnRate,
  computeNrr,
  periodFor
} from "@/lib/domain/kpi";
import { churnSignalRepo } from "@/lib/repository";

const ASOF = "2026-04-24";

export default async function Page() {
  // KPI 算出 (純関数 lib/domain/kpi.ts 経由 — 全画面の正本)
  const mrr = computeMrr(allContracts, ASOF);
  const monthlyTrend = computeMrrTrend(allContracts, 12, ASOF);
  const churnSignals = await churnSignalRepo.list({ unresolvedOnly: true });
  const atRisk = computeAtRiskMrr(allContracts, churnSignals, ASOF);
  const periodLast30 = periodFor("last30d", ASOF);
  const periodLast90 = periodFor("last90d", ASOF);
  const churn30 = computeChurnRate(allContracts, periodLast30);
  const nrr90 = computeNrr(allContracts, periodLast90);
  const activeCompanyCount = new Set(
    activeContracts.map((c) => c.companyId)
  ).size;
  const activeParticipantCount = participants.filter((p) => p.status === "active").length;
  const upcomingRenewalCount = activeContracts.filter((c) => {
    if (!c.endDate) return false;
    const days = (new Date(c.endDate).getTime() - new Date(ASOF).getTime()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 90;
  }).length;
  return (
    <>
      <TopNav current="/" />
      <main className="mx-auto max-w-[1400px] px-6 py-8 space-y-10">
        {/* ヘッダー */}
        <section className="flex items-end justify-between">
          <div>
            <div className="text-xs text-ink-500 font-medium">NEO福岡 カスタマーサクセス</div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              <span className="brand-text-gradient">全体ダッシュボード</span>
            </h1>
            <div className="mt-1 text-sm text-ink-500">2026年4月24日 金曜日 更新</div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/reports"
              className="px-4 py-2 rounded-full bg-white border border-ink-100 text-sm text-ink-700 shadow-liquid hover:bg-ink-50"
            >
              レポート出力
            </Link>
          </div>
        </section>

        {/* ── ① スナップショット（今日時点）────────────────── */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold text-ink-700">スナップショット</h2>
            <span className="text-[11px] text-ink-500">今日時点の状態</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="取引中企業"
              value={`${activeCompanyCount} 社`}
              sub={`継続契約 ${mrr.contractCount} 件`}
              accent="#3D9EFF"
              explain={
                <KpiExplainButton
                  title="取引中企業 / 継続契約"
                  formula="DISTINCT companyId WHERE contract.status ∈ {handoff, onboarding, active, renewal_window}"
                  asOf={ASOF}
                  entries={[
                    { label: "ユニーク企業数", value: `${activeCompanyCount} 社`, highlight: true },
                    { label: "継続契約件数 (MRR有)", value: `${mrr.contractCount} 件` }
                  ]}
                />
              }
            />
            <KpiCard
              label="アクティブ参加者"
              value={`${activeParticipantCount} 名`}
              sub="受講中の総数"
              accent="#4CD97B"
              explain={
                <KpiExplainButton
                  title="アクティブ参加者"
                  formula="COUNT(participant) WHERE participant.status = 'active'"
                  asOf={ASOF}
                  entries={[{ label: "active 参加者", value: `${activeParticipantCount} 名`, highlight: true }]}
                />
              }
            />
            <KpiCard
              label="MRR"
              value={yen(mrr.totalMrr)}
              sub={`ARR ${formatYen(mrr.totalMrr * 12)}`}
              accent="#8B5CF6"
              explain={
                <KpiExplainButton
                  title="MRR (Monthly Recurring Revenue)"
                  formula={mrr.formula}
                  asOf={ASOF}
                  contributingIds={mrr.contributingContractIds}
                  entries={[
                    { label: "合計 MRR", value: yen(mrr.totalMrr), highlight: true },
                    { label: "ARR (× 12)", value: yen(mrr.totalMrr * 12) },
                    { label: "ACADEMIA", value: yen(mrr.byProduct.academia) },
                    { label: "評議会", value: yen(mrr.byProduct.hyogikai) },
                    { label: "コミュマネ", value: yen(mrr.byProduct.commu) },
                    { label: "Large (≥30万/月)", value: yen(mrr.bySegment.large) },
                    { label: "Mid (15-30万/月)", value: yen(mrr.bySegment.mid) },
                    { label: "Small (<15万/月)", value: yen(mrr.bySegment.small) }
                  ]}
                />
              }
            />
            <KpiCard
              label="At-Risk MRR"
              value={yen(atRisk.atRiskMrr)}
              sub={`更新予定 ${upcomingRenewalCount}件（90日内）`}
              accent="#EF4444"
              explain={
                <KpiExplainButton
                  title="At-Risk MRR"
                  formula={atRisk.formula}
                  asOf={ASOF}
                  contributingIds={atRisk.contributingContractIds}
                  entries={[
                    { label: "At-Risk 契約数", value: `${atRisk.highSignalCount} 件` },
                    { label: "At-Risk MRR 合計", value: yen(atRisk.atRiskMrr), highlight: true },
                    { label: "全 MRR", value: yen(mrr.totalMrr) },
                    {
                      label: "比率",
                      value: mrr.totalMrr > 0 ? formatPct(atRisk.atRiskMrr / mrr.totalMrr) : "—"
                    }
                  ]}
                />
              }
            />
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Churn Rate (30日)"
              value={formatPct(churn30.rate, 2)}
              sub={`期初MRR ${yen(churn30.startMrr)}`}
              explain={
                <KpiExplainButton
                  title="Churn Rate (直近30日)"
                  formula={churn30.formula}
                  asOf={ASOF}
                  contributingIds={churn30.churnedContractIds}
                  entries={[
                    { label: "期間", value: `${churn30.period.from} 〜 ${churn30.period.to}` },
                    { label: "期初 MRR", value: yen(churn30.startMrr) },
                    { label: "期間内 churned MRR", value: yen(churn30.churnedMrr) },
                    { label: "Churn Rate", value: formatPct(churn30.rate, 2), highlight: true }
                  ]}
                />
              }
            />
            <KpiCard
              label="NRR (90日)"
              value={formatPct(nrr90.rate, 1)}
              sub={`expansion ${yen(nrr90.expansionMrr)}`}
              explain={
                <KpiExplainButton
                  title="NRR (Net Revenue Retention) 直近90日"
                  formula={nrr90.formula}
                  asOf={ASOF}
                  entries={[
                    { label: "期間", value: `${nrr90.period.from} 〜 ${nrr90.period.to}` },
                    { label: "期初 MRR", value: yen(nrr90.startMrr) },
                    { label: "期末 MRR", value: yen(nrr90.endMrr) },
                    { label: "Expansion (cycle更新増分)", value: `+${yen(nrr90.expansionMrr)}` },
                    { label: "Downgrade", value: `-${yen(nrr90.downgradeMrr)}` },
                    { label: "Churn", value: `-${yen(nrr90.churnedMrr)}` },
                    { label: "NRR", value: formatPct(nrr90.rate, 2), highlight: true }
                  ]}
                />
              }
            />
            <KpiCard
              label="MRR (前月比)"
              value={
                monthlyTrend.length >= 2
                  ? `${monthlyTrend[monthlyTrend.length - 1].mrr - monthlyTrend[monthlyTrend.length - 2].mrr >= 0 ? "+" : ""}${yen(monthlyTrend[monthlyTrend.length - 1].mrr - monthlyTrend[monthlyTrend.length - 2].mrr)}`
                  : "—"
              }
              sub={`今月 ${yen(monthlyTrend[monthlyTrend.length - 1]?.mrr ?? 0)}`}
            />
            <KpiCard
              label="今後90日 更新予定"
              value={`${upcomingRenewalCount} 件`}
              sub="期末日が90日以内"
            />
          </div>
        </section>

        {/* ── ② Customer Health + ③ 更新ファネル ────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <HealthSection />
          <RenewalFunnel />
        </section>

        {/* ── ④ 期間パフォーマンス ────────────────── */}
        <section>
          <PeriodSwitcher />
        </section>

        {/* ── ⑤ MRRトレンド + 直近イベント ────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="liquid-surface p-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-ink-500 font-medium">MRR推移</div>
                <div className="mt-1 text-xl font-bold">{yen(monthlyTrend[monthlyTrend.length - 1]?.mrr ?? 0)}</div>
                <div className="text-xs text-ink-500">過去12ヶ月 (lib/domain/kpi.ts 算出)</div>
              </div>
            </div>
            <div className="mt-4">
              <MrrSparkline data={monthlyTrend} />
            </div>
          </div>

          <div className="liquid-surface p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">直近のイベント</div>
              <span className="text-xs text-ink-500">{upcoming.length} 件</span>
            </div>
            <ul className="mt-4 space-y-3">
              {upcoming.slice(0, 6).map((e) => (
                <li key={e.id} className="flex items-start gap-3">
                  <div className="shrink-0 w-10 text-center">
                    <div className="text-[10px] text-ink-500">
                      {new Date(e.date).toLocaleDateString("ja-JP", { month: "short" })}
                    </div>
                    <div className="text-base font-bold leading-tight">
                      {new Date(e.date).getDate()}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <ProductBadge code={e.product} size="sm" />
                      <span className="text-xs text-ink-500 truncate">{e.companyName}</span>
                    </div>
                    <div className="text-sm mt-0.5 truncate">{e.title}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── あなたの未完了ToDo (Phase2-#2) ─────────────────────── */}
        <section>
          <MyTasksWidget />
        </section>

        {/* ── ⑥ 研修別サマリー（タイプ別レイアウト）──────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-ink-700">研修別サマリー</h2>
            <span className="text-xs text-ink-500">カードクリックで研修別ダッシュボードへ</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <ContinuousProductCard code="academia" />
            <ContinuousProductCard code="hyogikai" />
            <OneShotProductCard code="aiken" />
            <ContinuousProductCard code="commu" />
          </div>
        </section>

        {/* ── ⑦ 解約予兆 + ⑧ エクスパンション機会 (D/F項) ────────────────── */}
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <ChurnAlerts limit={8} />
          <ExpansionOpportunities limit={6} />
        </section>

        {/* フッタ */}
        <footer className="pt-8 pb-4 text-center text-[11px] text-ink-500">
          NEO CS v2 (integration branch) — 仕様ディスカッション用デモ / ダミーデータ
        </footer>
      </main>
    </>
  );
}
