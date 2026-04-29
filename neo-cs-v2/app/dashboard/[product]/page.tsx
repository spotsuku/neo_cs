import Link from "next/link";
import { notFound } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { KpiCard } from "@/components/KpiCard";
import { HealthDistribution } from "@/components/HealthDistribution";
import { MrrSparkline } from "@/components/MrrSparkline";
import { ProductBadge } from "@/components/ProductBadge";
// コース表示に対応
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
  ProductCode,
  hasMultipleCourses,
  productCourses
} from "@/lib/mock/data";
import { companies } from "@/lib/mock/entities";
import { activeContracts, allContracts, productJourney } from "@/lib/mock/onboarding";
import { companyHealthColor } from "@/lib/mock/health";
import {
  surveys as allSurveys,
  aggregateSurvey,
  surveySchedules,
  scheduleById
} from "@/lib/mock/surveys";
import { productAttendanceByAttribute } from "@/lib/mock/participants";

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

        {/* 属性別エンゲージメント */}
        <AttributeEngagementSection code={code} accent={p.accent} />

        {/* コース別サマリー（複数コース研修のみ） */}
        {hasMultipleCourses(code) && <CourseSummarySection code={code} accent={p.accent} />}

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

      {/* NPSセクション（過去90日平均と推移） */}
      <NpsSection code={code} accent={accent} />

      {/* フェーズ別企業数 */}
      <JourneyPhaseSection code={code} accent={accent} />

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
              {targetCompanies.map((c) => {
                const healthColor = companyHealthColor(c.id);
                return (
                <tr key={c.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
                  <td className="px-5 py-3">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ background: healthDotColor[healthColor] }}
                    />
                  </td>
                  <td className="px-3 py-3 font-medium">{c.name}</td>
                  <td className="px-3 py-3 text-ink-700">{c.ownerName}</td>
                  <td className="px-3 py-3">
                    <span
                      className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{
                        color: healthDotColor[healthColor],
                        background: `${healthDotColor[healthColor]}14`
                      }}
                    >
                      {healthColor.toUpperCase()}
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
                );
              })}
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

      {/* フェーズ別企業数 */}
      <JourneyPhaseSection code="aiken" accent={accent} />

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

// コース別サマリー（契約数・参加者・売上）
function CourseSummarySection({ code, accent }: { code: ProductCode; accent: string }) {
  const courses = productCourses[code];
  const contracts = activeContracts.filter((c) => c.product === code);

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-ink-700">コース別サマリー</h2>
        <span className="text-[11px] text-ink-500">契約中の内訳</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {courses.map((course) => {
          const courseContracts = contracts.filter((c) => c.courseKey === course.key);
          const contractCount = courseContracts.length;
          const participantSum = courseContracts.reduce((s, c) => s + c.participants, 0);
          const revenueSum = courseContracts.reduce(
            (s, c) => s + (c.mrr ?? 0) + (c.revenue ?? 0),
            0
          );
          const isContinuous = courseContracts.some((c) => c.mrr !== undefined);
          return (
            <div
              key={course.key}
              className="liquid-surface p-5 relative overflow-hidden"
            >
              <div
                className="absolute -top-4 -right-4 w-24 h-24 rounded-full opacity-10"
                style={{ background: accent }}
              />
              <div className="flex items-center justify-between">
                <div>
                  <div
                    className="text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: accent }}
                  >
                    {course.shortName}
                  </div>
                  <div className="mt-0.5 text-base font-bold text-ink-900">
                    {course.name}
                  </div>
                  {course.description && (
                    <div className="mt-0.5 text-[11px] text-ink-500">
                      {course.description}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[10px] text-ink-500">契約数</div>
                  <div className="mt-0.5 text-xl font-bold" style={{ color: accent }}>
                    {contractCount}
                    <span className="ml-1 text-xs text-ink-500 font-normal">社</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-ink-500">参加者</div>
                  <div className="mt-0.5 text-xl font-bold text-ink-900">
                    {participantSum}
                    <span className="ml-1 text-xs text-ink-500 font-normal">名</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-ink-500">
                    {isContinuous ? "MRR合計" : "売上合計"}
                  </div>
                  <div className="mt-0.5 text-xl font-bold text-ink-900">
                    {yen(revenueSum)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// NPSサマリー（過去90日平均と推移）
function NpsSection({ code, accent }: { code: ProductCode; accent: string }) {
  const productContractIds = new Set(
    allContracts.filter((c) => c.product === code).map((c) => c.id)
  );
  // 当該プロダクトのスケジュール経由 / 旧モデルのcontract経由 どちらでも拾う
  const productSurveys = allSurveys.filter((s) => {
    const sch = scheduleById(s.scheduleId);
    if (sch?.product === code) return true;
    return s.contractId !== undefined && productContractIds.has(s.contractId);
  });
  const aggs = productSurveys
    .map((s) => ({ s, agg: aggregateSurvey(s.id) }))
    .filter((x) => x.agg.npsScore !== undefined)
    .sort((a, b) => (a.s.openedAt < b.s.openedAt ? -1 : 1));

  if (aggs.length === 0) return null;

  // スケジュール別NPS推移
  const schedulesForProduct = surveySchedules.filter((sch) => sch.product === code);
  const bySchedule = schedulesForProduct
    .map((sch) => {
      const items = aggs.filter((x) => x.s.scheduleId === sch.id);
      if (items.length === 0) return null;
      const avg = Math.round(
        items.reduce((sum, x) => sum + (x.agg.npsScore ?? 0), 0) / items.length
      );
      return { schedule: sch, count: items.length, avg };
    })
    .filter((x): x is { schedule: typeof schedulesForProduct[number]; count: number; avg: number } => x !== null);

  // 過去90日平均
  const cutoff = new Date("2026-04-24");
  cutoff.setDate(cutoff.getDate() - 90);
  const recent = aggs.filter((x) => new Date(x.s.openedAt) >= cutoff);
  const recentAvg =
    recent.length > 0
      ? Math.round(
          recent.reduce((sum, x) => sum + (x.agg.npsScore ?? 0), 0) / recent.length
        )
      : null;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-ink-700">NPS（アンケート由来）</h2>
        <Link href="/surveys" className="text-[11px] text-ink-500 hover:text-ink-700">
          アンケート詳細 →
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="liquid-surface p-5">
          <div className="text-xs text-ink-500">過去90日平均</div>
          <div className="mt-1 text-3xl font-bold" style={{ color: accent }}>
            {recentAvg ?? "—"}
          </div>
          <div className="text-[11px] text-ink-500 mt-1">
            {recent.length}件のアンケートから算出
          </div>
        </div>
        <div className="liquid-surface p-5 md:col-span-2">
          <div className="text-xs text-ink-500 mb-3">推移</div>
          <div className="flex items-end gap-2 h-24">
            {aggs.slice(-12).map((x) => {
              const v = x.agg.npsScore ?? 0;
              const h = Math.max(8, ((v + 100) / 200) * 100);
              return (
                <div key={x.s.id} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-[9px] text-ink-700">{v}</div>
                  <div
                    className="w-full rounded-t-md"
                    style={{ height: `${h}%`, background: accent }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {bySchedule.length > 0 && (
        <div className="mt-3 liquid-surface p-5">
          <div className="text-xs text-ink-500 mb-3">スケジュール別NPS平均</div>
          <ul className="space-y-2">
            {bySchedule.map((b) => (
              <li key={b.schedule.id} className="flex items-center gap-3">
                <span className="text-xs text-ink-700 flex-1 truncate">{b.schedule.name}</span>
                <span className="text-[11px] text-ink-500 whitespace-nowrap">{b.count}件</span>
                <span className="text-sm font-bold whitespace-nowrap" style={{ color: accent }}>
                  {b.avg}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function AttributeEngagementSection({
  code,
  accent
}: {
  code: ProductCode;
  accent: string;
}) {
  const seniorityRows = productAttendanceByAttribute(code, "seniority");
  const departmentRows = productAttendanceByAttribute(code, "department")
    .slice()
    .sort((a, b) => b.attendanceRate - a.attendanceRate)
    .slice(0, 5);

  if (seniorityRows.length === 0 && departmentRows.length === 0) return null;

  const seniorityLabel: Record<string, string> = {
    young: "若手",
    mid: "中堅",
    senior: "管理職",
    exec: "役員クラス"
  };

  // 全月をまとめて X 軸にする（過去6ヶ月の推移）
  const allMonths = Array.from(
    new Set(seniorityRows.flatMap((r) => r.trend.map((t) => t.sessionMonth)))
  )
    .sort()
    .slice(-6);

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-ink-700">属性別エンゲージメント</h2>
        <span className="text-[11px] text-ink-500">
          役職階層・部門ごとの出席率
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 役職階層別の出席率推移（線グラフ風） */}
        <div className="liquid-surface p-5">
          <div className="text-xs font-semibold text-ink-700 mb-3">
            役職階層別 出席率推移（過去6ヶ月）
          </div>
          {allMonths.length === 0 ? (
            <div className="text-[11px] text-ink-500">データがまだありません</div>
          ) : (
            <>
              <div className="flex items-end gap-1 h-32 border-b border-l border-ink-100 pb-1 pl-1">
                {allMonths.map((m) => (
                  <div key={m} className="flex-1 flex flex-col items-stretch gap-0.5">
                    <div className="flex-1 flex items-end gap-0.5">
                      {seniorityRows.map((r) => {
                        const t = r.trend.find((x) => x.sessionMonth === m);
                        const v = t?.rate ?? 0;
                        const h = v * 100;
                        const color =
                          r.axisValue === "exec"
                            ? "#8B5CF6"
                            : r.axisValue === "senior"
                            ? accent
                            : r.axisValue === "mid"
                            ? "#10B981"
                            : "#F59E0B";
                        return (
                          <div
                            key={r.axisValue}
                            className="flex-1 rounded-t"
                            style={{
                              height: `${h}%`,
                              background: color,
                              opacity: t ? 0.85 : 0.2
                            }}
                            title={`${seniorityLabel[r.axisValue] ?? r.axisValue} / ${m} / ${Math.round(v * 100)}%`}
                          />
                        );
                      })}
                    </div>
                    <div className="text-[9px] text-ink-500 text-center">
                      {m.slice(2)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-[10px]">
                {seniorityRows.map((r) => {
                  const color =
                    r.axisValue === "exec"
                      ? "#8B5CF6"
                      : r.axisValue === "senior"
                      ? accent
                      : r.axisValue === "mid"
                      ? "#10B981"
                      : "#F59E0B";
                  return (
                    <span key={r.axisValue} className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm"
                        style={{ background: color }}
                      />
                      <span className="text-ink-700">
                        {seniorityLabel[r.axisValue] ?? r.axisValue}
                      </span>
                      <span className="text-ink-500">
                        全体 {Math.round(r.attendanceRate * 100)}%
                      </span>
                    </span>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* 部門別の出席率（上位5） */}
        <div className="liquid-surface p-5">
          <div className="text-xs font-semibold text-ink-700 mb-3">
            部門別 出席率（上位5部門）
          </div>
          {departmentRows.length === 0 ? (
            <div className="text-[11px] text-ink-500">データがまだありません</div>
          ) : (
            <ul className="space-y-2.5">
              {departmentRows.map((r) => (
                <li key={r.axisValue}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-ink-900 font-medium">{r.axisValue}</span>
                    <span className="text-[11px] text-ink-500">
                      {r.participantCount}名 ・ 出席率{" "}
                      <span className="text-ink-900 font-semibold">
                        {Math.round(r.attendanceRate * 100)}%
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-ink-100 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${r.attendanceRate * 100}%`,
                        background: accent
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function JourneyPhaseSection({ code, accent }: { code: ProductCode; accent: string }) {
  const phases = productJourney[code];
  const contractsForProduct = activeContracts.filter((c) => c.product === code);

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-ink-700">フェーズ別企業数</h2>
        <span className="text-[11px] text-ink-500">
          運用中契約のカスタマージャーニー分布
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {phases.map((ph) => {
          const inPhase = contractsForProduct.filter(
            (c) => c.status !== "onboarding" && c.status !== "handoff" && c.currentPhase === ph.key
          );
          const sampleNames = inPhase
            .slice(0, 3)
            .map((c) => companies.find((co) => co.id === c.companyId)?.name ?? "")
            .filter(Boolean);
          return (
            <div
              key={ph.key}
              className="liquid-surface p-4 relative overflow-hidden"
            >
              <div
                className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-10"
                style={{ background: accent }}
              />
              <div className="text-[11px] font-medium text-ink-500">{ph.label}</div>
              <div
                className="mt-1 text-3xl font-bold"
                style={{ color: accent }}
              >
                {inPhase.length}
                <span className="ml-1 text-xs text-ink-500 font-normal">社</span>
              </div>
              <div className="mt-3 space-y-1 min-h-[3.5rem]">
                {sampleNames.length === 0 && (
                  <div className="text-[11px] text-ink-500">—</div>
                )}
                {sampleNames.map((name, i) => (
                  <div key={i} className="text-[11px] text-ink-700 truncate">
                    {name}
                  </div>
                ))}
                {inPhase.length > 3 && (
                  <div className="text-[10px] text-ink-500">他 {inPhase.length - 3} 社</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
