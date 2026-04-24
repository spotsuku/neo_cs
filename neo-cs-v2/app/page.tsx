import { TopNav } from "@/components/TopNav";
import { KpiCard } from "@/components/KpiCard";
import { ProductBadge } from "@/components/ProductBadge";
import { MrrSparkline } from "@/components/MrrSparkline";
import {
  products,
  globalKpi,
  productSummary,
  alerts,
  upcoming,
  mrrTrend,
  yen,
  pct
} from "@/lib/mock/data";

export default function Page() {
  return (
    <>
      <TopNav current="/" />
      <main className="mx-auto max-w-[1400px] px-6 py-8 space-y-8">
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
              期間: 今月
            </button>
            <button className="px-4 py-2 rounded-full bg-ink-900 text-white text-sm shadow-liquid hover:opacity-90">
              レポート出力
            </button>
          </div>
        </section>

        {/* 研修切替タブ */}
        <section>
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-ink-50 border border-ink-100">
            <button className="px-4 py-1.5 rounded-full bg-white shadow-liquid text-sm font-medium">
              全体
            </button>
            {products.map((p) => (
              <button
                key={p.code}
                className="px-4 py-1.5 rounded-full text-sm text-ink-500 hover:text-ink-700"
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle"
                  style={{ background: p.accent }}
                />
                {p.shortName}
              </button>
            ))}
          </div>
        </section>

        {/* 主要KPI */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="契約企業数"
            value={`${globalKpi.totalCompanies} 社`}
            sub="前月比 +3"
            trend={{ value: "+7.7%", direction: "up" }}
            accent="#3D9EFF"
          />
          <KpiCard
            label="アクティブ参加者"
            value={`${globalKpi.totalParticipants} 名`}
            sub="4研修合計"
            trend={{ value: "+12", direction: "up" }}
            accent="#4CD97B"
          />
          <KpiCard
            label="月間 MRR"
            value={yen(globalKpi.mrr)}
            sub={`ARR ${yen(globalKpi.arr)}`}
            trend={{ value: "+1.4%", direction: "up" }}
            accent="#8B5CF6"
          />
          <KpiCard
            label="更新率（直近90日）"
            value={pct(globalKpi.renewalRate)}
            sub="期末迎えた契約ベース"
            trend={{ value: "-2pt", direction: "down" }}
            accent="#FF3D8A"
          />
        </section>

        {/* MRR推移 + 直近イベント */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="liquid-surface p-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-ink-500 font-medium">MRR推移</div>
                <div className="mt-1 text-xl font-bold">{yen(mrrTrend[mrrTrend.length - 1].mrr)}</div>
                <div className="text-xs text-ink-500">過去12ヶ月</div>
              </div>
              <div className="flex items-center gap-2">
                {products.map((p) => (
                  <span key={p.code} className="flex items-center gap-1 text-xs text-ink-500">
                    <span className="w-2 h-2 rounded-full" style={{ background: p.accent }} />
                    {p.shortName}
                  </span>
                ))}
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

        {/* 研修サマリー4枚 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-ink-700">研修別サマリー</h2>
            <span className="text-xs text-ink-500">カードクリックで研修別ダッシュボードへ</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {products.map((p) => {
              const s = productSummary[p.code];
              return (
                <button
                  key={p.code}
                  className="liquid-surface p-5 text-left relative overflow-hidden hover:shadow-liquid-lg transition group"
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ background: p.accent }}
                  />
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs text-ink-500 font-medium">{p.name}</div>
                      <div className="mt-0.5 text-lg font-bold tracking-tight">{p.shortName}</div>
                    </div>
                    {s.alertCount > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-medium border border-rose-100">
                        要対応 {s.alertCount}
                      </span>
                    )}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <div className="text-[10px] text-ink-500">契約</div>
                      <div className="text-base font-bold">{s.contracts} 件</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-ink-500">参加者</div>
                      <div className="text-base font-bold">{s.participants} 名</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-ink-500">MRR</div>
                      <div className="text-base font-bold">{s.mrr ? yen(s.mrr) : "—"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-ink-500">
                        {p.billingMonths ? "更新率" : "リピート率"}
                      </div>
                      <div className="text-base font-bold">{pct(s.renewalRate)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-ink-500">出席率</div>
                      <div className="text-base font-bold">{pct(s.attendance)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-ink-500">NPS</div>
                      <div className="text-base font-bold">{s.nps}</div>
                    </div>
                  </div>

                  <div className="mt-4 text-[10px] text-ink-500">最終更新 {s.updatedAt}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 要対応企業 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-ink-700">🚨 要対応企業（CSリスクアラート）</h2>
            <button className="text-xs text-ink-500 hover:text-ink-700">すべて見る</button>
          </div>
          <div className="liquid-surface overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-ink-500 border-b border-ink-100">
                  <th className="px-5 py-3 font-medium">企業</th>
                  <th className="px-3 py-3 font-medium">研修</th>
                  <th className="px-3 py-3 font-medium">アラート内容</th>
                  <th className="px-3 py-3 font-medium">最終接点</th>
                  <th className="px-3 py-3 font-medium">重要度</th>
                  <th className="px-5 py-3 font-medium w-32"></th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50"
                  >
                    <td className="px-5 py-3 font-medium">{a.companyName}</td>
                    <td className="px-3 py-3">
                      <ProductBadge code={a.product} size="sm" />
                    </td>
                    <td className="px-3 py-3 text-ink-700">{a.reason}</td>
                    <td className="px-3 py-3 text-ink-500">{a.daysSinceLastTouch}日前</td>
                    <td className="px-3 py-3">
                      <span
                        className={[
                          "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                          a.severity === "high"
                            ? "text-rose-600 bg-rose-50 border-rose-100"
                            : a.severity === "mid"
                            ? "text-amber-600 bg-amber-50 border-amber-100"
                            : "text-ink-500 bg-ink-50 border-ink-100"
                        ].join(" ")}
                      >
                        {a.severity === "high" ? "高" : a.severity === "mid" ? "中" : "低"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button className="text-xs text-ink-700 hover:underline">対応する →</button>
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
