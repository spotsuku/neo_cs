import Link from "next/link";
import { notFound } from "next/navigation";
import { TopNavServer } from "@/components/TopNavServer";
import { programRepo, companyRepo, userRepo } from "@/lib/repository";
import { productByCode, courseShortName, hasMultipleCourses } from "@/lib/mock/data";
import { summarizeProgress } from "@/lib/domain/program";
import { ProgramMatrix, ProgramMatrixLegend } from "./ProgramMatrix";

export const dynamic = "force-dynamic";

const TODAY = new Date().toISOString().slice(0, 10);

export default async function ProgramTermPage({
  params
}: {
  params: Promise<{ termId: string }>;
}) {
  const { termId } = await params;
  const term = await programRepo.getTerm(termId);
  if (!term) notFound();

  const [templates, cells, companies, users] = await Promise.all([
    programRepo.listTemplates(termId),
    programRepo.listCells(termId),
    companyRepo.list(),
    userRepo.list({ activeOnly: true })
  ]);

  const companyIds = Array.from(new Set(cells.map((c) => c.companyId)));
  const companyMap = new Map(companies.map((c) => [c.id, c.name]));
  const summary = summarizeProgress(cells, TODAY);

  const product = productByCode[term.productCode];
  const accent = product?.accent ?? "#3D9EFF";

  return (
    <>
      <TopNavServer current="/programs" />
      <main className="mx-auto max-w-[1600px] px-6 py-8 space-y-6">
        <header className="space-y-1">
          <div className="text-xs text-ink-500">
            <Link href="/" className="hover:text-ink-700">
              ダッシュボード
            </Link>
            <span className="mx-1">/</span>
            <Link href="/programs" className="hover:text-ink-700">
              事業内ToDo
            </Link>
            <span className="mx-1">/</span>
            <span>{term.label}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-ink-900">{term.label}</h1>
            <span
              className="text-[12px] font-medium px-2.5 py-0.5 rounded-full"
              style={{
                color: accent,
                background: `${accent}14`,
                border: `1px solid ${accent}33`
              }}
            >
              {product?.shortName ?? term.productCode}
            </span>
            {term.courseKey && hasMultipleCourses(term.productCode as any) && (
              <span className="text-[12px] px-2.5 py-0.5 rounded-full bg-ink-50 border border-ink-100 text-ink-700">
                {courseShortName(term.productCode as any, term.courseKey)}
              </span>
            )}
            {term.cycleNo != null && (
              <span className="text-[12px] px-2.5 py-0.5 rounded-full bg-ink-50 border border-ink-100 text-ink-700">
                第{term.cycleNo}期
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-ink-500">
              縦軸=企業 / 横軸=タスク。セルをクリックでステータス変更
            </p>
            <Link
              href={`/programs/${term.id}/edit`}
              className="text-xs px-3 py-1.5 rounded-full border border-ink-200 text-ink-700 hover:bg-ink-50"
            >
              ✎ 編集
            </Link>
          </div>
        </header>

        {/* KPI */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiBox label="対象企業" value={`${companyIds.length} 社`} accent={accent} />
          <KpiBox label="タスク種" value={`${templates.length} 種`} accent={accent} />
          <KpiBox
            label="進捗"
            value={`${summary.pct}%`}
            sub={`${summary.done}/${summary.total}`}
            accent={accent}
          />
          <KpiBox
            label="期限切れ"
            value={`${summary.overdue} 件`}
            accent="#EF4444"
          />
        </section>

        <ProgramMatrixLegend />

        <ProgramMatrix
          termId={term.id}
          templates={templates}
          companyIds={companyIds}
          companyMap={Object.fromEntries(companyMap)}
          users={users.map((u) => ({ id: u.id, name: u.name }))}
          initialCells={cells}
          today={TODAY}
        />
      </main>
    </>
  );
}

function KpiBox({
  label,
  value,
  sub,
  accent
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="liquid-surface p-4">
      <div className="text-[11px] text-ink-500 font-medium">{label}</div>
      <div className="mt-1 text-2xl font-bold" style={{ color: accent }}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-ink-500 mt-0.5">{sub}</div>}
    </div>
  );
}
