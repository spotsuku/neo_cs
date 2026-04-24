import { TopNav } from "@/components/TopNav";
import { KpiCard } from "@/components/KpiCard";
import { ProductBadge } from "@/components/ProductBadge";
import { MrrSparkline } from "@/components/MrrSparkline";
import { HealthDistribution } from "@/components/HealthDistribution";
import { RenewalFunnel } from "@/components/RenewalFunnel";
import { ContinuousProductCard } from "@/components/ContinuousProductCard";
import { OneShotProductCard } from "@/components/OneShotProductCard";
import { PeriodSwitcher } from "@/components/PeriodSwitcher";
import {
  snapshot,
  health,
  alerts,
  upcoming,
  mrrTrend,
  yen
} from "@/lib/mock/data";

export default function Page() {
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
            <button className="px-4 py-2 rounded-full bg-white border border-ink-100 text-sm text-ink-700 shadow-liquid hover:bg-ink-50">
              レポート出力
            </button>
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
              value={`${snapshot.activeCompanies} 社`}
              sub={`契約 ${snapshot.activeContracts}件（継続型）`}
              accent="#3D9EFF"
            />
            <KpiCard
              label="アクティブ参加者"
              value={`${snapshot.activeParticipants} 名`}
              sub="受講中の総数"
              accent="#4CD97B"
            />
            <KpiCard
              label="MRR"
              value={yen(snapshot.mrr)}
              sub={`売上規模 ${yen(snapshot.revenueRunRate)}/月`}
              accent="#8B5CF6"
            />
            <KpiCard
              label="At-Risk企業"
              value={`${snapshot.atRiskCount} 社`}
              sub={`更新予定 ${snapshot.openRenewalsIn90d}件（90日内）`}
              accent="#EF4444"
            />
          </div>
        </section>

        {/* ── ② Customer Health + ③ 更新ファネル ────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Health */}
          <div className="liquid-surface p-6">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-xs text-ink-500 font-medium">Customer Health</div>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="text-2xl font-bold">{health.green + health.yellow + health.red}</span>
                  <span className="text-sm text-ink-500">社（継続型）</span>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <HealthDistribution green={health.green} yellow={health.yellow} red={health.red} />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                <div className="text-[10px] font-semibold text-emerald-700">🟢 Green</div>
                <div className="mt-1 text-xl font-bold text-emerald-700">{health.green}</div>
                <div className="text-[10px] text-emerald-700/70">順調</div>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3">
                <div className="text-[10px] font-semibold text-amber-700">🟡 Yellow</div>
                <div className="mt-1 text-xl font-bold text-amber-700">{health.yellow}</div>
                <div className="text-[10px] text-amber-700/70">注意</div>
              </div>
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3">
                <div className="text-[10px] font-semibold text-rose-700">🔴 Red</div>
                <div className="mt-1 text-xl font-bold text-rose-700">{health.red}</div>
                <div className="text-[10px] text-rose-700/70">要対応</div>
              </div>
            </div>

            <div className="mt-4 text-[11px] text-ink-500 leading-relaxed">
              Health Score = 出席率 + NPS + 最終接点日数 + 期日超過タスク + メール感情 から合成。
              単発型(AIKEN)は対象外（別指標で管理）。
            </div>
          </div>

          {/* 更新ファネル */}
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
                <div className="mt-1 text-xl font-bold">{yen(mrrTrend[mrrTrend.length - 1].mrr)}</div>
                <div className="text-xs text-ink-500">過去12ヶ月</div>
              </div>
            </div>
            <div className="mt-4">
              <MrrSparkline data={mrrTrend} />
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

        {/* ── ⑦ 要対応企業 ────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-ink-700">🚨 要対応企業（Health: Red + Yellow）</h2>
            <button className="text-xs text-ink-500 hover:text-ink-700">すべて見る</button>
          </div>
          <div className="liquid-surface overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-ink-500 border-b border-ink-100">
                  <th className="px-5 py-3 font-medium w-4"></th>
                  <th className="px-3 py-3 font-medium">企業</th>
                  <th className="px-3 py-3 font-medium">研修</th>
                  <th className="px-3 py-3 font-medium">アラート内容</th>
                  <th className="px-3 py-3 font-medium">最終接点</th>
                  <th className="px-3 py-3 font-medium">担当</th>
                  <th className="px-3 py-3 font-medium">🤖 AI推奨</th>
                  <th className="px-5 py-3 font-medium w-24"></th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50"
                  >
                    <td className="px-5 py-3">
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ background: a.healthColor === "red" ? "#EF4444" : "#F59E0B" }}
                      />
                    </td>
                    <td className="px-3 py-3 font-medium">{a.companyName}</td>
                    <td className="px-3 py-3">
                      <ProductBadge code={a.product} size="sm" />
                    </td>
                    <td className="px-3 py-3 text-ink-700">{a.reason}</td>
                    <td className="px-3 py-3 text-ink-500 whitespace-nowrap">{a.daysSinceLastTouch}日前</td>
                    <td className="px-3 py-3 text-ink-700 whitespace-nowrap">{a.owner}</td>
                    <td className="px-3 py-3 text-ink-700 text-xs">{a.suggestedAction}</td>
                    <td className="px-5 py-3 text-right">
                      <button className="text-xs text-ink-700 hover:underline whitespace-nowrap">
                        対応する →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* フッタ */}
        <footer className="pt-8 pb-4 text-center text-[11px] text-ink-500">
          NEO CS v2 (integration branch) — 仕様ディスカッション用デモ / ダミーデータ
        </footer>
      </main>
    </>
  );
}
