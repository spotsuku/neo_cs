"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { KpiCard } from "@/components/KpiCard";
import {
  products,
  productByCode,
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
  allowedProductCodes
}: {
  enriched: EnrichedTerm[];
  companyMap: Record<string, string>;
  users: { id: string; name: string }[];
  today: string;
  /** 担当事業の productCode 一覧（admin は全 product）。タブ表示の絞り込みに使う */
  allowedProductCodes?: string[];
}) {
  // 担当事業のうち、最初の product を初期選択（未指定なら academia）
  const visibleProducts =
    allowedProductCodes && allowedProductCodes.length > 0
      ? products.filter((p) => allowedProductCodes.includes(p.code))
      : products;
  const initialProduct = (visibleProducts[0]?.code ?? "academia") as ProductCode;
  const [product, setProduct] = useState<ProductCode>(initialProduct);
  const [closedOpen, setClosedOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);

  function toggleExpanded(termId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(termId)) next.delete(termId);
      else next.add(termId);
      return next;
    });
  }

  const p = productByCode[product];

  const productTerms = useMemo(
    () => enriched.filter((e) => e.term.productCode === product),
    [enriched, product]
  );

  const active = useMemo(
    () => productTerms.filter((e) => e.term.status === "active" || e.term.status === "draft"),
    [productTerms]
  );
  const closed = useMemo(
    () => productTerms.filter((e) => e.term.status === "closed" || e.term.status === "archived"),
    [productTerms]
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
    <main className="mx-auto max-w-[1400px] px-6 py-8 space-y-8">
      {/* ヘッダ */}
      <section className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs text-ink-500 font-medium">事業 / コース / 期 単位の定期タスク</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight flex items-center gap-3">
            <span className="brand-text-gradient">事業内ToDo</span>
            <span
              className="text-base font-semibold px-3 py-1 rounded-full border"
              style={{
                color: p.accent,
                borderColor: `${p.accent}44`,
                background: `${p.accent}0F`
              }}
            >
              {p.shortName}
            </span>
          </h1>
          <div className="mt-1 text-sm text-ink-500">
            企業×タスクのマトリクスで進捗を一覧管理
          </div>
        </div>

        {/* 研修切替 */}
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
      </section>

      {/* KPI */}
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

      {/* 進行中の期 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-ink-700">進行中の期</h2>
            <span className="text-xs text-ink-500">{active.length} 件</span>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="text-xs px-3 py-1.5 rounded-full bg-ink-900 text-white hover:bg-ink-800"
          >
            + 新しい期を作成
          </button>
        </div>
        {active.length === 0 ? (
          <div className="liquid-surface p-10 text-center text-sm text-ink-500">
            この事業に進行中の期はありません
          </div>
        ) : (
          active.map((e) => (
            <TermCard
              key={e.term.id}
              enriched={e}
              isOpen={expanded.has(e.term.id)}
              onToggle={() => toggleExpanded(e.term.id)}
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
                  isOpen={expanded.has(e.term.id)}
                  onToggle={() => toggleExpanded(e.term.id)}
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

function TermCard({
  enriched,
  isOpen,
  onToggle,
  companyMap,
  users,
  today
}: {
  enriched: EnrichedTerm;
  isOpen: boolean;
  onToggle: () => void;
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
      {/* ヘッダ (クリックで開閉) */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-5 text-left hover:bg-ink-50/40 transition flex items-start justify-between gap-4"
        aria-expanded={isOpen}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={[
                "shrink-0 text-ink-400 transition-transform",
                isOpen ? "rotate-90" : ""
              ].join(" ")}
              aria-hidden
            >
              ▶
            </span>
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
            {term.cycleNo != null && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-ink-50 border border-ink-100 text-ink-700">
                第{term.cycleNo}期
              </span>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-ink-50 border border-ink-100 text-ink-600">
              {PROGRAM_TERM_STATUS_LABEL[term.status]}
            </span>
          </div>

          <div className="mt-2 ml-6 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-500">
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

          {/* 展開時のみ凡例を表示 (メタ情報のすぐ下、余白を活用) */}
          {isOpen && (
            <div className="mt-3 ml-6">
              <ProgramMatrixLegend />
            </div>
          )}
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
        </div>
      </button>

      {/* 展開時にマトリクスを inline 表示 */}
      {isOpen && (
        <div className="border-t border-ink-100 p-4 space-y-3 bg-ink-50/30">
          <div className="flex items-center justify-between">
            <div className="text-xs text-ink-500">企業×タスクのマトリクス</div>
            <Link
              href={`/programs/${term.id}/edit`}
              className="text-xs px-3 py-1.5 rounded-full border border-ink-200 text-ink-700 bg-white hover:bg-ink-50"
            >
              ✎ 編集
            </Link>
          </div>
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
      )}
    </div>
  );
}
