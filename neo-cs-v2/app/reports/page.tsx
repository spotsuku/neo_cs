import Link from "next/link";
import { TopNav } from "@/components/TopNav";

type ReportFormat = "PDF" | "Excel" | "CSV";

type ReportTemplate = {
  id: string;
  title: string;
  description: string;
  icon: string;
  accent: string;
  lastExportedAt: string;
  formats: ReportFormat[];
};

type HistoryItem = {
  exportedAt: string;
  reportName: string;
  period: string;
  format: ReportFormat;
  exportedBy: string;
};

const templates: ReportTemplate[] = [
  {
    id: "monthly-cs",
    title: "月次CS定例レポート",
    description: "活動サマリー・主要KPI・ハイライトをまとめた定例報告書",
    icon: "📊",
    accent: "#3D9EFF",
    lastExportedAt: "2026-04-15 10:23",
    formats: ["PDF", "Excel"]
  },
  {
    id: "exec-kpi",
    title: "経営向けKPIサマリー",
    description: "売上・解約率・NRR・継続率を1枚にまとめた経営報告資料",
    icon: "📈",
    accent: "#8B5CF6",
    lastExportedAt: "2026-04-10 18:02",
    formats: ["PDF"]
  },
  {
    id: "mrr-trend",
    title: "MRR推移詳細",
    description: "月次のMRR・新規・解約・拡張・縮小をブレイクダウン",
    icon: "💹",
    accent: "#4CD97B",
    lastExportedAt: "2026-04-20 09:11",
    formats: ["Excel", "CSV"]
  },
  {
    id: "training-result",
    title: "研修別実績",
    description: "4研修ごとの契約数・受講者数・満足度・更新率",
    icon: "🎓",
    accent: "#FF9838",
    lastExportedAt: "2026-04-18 14:48",
    formats: ["PDF", "Excel"]
  },
  {
    id: "at-risk",
    title: "At-Risk企業リスト",
    description: "解約懸念のある企業をスコア順に抽出（理由付き）",
    icon: "⚠️",
    accent: "#F43F5E",
    lastExportedAt: "2026-04-22 08:30",
    formats: ["Excel", "CSV"]
  },
  {
    id: "renewal-pipeline",
    title: "更新パイプライン",
    description: "今後3ヶ月の更新予定企業・ステータス・予測金額",
    icon: "🔄",
    accent: "#06B6D4",
    lastExportedAt: "2026-04-19 16:05",
    formats: ["PDF", "Excel", "CSV"]
  }
];

const history: HistoryItem[] = [
  { exportedAt: "2026-04-22 08:30", reportName: "At-Risk企業リスト", period: "2026/04", format: "Excel", exportedBy: "古野 健太" },
  { exportedAt: "2026-04-20 09:11", reportName: "MRR推移詳細", period: "2026/01-04", format: "Excel", exportedBy: "佐藤 美咲" },
  { exportedAt: "2026-04-19 16:05", reportName: "更新パイプライン", period: "2026/05-07", format: "PDF", exportedBy: "古野 健太" },
  { exportedAt: "2026-04-18 14:48", reportName: "研修別実績", period: "2026/Q1", format: "PDF", exportedBy: "山田 拓海" },
  { exportedAt: "2026-04-15 10:23", reportName: "月次CS定例レポート", period: "2026/03", format: "PDF", exportedBy: "佐藤 美咲" },
  { exportedAt: "2026-04-12 11:40", reportName: "MRR推移詳細", period: "2026/03", format: "CSV", exportedBy: "古野 健太" },
  { exportedAt: "2026-04-10 18:02", reportName: "経営向けKPIサマリー", period: "2026/Q1", format: "PDF", exportedBy: "鈴木 一郎" },
  { exportedAt: "2026-04-08 09:55", reportName: "At-Risk企業リスト", period: "2026/03", format: "CSV", exportedBy: "山田 拓海" },
  { exportedAt: "2026-04-05 13:21", reportName: "研修別実績", period: "2026/03", format: "Excel", exportedBy: "佐藤 美咲" },
  { exportedAt: "2026-04-01 17:08", reportName: "月次CS定例レポート", period: "2026/02", format: "PDF", exportedBy: "古野 健太" }
];

const formatBadgeStyle: Record<ReportFormat, string> = {
  PDF: "bg-rose-50 text-rose-600 border-rose-100",
  Excel: "bg-emerald-50 text-emerald-600 border-emerald-100",
  CSV: "bg-sky-50 text-sky-600 border-sky-100"
};

export default function ReportsPage() {
  return (
    <>
      <TopNav current="/" />
      <main className="mx-auto max-w-[1400px] px-6 py-8 space-y-8">
        <section>
          <div className="text-xs text-ink-500 font-medium">
            <Link href="/" className="hover:text-ink-700">ホーム</Link>
            <span className="mx-1.5">/</span>
            <span className="text-ink-700">レポート出力</span>
          </div>
          <div className="mt-2 flex items-end justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                <span className="brand-text-gradient">レポート出力</span>
              </h1>
              <div className="mt-1 text-sm text-ink-500">
                定型レポートを選択して PDF / Excel / CSV で出力できます
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 rounded-full border border-ink-100 text-sm text-ink-700 hover:bg-ink-50">
                テンプレート編集
              </button>
              <button className="px-4 py-2 rounded-full bg-ink-900 text-white text-sm hover:bg-ink-700 shadow-liquid">
                + カスタムレポート
              </button>
            </div>
          </div>
        </section>

        <section>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((t) => (
              <div
                key={t.id}
                className="liquid-surface p-6 relative overflow-hidden hover:shadow-liquid-lg transition group flex flex-col"
              >
                <div
                  className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-10 group-hover:opacity-20 transition"
                  style={{ background: t.accent }}
                />
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                    style={{ background: `${t.accent}14` }}
                  >
                    {t.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-ink-900">{t.title}</div>
                    <div className="mt-0.5 text-xs text-ink-500 leading-relaxed">{t.description}</div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-1.5">
                  {t.formats.map((f) => (
                    <span
                      key={f}
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${formatBadgeStyle[f]}`}
                    >
                      {f}
                    </span>
                  ))}
                </div>

                <div className="mt-4 text-[11px] text-ink-500">
                  最終出力日: <span className="text-ink-700 font-medium">{t.lastExportedAt}</span>
                </div>

                <div className="mt-5 pt-4 border-t border-ink-100/60 flex items-center justify-between gap-2">
                  <Link
                    href="#"
                    className="text-xs text-ink-500 hover:text-ink-700"
                  >
                    プレビュー →
                  </Link>
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1.5 rounded-full border border-ink-100 text-xs text-ink-700 hover:bg-ink-50">
                      設定
                    </button>
                    <button className="px-4 py-2 rounded-full bg-ink-900 text-white text-sm hover:bg-ink-700 shadow-liquid">
                      出力
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="liquid-surface p-6">
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink-900">出力履歴</h2>
              <div className="mt-0.5 text-xs text-ink-500">直近10件のレポート出力ログ</div>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 rounded-full border border-ink-100 text-sm text-ink-700 hover:bg-ink-50">
                全件表示
              </button>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-ink-500 border-b border-ink-100">
                  <th className="font-medium py-2 pr-4">日時</th>
                  <th className="font-medium py-2 pr-4">レポート名</th>
                  <th className="font-medium py-2 pr-4">期間</th>
                  <th className="font-medium py-2 pr-4">形式</th>
                  <th className="font-medium py-2 pr-4">出力者</th>
                  <th className="font-medium py-2 pr-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr
                    key={i}
                    className="border-b border-ink-100/60 hover:bg-ink-50/40 transition"
                  >
                    <td className="py-3 pr-4 text-ink-700 whitespace-nowrap">{h.exportedAt}</td>
                    <td className="py-3 pr-4 text-ink-900 font-medium">{h.reportName}</td>
                    <td className="py-3 pr-4 text-ink-700 whitespace-nowrap">{h.period}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${formatBadgeStyle[h.format]}`}
                      >
                        {h.format}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-ink-700 whitespace-nowrap">{h.exportedBy}</td>
                    <td className="py-3 pr-4 text-right">
                      <Link
                        href="#"
                        className="text-xs text-ink-500 hover:text-ink-900"
                      >
                        ダウンロード ↓
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="pt-8 pb-4 text-center text-[11px] text-ink-500">
          NEO CS v2 — レポート / ダミーデータ
        </footer>
      </main>
    </>
  );
}
