import Link from "next/link";
import { notFound } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { KpiCard } from "@/components/KpiCard";
import { HealthDistribution } from "@/components/HealthDistribution";
import { MrrSparkline } from "@/components/MrrSparkline";
import { ProductBadge } from "@/components/ProductBadge";
import {
  products,
  productByCode,
  continuousSummary,
  oneShotSummary,
  health,
  mrrTrend,
  yen,
  pct,
  nrrFormat,
  ProductCode
} from "@/lib/mock/data";
import { companies } from "@/lib/mock/entities";

const VALID_CODES: ProductCode[] = ["academia", "hyogikai", "aiken", "commu"];

// ダミーの次回MTG（企業ごと）
const nextMtgByCompany: Record<string, string> = {
  "c-aeon": "2026-04-25",
  "c-nishitetsu": "2026-04-26",
  "c-ffg": "2026-04-28",
  "c-kyudenko": "2026-05-02",
  "c-jrq": "2026-04-30",
  "c-fukugin": "2026-04-28",
  "c-yamae": "2026-05-10",
  "c-toto": "2026-05-08",
  "c-nccb": "2026-05-12",
  "c-saibugas": "2026-05-15",
  "c-fukuokashi": "2026-05-18",
  "c-levias": "2026-05-20"
};

const healthDotColor: Record<string, string> = {
  green: "#10B981",
  yellow: "#F59E0B",
  red: "#EF4444"
};

export default async function ProductDashboard({
  params
}: {
  params: Promise<{ product: string }>;
}) {
  const { product } = await params;
  if (!VALID_CODES.includes(product as ProductCode)) {
    notFound();
  }
  const code = product as ProductCode;
  const p = productByCode[code];
  const targetCompanies = companies.filter((c) => c.contracts.includes(code));

  return (
    <>
      <TopNav current="/dashboard" />
      <main className="mx-auto max-w-[1400px] px-6 py-8 space-y-10">
        {/* ヘッダ */}
        <section>
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs text-ink-500 font-medium">
                <Link href="/" className="hover:text-ink-700">全体ダッシュボード</Link>
                <span>/</span>
                <span>研修別</span>
              </div>
              <h1 className="mt-1 text-3xl font-bold tracking-tight flex items-center gap-3">
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ background: p.accent }}
                />
                <span style={{ color: p.accent }}>{p.name}</span>
              </h1>
              <div className="mt-1 text-sm text-ink-500">
                {p.type === "continuous" ? "継続型研修" : "単発型研修"} ・ セッション {p.sessionCount ?? "—"}回
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 rounded-full bg-white border border-ink-100 text-sm text-ink-700 shadow-liquid hover:bg-ink-50">
                レポート出力
              </button>
            </div>
          </div>

          {/* 研修切替タブ */}
          <div className="mt-6 flex items-center gap-2">
            {products.map((pr) => {
              const active = pr.code === code;
              return (
                <Link
                  key={pr.code}
                  href={`/dashboard/${pr.code}`}
                  className={[
                    "px-4 py-2 rounded-full text-sm transition border",
                    active
                      ? "text-white border-transparent"
                      : "bg-white text-ink-700 border-ink-100 hover:bg-ink-50"
                  ].join(" ")}
                  style={
                    active
                      ? { background: pr.accent, borderColor: pr.accent }
                      : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: active ? "#fff" : pr.accent }}
                    />
                    {pr.shortName}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {p.type === "continuous" ? (
          <ContinuousView code={code as "academia" | "hyogikai" | "commu"} targetCompanies={targetCompanies} accent={p.accent} />
        ) : (
          <OneShotView targetCompanies={targetCompanies} accent={p.accent} />
        )}

        <footer className="pt-8 pb-4 text-center text-[11px] text-ink-500">
          NEO CS v2 — 研修別ダッシュボード / ダミーデータ
        </footer>
      </main>
    </>
  );
}

function ContinuousView({
  code,
  targetCompanies,
  accent
}: {
  code: "academia" | "hyogikai" | "commu";
  targetCompanies: typeof companies;
  accent: string;
}) {
  const s = continuousSummary[code];
  const h = health.byProduct[code];

  // ダミーMRR推移（全体MRRを契約数で比例させる）
  const localTrend = mrrTrend.map((m, i) => ({
    month: m.month,
    mrr: Math.round((m.mrr * s.mrr) / 8_420_000)
  }));

  return (
    <>
      {/* KPIs */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold text-ink-700">サマリー</h2>
          <span className="text-[11px] text-ink-500">{s.updatedAt} 更新</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <KpiCard label="アクティブ契約" value={`${s.activeContracts} 件`} accent={accent} />
          <KpiCard label="参加者" value={`${s.activeParticipants} 名`} accent={accent} />
          <KpiCard label="MRR" value={yen(s.mrr)} accent={accent} />
          <KpiCard label="NRR" value={nrrFormat(s.nrr)} sub="Net Revenue Retention" accent={accent} />
          <KpiCard label="更新率" value={pct(s.renewalRate)} sub="直近90日" accent={accent} />
          <KpiCard label="出席率" value={pct(s.attendance)} accent={accent} />
        </div>
      </section>

      {/* Health + MRR */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="liquid-surface p-6">
          <div className="text-sm font-semibold mb-4">Customer Health分布</div>
          <HealthDistribution green={h.green} yellow={h.yellow} red={h.red} />
          <div className="mt-4 text-xs text-ink-500">
            合計 {h.green + h.yellow + h.red} 社（この研修の契約企業）
          </div>
        </div>
        <div className="liquid-surface p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-ink-500 font-medium">MRR推移</div>
              <div className="mt-1 text-xl font-bold">{yen(s.mrr)}</div>
              <div className="text-xs text-ink-500">過去12ヶ月</div>
            </div>
          </div>
          <div className="mt-4">
            <MrrSparkline data={localTrend} />
          </div>
        </div>
      </section>

      {/* 契約中企業 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-ink-700">契約中企業（{targetCompanies.length} 社）</h2>
        </div>
        <div className="liquid-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-ink-500 border-b border-ink-100">
                <th className="px-5 py-3 font-medium w-4"></th>
                <th className="px-3 py-3 font-medium">企業名</th>
                <th className="px-3 py-3 font-medium">担当</th>
                <th className="px-3 py-3 font-medium">Health</th>
                <th className="px-3 py-3 font-medium">MRR</th>
                <th className="px-3 py-3 font-medium">次回MTG予定</th>
                <th className="px-5 py-3 font-medium w-24"></th>
              </tr>
            </thead>
            <tbody>
              {targetCompanies.map((c) => (
                <tr key={c.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
                  <td className="px-5 py-3">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ background: healthDotColor[c.healthColor] }}
                    />
                  </td>
                  <td className="px-3 py-3 font-medium">{c.name}</td>
                  <td className="px-3 py-3 text-ink-700">{c.ownerName}</td>
                  <td className="px-3 py-3">
                    <span
                      className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{
                        color: healthDotColor[c.healthColor],
                        background: `${healthDotColor[c.healthColor]}14`
                      }}
                    >
                      {c.healthColor.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-ink-700">{yen(c.mrr)}</td>
                  <td className="px-3 py-3 text-ink-500 whitespace-nowrap">
                    {nextMtgByCompany[c.id] ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button className="text-xs text-ink-700 hover:underline whitespace-nowrap">
                      詳細 →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function OneShotView({
  targetCompanies,
  accent
}: {
  targetCompanies: typeof companies;
  accent: string;
}) {
  const s = oneShotSummary.aiken;

  // コース別ダミー
  const courses = [
    { id: "c1", name: "基礎コース", participants: 112, progress: 0.64, attendance: 0.91 },
    { id: "c2", name: "応用コース", participants: 74, progress: 0.38, attendance: 0.86 }
  ];

  return (
    <>
      {/* KPIs */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold text-ink-700">サマリー</h2>
          <span className="text-[11px] text-ink-500">{s.updatedAt} 更新</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <KpiCard label="開講中コース" value={`${s.activeCourses} 本`} accent={accent} />
          <KpiCard label="受講中" value={`${s.currentParticipants} 名`} accent={accent} />
          <KpiCard label="今年度GMV" value={yen(s.fyGmv)} accent={accent} />
          <KpiCard label="今年度修了者" value={`${s.fyGraduates} 名`} accent={accent} />
          <KpiCard label="修了率" value={pct(s.completionRate)} accent={accent} />
          <KpiCard label="リピート率" value={pct(s.repeatRate)} accent={accent} />
        </div>
      </section>

      {/* コース別進行状況 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-ink-700">コース別 進行状況</h2>
          <span className="text-[11px] text-ink-500">次回開講 {s.nextOpeningDate}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courses.map((c) => (
            <div key={c.id} className="liquid-surface p-6">
              <div className="flex items-center justify-between">
                <div className="text-base font-semibold">{c.name}</div>
                <span className="liquid-chip">開講中</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-[11px] text-ink-500">受講者</div>
                  <div className="mt-1 text-lg font-bold">{c.participants} 名</div>
                </div>
                <div>
                  <div className="text-[11px] text-ink-500">進捗率</div>
                  <div className="mt-1 text-lg font-bold">{pct(c.progress)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-ink-500">平均出席率</div>
                  <div className="mt-1 text-lg font-bold">{pct(c.attendance)}</div>
                </div>
              </div>
              <div className="mt-4">
                <div className="h-2 w-full rounded-full bg-ink-50 overflow-hidden">
                  <div
                    className="h-full"
                    style={{ width: `${Math.round(c.progress * 100)}%`, background: accent }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 受講企業 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-ink-700">受講企業（{targetCompanies.length} 社）</h2>
        </div>
        <div className="liquid-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-ink-500 border-b border-ink-100">
                <th className="px-5 py-3 font-medium">企業名</th>
                <th className="px-3 py-3 font-medium">担当</th>
                <th className="px-3 py-3 font-medium">受講コース</th>
                <th className="px-3 py-3 font-medium">派遣人数</th>
                <th className="px-3 py-3 font-medium">進捗</th>
                <th className="px-5 py-3 font-medium w-24"></th>
              </tr>
            </thead>
            <tbody>
              {targetCompanies.map((c, idx) => (
                <tr key={c.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
                  <td className="px-5 py-3 font-medium">{c.name}</td>
                  <td className="px-3 py-3 text-ink-700">{c.ownerName}</td>
                  <td className="px-3 py-3">
                    <span className="liquid-chip">{idx % 2 === 0 ? "基礎コース" : "応用コース"}</span>
                  </td>
                  <td className="px-3 py-3 text-ink-700">{3 + (idx % 4)} 名</td>
                  <td className="px-3 py-3 text-ink-700">{40 + ((idx * 13) % 50)}%</td>
                  <td className="px-5 py-3 text-right">
                    <button className="text-xs text-ink-700 hover:underline whitespace-nowrap">
                      詳細 →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
