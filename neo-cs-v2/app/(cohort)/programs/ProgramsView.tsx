"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KpiCard } from "@/components/kpi/KpiCard";
import { createProgramTerm } from "./termActions";
import {
  products,
  productByCode,
  productCourses,
  courseShortName,
  hasMultipleCourses,
  type ProductCode
} from "@/lib/mock/data";
import {
  PROGRAM_TERM_STATUS_LABEL,
  type ProgressSummary
} from "@/lib/domain/program";
import type {
  ProgramTerm,
  ProgramTaskTemplate,
  ProgramCompanyTask
} from "@/lib/repository/types";
import { ProgramMatrix, ProgramMatrixLegend } from "./[termId]/ProgramMatrix";
import { CreateTermModal } from "./CreateTermModal";

export type EnrichedTerm = {
  term: ProgramTerm;
  summary: ProgressSummary;
  companyCount: number;
  templateCount: number;
  templates: ProgramTaskTemplate[];
  cells: ProgramCompanyTask[];
  companyIds: string[];
};

export function ProgramsView({
  enriched,
  companyMap,
  users,
  today,
  allowedProductCodes,
  canManageTerm = false
}: {
  enriched: EnrichedTerm[];
  companyMap: Record<string, string>;
  users: { id: string; name: string }[];
  today: string;
  /** 担当事業の productCode 一覧（admin は全 product）。タブ表示の絞り込みに使う */
  allowedProductCodes?: string[];
  /** role_permissions.program_term_manage で許可されているか */
  canManageTerm?: boolean;
}) {
  // 担当事業のうち、最初の product を初期選択（未指定なら academia）
  const visibleProducts =
    allowedProductCodes && allowedProductCodes.length > 0
      ? products.filter((p) => allowedProductCodes.includes(p.code))
      : products;
  const initialProduct = (visibleProducts[0]?.code ?? "academia") as ProductCode;
  const [product, setProduct] = useState<ProductCode>(initialProduct);
  const [closedOpen, setClosedOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, startCreate] = useTransition();
  const router = useRouter();

  const p = productByCode[product];
  const courses = productCourses[product] ?? [];
  const showCourseToggle = hasMultipleCourses(product);

  // 1つの (期 × コーススコープ) に対してテーブルは 1つ。
  // courseFilter = "common" (= 全コース共通) / 特定 courseKey
  const [courseFilter, setCourseFilter] = useState<string>("common");
  // cycleFilter = 数値 (最新期がデフォルト)
  const [cycleFilter, setCycleFilter] = useState<number | null>(null);

  const productTerms = useMemo(
    () => enriched.filter((e) => e.term.productCode === product),
    [enriched, product]
  );

  // この事業に存在する cycleNo 一覧 (昇順)
  const availableCycles = useMemo(() => {
    const set = new Set<number>();
    for (const e of productTerms) {
      if (e.term.cycleNo != null) set.add(e.term.cycleNo);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [productTerms]);

  // contract セルが既に存在する期を「実運用中の期」として優先選択する。
  // (空 program_terms (例: AI研 第10回 など先行作成のみ) を初期表示すると
  //  「データが無い」誤認に繋がるため。)
  const cyclesWithCells = useMemo(() => {
    const set = new Set<number>();
    for (const e of productTerms) {
      if (e.term.cycleNo == null) continue;
      if (e.cells.length > 0) set.add(e.term.cycleNo);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [productTerms]);
  const latestCycle =
    cyclesWithCells.at(-1) ?? availableCycles.at(-1) ?? null;

  // 事業切替・データ更新時に最新期 / 共通へ追従
  const syncRef = `${product}:${latestCycle ?? ""}`;
  const [lastSync, setLastSync] = useState(syncRef);
  if (lastSync !== syncRef) {
    setLastSync(syncRef);
    setCourseFilter("common");
    setCycleFilter(latestCycle);
  }

  const filteredTerms = useMemo(() => {
    return productTerms.filter((e) => {
      // コーススコープ:
      //  - "common" 選択時は courseKey null の term だけ
      //  - 特定コース選択時は「そのコース」または「共通」を両方表示
      if (showCourseToggle) {
        if (courseFilter === "common") {
          if (e.term.courseKey) return false;
        } else {
          if (e.term.courseKey != null && e.term.courseKey !== courseFilter) return false;
        }
      }
      if (cycleFilter != null && e.term.cycleNo !== cycleFilter) return false;
      return true;
    });
  }, [productTerms, courseFilter, cycleFilter, showCourseToggle]);

  const active = useMemo(
    () => filteredTerms.filter((e) => e.term.status === "active" || e.term.status === "draft"),
    [filteredTerms]
  );
  const closed = useMemo(
    () => filteredTerms.filter((e) => e.term.status === "closed" || e.term.status === "archived"),
    [filteredTerms]
  );

  const kpi = useMemo(() => {
    const termCount = active.length;
    const overdueTotal = active.reduce((s, e) => s + e.summary.overdue, 0);
    const totalCompanies = new Set<string>();
    // 概算: 各 term に紐付く会社の合計 (重複は実データから取れないので termごとの合算)
    let companies = 0;
    for (const e of active) companies += e.companyCount;
    totalCompanies.add(""); // placeholder
    const avgPct =
      active.length === 0
        ? 0
        : Math.round(active.reduce((s, e) => s + e.summary.pct, 0) / active.length);
    return { termCount, overdueTotal, companies, avgPct };
  }, [active]);

  return (
    <main className="mx-auto max-w-[1800px] px-4 py-4 space-y-4">
      {/* KPI — 最上段 */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="進行中の期"
          value={`${kpi.termCount} 件`}
          sub="active / draft"
          accent={p.accent}
        />
        <KpiCard
          label="期限切れタスク"
          value={`${kpi.overdueTotal} 件`}
          sub="要即対応"
          accent="#EF4444"
        />
        <KpiCard
          label="対象企業 (延べ)"
          value={`${kpi.companies} 社`}
          sub="進行中の期の合算"
          accent="#3D9EFF"
        />
        <KpiCard
          label="平均進捗率"
          value={`${kpi.avgPct}%`}
          sub="進行中の期の平均"
          accent="#4CD97B"
        />
      </section>

      {/* 事業切替 + コース・期トグル */}
      <section className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-ink-50 border border-ink-100 shrink-0">
          {visibleProducts.map((x) => {
            const activeTab = x.code === product;
            return (
              <button
                key={x.code}
                onClick={() => setProduct(x.code)}
                className={[
                  "px-3 py-1.5 rounded-full text-sm transition flex items-center gap-1.5",
                  activeTab
                    ? "bg-white shadow-liquid font-medium text-ink-900"
                    : "text-ink-500 hover:text-ink-700"
                ].join(" ")}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: x.accent }}
                />
                {x.shortName}
              </button>
            );
          })}
        </div>

        {showCourseToggle && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-500 font-medium">区分:</span>
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-ink-50 border border-ink-100">
              <button
                onClick={() => setCourseFilter("common")}
                className={[
                  "px-3 py-1 rounded-full text-xs transition",
                  courseFilter === "common"
                    ? "bg-white shadow-liquid font-medium text-ink-900"
                    : "text-ink-500 hover:text-ink-700"
                ].join(" ")}
              >
                全コース共通
              </button>
              {courses.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCourseFilter(c.key)}
                  className={[
                    "px-3 py-1 rounded-full text-xs transition",
                    courseFilter === c.key
                      ? "bg-white shadow-liquid font-medium text-ink-900"
                      : "text-ink-500 hover:text-ink-700"
                  ].join(" ")}
                >
                  {c.shortName}
                </button>
              ))}
            </div>
          </div>
        )}

        {availableCycles.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-500 font-medium">期:</span>
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-ink-50 border border-ink-100">
              {availableCycles.map((n) => (
                <button
                  key={n}
                  onClick={() => setCycleFilter(n)}
                  className={[
                    "px-3 py-1 rounded-full text-xs transition",
                    cycleFilter === n
                      ? "bg-white shadow-liquid font-medium text-ink-900"
                      : "text-ink-500 hover:text-ink-700"
                  ].join(" ")}
                >
                  第{n}期
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 進行中の期 — 現在の (期 × 区分) スコープのテーブル */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-ink-700">
              {scopeHeadline({
                p,
                courseFilter,
                courses,
                cycleFilter,
                showCourseToggle
              })}
            </h2>
          </div>
          {canManageTerm && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="text-xs text-ink-500 hover:text-ink-700 underline"
            >
              詳細設定で新規作成…
            </button>
          )}
        </div>
        {active.length === 0 ? (
          <div className="liquid-surface p-10 text-center space-y-3">
            <div className="text-sm text-ink-500">
              このスコープのテーブルはまだありません
            </div>
            {canManageTerm ? (
              <button
                type="button"
                disabled={creating || cycleFilter == null}
                onClick={() => {
                  const courseKey =
                    showCourseToggle && courseFilter !== "common" ? courseFilter : null;
                  const cycleNo = cycleFilter ?? 1;
                  const courseLabel = courseKey
                    ? courseShortName(product, courseKey)
                    : showCourseToggle
                      ? "全コース共通"
                      : "";
                  const label = [p.shortName, courseLabel, `第${cycleNo}期`]
                    .filter(Boolean)
                    .join(" ");
                  startCreate(async () => {
                    const r = await createProgramTerm({
                      productCode: product,
                      courseKey,
                      cycleNo,
                      label
                    });
                    router.refresh();
                    router.push(`/programs/${r.termId}/edit`);
                  });
                }}
                className="text-sm px-4 py-2 rounded-full bg-ink-900 text-white hover:bg-ink-800 disabled:opacity-50"
              >
                {creating ? "作成中…" : "＋ このスコープのテーブルを追加"}
              </button>
            ) : (
              <div className="text-[11px] text-ink-500">
                期 (第◯期 / 第◯回) の作成権限がありません。管理者にお問い合わせください。
              </div>
            )}
            {canManageTerm && cycleFilter == null && (
              <div className="text-[11px] text-ink-400">
                期を選択するか、詳細設定から作成してください
              </div>
            )}
          </div>
        ) : (
          active.map((e) => (
            <TermCard
              key={e.term.id}
              enriched={e}
              companyMap={companyMap}
              users={users}
              today={today}
            />
          ))
        )}
      </section>

      {/* 完了済 */}
      <section>
        <button
          type="button"
          onClick={() => setClosedOpen((v) => !v)}
          className="w-full liquid-surface p-4 flex items-center justify-between hover:bg-ink-50/50"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-ink-700">完了済の期</span>
            <span className="text-xs text-ink-500">{closed.length} 件</span>
          </div>
          <span className="text-ink-500 text-sm">
            {closedOpen ? "閉じる ▲" : "開く ▼"}
          </span>
        </button>
        {closedOpen && (
          <div className="mt-3 space-y-3">
            {closed.length === 0 ? (
              <div className="liquid-surface p-8 text-center text-sm text-ink-500">
                完了済の期はありません
              </div>
            ) : (
              closed.map((e) => (
                <TermCard
                  key={e.term.id}
                  enriched={e}
                  companyMap={companyMap}
                  users={users}
                  today={today}
                />
              ))
            )}
          </div>
        )}
      </section>

      <CreateTermModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        existingTerms={enriched.map((e) => e.term)}
        defaultProductCode={product}
      />
    </main>
  );
}

function scopeHeadline({
  p,
  courseFilter,
  courses,
  cycleFilter,
  showCourseToggle
}: {
  p: { shortName: string };
  courseFilter: string;
  courses: { key: string; shortName: string }[];
  cycleFilter: number | null;
  showCourseToggle: boolean;
}): string {
  const parts: string[] = [p.shortName];
  if (showCourseToggle) {
    if (courseFilter === "common") parts.push("全コース共通");
    else {
      const c = courses.find((x) => x.key === courseFilter);
      if (c) parts.push(c.shortName);
    }
  }
  if (cycleFilter != null) parts.push(`第${cycleFilter}期`);
  return parts.join(" / ");
}

function TermCard({
  enriched,
  companyMap,
  users,
  today
}: {
  enriched: EnrichedTerm;
  companyMap: Record<string, string>;
  users: { id: string; name: string }[];
  today: string;
}) {
  const { term, summary, companyCount, templateCount, templates, cells, companyIds } =
    enriched;
  const product = productByCode[term.productCode];
  const accent = product?.accent ?? "#3D9EFF";

  return (
    <div className="liquid-surface overflow-hidden">
      <div className="w-full p-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-bold text-ink-900 truncate">
              {term.label}
            </span>
            {term.courseKey && hasMultipleCourses(term.productCode as ProductCode) && (
              <span
                className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  color: accent,
                  background: `${accent}14`,
                  border: `1px solid ${accent}33`
                }}
              >
                {courseShortName(term.productCode as ProductCode, term.courseKey)}
              </span>
            )}
            {!term.courseKey && hasMultipleCourses(term.productCode as ProductCode) && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-ink-50 border border-ink-100 text-ink-700">
                全コース共通
              </span>
            )}
            {term.cycleNo != null && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-ink-50 border border-ink-100 text-ink-700">
                第{term.cycleNo}期
              </span>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-ink-50 border border-ink-100 text-ink-600">
              {PROGRAM_TERM_STATUS_LABEL[term.status]}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-500">
            {term.startedAt && (
              <span>
                開始{" "}
                <span className="text-ink-700 font-medium">
                  {term.startedAt.replace(/-/g, "/")}
                </span>
              </span>
            )}
            {term.closedAt && (
              <span>
                終了{" "}
                <span className="text-ink-700 font-medium">
                  {term.closedAt.replace(/-/g, "/")}
                </span>
              </span>
            )}
            <span>
              対象{" "}
              <span className="text-ink-700 font-medium">{companyCount} 社</span>
            </span>
            <span>
              タスク{" "}
              <span className="text-ink-700 font-medium">{templateCount} 種</span>
            </span>
          </div>

          <div className="mt-3">
            <ProgramMatrixLegend />
          </div>
        </div>

        <div className="w-40 shrink-0 text-right">
          <div className="text-[11px] text-ink-500">全体進捗</div>
          <div className="mt-1 text-lg font-bold text-ink-900">
            {summary.done}/{summary.total}
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-ink-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${summary.pct}%`, background: accent }}
            />
          </div>
          {summary.overdue > 0 && (
            <div className="mt-1 text-[11px] text-rose-500 font-medium">
              期日超過 {summary.overdue}件
            </div>
          )}
          <Link
            href={`/programs/${term.id}/edit`}
            className="mt-2 inline-block text-xs px-3 py-1 rounded-full border border-ink-200 text-ink-700 bg-white hover:bg-ink-50"
          >
            ✎ 編集
          </Link>
        </div>
      </div>

      <div className="border-t border-ink-100 p-3 bg-ink-50/30">
        <ProgramMatrix
          termId={term.id}
          templates={templates}
          companyIds={companyIds}
          companyMap={companyMap}
          users={users}
          initialCells={cells}
          today={today}
        />
      </div>
    </div>
  );
}
