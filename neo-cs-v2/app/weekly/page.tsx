"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { KpiCard } from "@/components/KpiCard";
import {
  products,
  ProductCode,
  productByCode,
  hasMultipleCourses,
  courseShortName
} from "@/lib/mock/data";
import { companies } from "@/lib/mock/entities";
import { activeContracts } from "@/lib/mock/onboarding";
import {
  weeklyReviews,
  CURRENT_WEEK_MONDAY,
  getWeekRange,
  formatWeekRange,
  prevWeek,
  weeksStuck,
  WeeklyReview
} from "@/lib/mock/weekly";
import { CompanyWeeklyEditor, WeeklyDraft } from "./CompanyWeeklyEditor";
import { WeeklyTable } from "./WeeklyTable";

type StatusFilter = "all" | "filled" | "empty" | "stuck";
type SortMode = "default" | "empty_first" | "name";
type ViewMode = "table" | "card";

// 直近5週の月曜一覧（古い→新しい、最後が今週）
function last5Weeks(): string[] {
  const out: string[] = [];
  let cur = CURRENT_WEEK_MONDAY;
  for (let i = 0; i < 5; i++) {
    out.unshift(cur);
    cur = prevWeek(cur);
  }
  return out;
}

function companyName(id: string): string {
  return companies.find((c) => c.id === id)?.name ?? id;
}

function truncate(s: string, n: number) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

export default function WeeklyPage() {
  const [selectedProduct, setSelectedProduct] =
    useState<ProductCode>("academia");
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(
    CURRENT_WEEK_MONDAY
  );
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [expandedCompanyIds, setExpandedCompanyIds] = useState<Set<string>>(
    new Set()
  );
  const [drafts, setDrafts] = useState<Map<string, WeeklyDraft>>(new Map());
  const [bulkMode, setBulkMode] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  const weekSlots = useMemo(() => last5Weeks(), []);
  const selectedRange = getWeekRange(selectedWeekStart);
  const isCurrentWeek = selectedWeekStart === CURRENT_WEEK_MONDAY;
  const p = productByCode[selectedProduct];

  // この研修のアクティブ契約を持つ企業ID（ユニーク）
  const companyIdsForProduct = useMemo(() => {
    const ids = new Set<string>();
    activeContracts
      .filter((c) => c.product === selectedProduct)
      .forEach((c) => ids.add(c.companyId));
    return Array.from(ids);
  }, [selectedProduct]);

  // (企業×研修×選択週) の情報
  type Row = {
    companyId: string;
    companyName: string;
    courseKeys: string[];
    ownerNames: string[];
    review: WeeklyReview | null;
    prevReview: WeeklyReview | null;
    stuckCount: number;
    carriedCount: number;
    nextCount: number;
    assigneeSummary: string;
  };

  const rows: Row[] = useMemo(() => {
    return companyIdsForProduct.map((cid) => {
      const contracts = activeContracts.filter(
        (c) => c.companyId === cid && c.product === selectedProduct
      );
      const courseKeys = Array.from(
        new Set(contracts.map((c) => c.courseKey))
      );
      const ownerNames = Array.from(
        new Set(contracts.map((c) => c.ownerName))
      );

      const review =
        weeklyReviews.find(
          (r) =>
            r.companyId === cid &&
            r.product === selectedProduct &&
            r.weekStart === selectedWeekStart
        ) ?? null;

      const prev =
        weeklyReviews.find(
          (r) =>
            r.companyId === cid &&
            r.product === selectedProduct &&
            r.weekStart === prevWeek(selectedWeekStart)
        ) ?? null;

      // 持ち越しN件 / Stuck（2週以上）
      const carried = review
        ? review.actions.filter((a) => a.fromPrevWeek)
        : prev
        ? prev.nextActions
        : [];
      const stuckCount = review
        ? review.actions.filter(
            (a) =>
              a.fromPrevWeek &&
              !a.done &&
              a.carriedFromWeek &&
              weeksStuck(a.carriedFromWeek, review.weekLabel) >= 2
          ).length
        : 0;

      const nextCount = review?.nextActions.length ?? 0;

      // 担当者集計
      const assigneeCounts: Record<string, number> = {};
      if (review) {
        review.nextActions.forEach((n) => {
          assigneeCounts[n.assigneeName] =
            (assigneeCounts[n.assigneeName] ?? 0) + 1;
        });
      }
      const assigneeSummary = Object.entries(assigneeCounts)
        .map(([name, c]) => `${name}${c}`)
        .join(", ");

      return {
        companyId: cid,
        companyName: companyName(cid),
        courseKeys,
        ownerNames,
        review,
        prevReview: prev,
        stuckCount,
        carriedCount: carried.length,
        nextCount,
        assigneeSummary
      };
    });
  }, [companyIdsForProduct, selectedProduct, selectedWeekStart]);

  // フィルタ
  const filteredRows = useMemo(() => {
    let list = rows;
    if (query.trim()) {
      const q = query.trim();
      list = list.filter((r) => r.companyName.includes(q));
    }
    if (statusFilter === "filled") {
      list = list.filter((r) => r.review !== null);
    } else if (statusFilter === "empty") {
      list = list.filter((r) => r.review === null);
    } else if (statusFilter === "stuck") {
      list = list.filter((r) => r.stuckCount > 0);
    }
    if (assigneeFilter !== "all") {
      list = list.filter((r) =>
        r.ownerNames.includes(assigneeFilter)
      );
    }
    // ソート
    if (sortMode === "empty_first") {
      list = [...list].sort((a, b) => {
        const ae = a.review ? 1 : 0;
        const be = b.review ? 1 : 0;
        if (ae !== be) return ae - be;
        return a.companyName.localeCompare(b.companyName, "ja");
      });
    } else if (sortMode === "name") {
      list = [...list].sort((a, b) =>
        a.companyName.localeCompare(b.companyName, "ja")
      );
    }
    return list;
  }, [rows, query, statusFilter, assigneeFilter, sortMode]);

  // KPI
  const kpi = useMemo(() => {
    const targetCount = activeContracts.filter(
      (c) => c.product === selectedProduct
    ).length;
    const filledCount = rows.filter((r) => r.review !== null).length;
    const emptyCount = rows.length - filledCount;
    const carriedTotal = rows.reduce((s, r) => s + r.carriedCount, 0);
    return { targetCount, filledCount, emptyCount, carriedTotal };
  }, [rows, selectedProduct]);

  // 展開操作
  const toggleExpand = (cid: string) => {
    setExpandedCompanyIds((prev) => {
      const next = new Set(prev);
      if (next.has(cid)) next.delete(cid);
      else next.add(cid);
      return next;
    });
  };
  const expandAll = () => {
    setExpandedCompanyIds(new Set(filteredRows.map((r) => r.companyId)));
  };
  const collapseAll = () => setExpandedCompanyIds(new Set());

  // draftのキーは companyId::product::weekStart
  const draftKey = (cid: string) =>
    `${cid}::${selectedProduct}::${selectedWeekStart}`;
  const getDraft = (cid: string): WeeklyDraft | null =>
    drafts.get(draftKey(cid)) ?? null;
  const setDraftFor = (cid: string, d: WeeklyDraft) => {
    setDrafts((prev) => {
      const next = new Map(prev);
      next.set(draftKey(cid), d);
      return next;
    });
  };

  // 一括入力モード: 今週選択＋未入力企業のみ展開
  const enterBulkMode = () => {
    setSelectedWeekStart(CURRENT_WEEK_MONDAY);
    setBulkMode(true);
    setStatusFilter("empty");
    setSortMode("empty_first");
    // 未入力企業を全展開（rowsは週・productに依存、次レンダで反映されるのでここは擬似的に）
    const targets = rows
      .filter((r) => r.review === null)
      .map((r) => r.companyId);
    setExpandedCompanyIds(new Set(targets));
  };
  const exitBulkMode = () => {
    setBulkMode(false);
    setStatusFilter("all");
    setExpandedCompanyIds(new Set());
  };

  const assigneeOptions = useMemo(() => {
    const s = new Set<string>();
    activeContracts
      .filter((c) => c.product === selectedProduct)
      .forEach((c) => s.add(c.ownerName));
    return Array.from(s);
  }, [selectedProduct]);

  return (
    <>
      <TopNav current="/weekly" />
      <main className="mx-auto max-w-[1400px] px-6 py-8 space-y-8">
        {/* ヘッダ */}
        <section className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs text-ink-500 font-medium">
              研修 × 週 のスコープで全社俯瞰
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              <span className="brand-text-gradient">週次レビュー</span>
            </h1>
            <div className="mt-1 text-sm text-ink-500">
              研修ごとに全契約企業の週次記録を一覧・編集
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {/* 研修切替 */}
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-ink-50 border border-ink-100 shrink-0">
              {products.map((x) => {
                const active = x.code === selectedProduct;
                return (
                  <button
                    key={x.code}
                    onClick={() => {
                      setSelectedProduct(x.code);
                      setExpandedCompanyIds(new Set());
                    }}
                    className={[
                      "px-3 py-1.5 rounded-full text-sm transition flex items-center gap-1.5",
                      active
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

            {/* 週切替 */}
            <div className="flex items-center gap-2 flex-wrap">
              {weekSlots.map((ws) => {
                const range = getWeekRange(ws);
                const isSelected = ws === selectedWeekStart;
                const isCurrent = ws === CURRENT_WEEK_MONDAY;
                return (
                  <button
                    key={ws}
                    onClick={() => {
                      setSelectedWeekStart(ws);
                      setExpandedCompanyIds(new Set());
                    }}
                    className={[
                      "px-3 py-1.5 rounded-lg text-xs transition text-left",
                      isSelected
                        ? "bg-ink-900 text-white"
                        : isCurrent
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100"
                        : "bg-white border border-ink-100 text-ink-700 hover:bg-ink-50"
                    ].join(" ")}
                  >
                    <div className="font-semibold leading-tight">
                      {range.label}{" "}
                      {isCurrent && (
                        <span className="text-[10px] font-normal">今週</span>
                      )}
                    </div>
                    <div className="text-[10px] opacity-80">
                      {formatWeekRange(range.start, range.end)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* KPI */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="対象契約数"
            value={`${kpi.targetCount} 件`}
            sub={`${p.shortName} / ${selectedRange.label}`}
            accent={p.accent}
          />
          <KpiCard
            label="入力済企業数"
            value={`${kpi.filledCount} 社`}
            sub={`対象 ${rows.length} 社中`}
            accent="#4CD97B"
          />
          <KpiCard
            label="未入力企業数"
            value={`${kpi.emptyCount} 社`}
            sub="記入を促す対象"
            accent="#EF4444"
          />
          <KpiCard
            label="持ち越しNext合計"
            value={`${kpi.carriedTotal} 件`}
            sub="Stuck項目を含む"
            accent="#FF9838"
          />
        </section>

        {/* フィルタ・検索 */}
        <section className="liquid-surface p-4 flex flex-wrap items-center gap-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="企業名を検索..."
            className="text-sm rounded-full border border-ink-100 px-4 py-1.5 bg-white focus:outline-none focus:border-ink-300 min-w-[200px]"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-500 font-medium">
              ステータス:
            </span>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as StatusFilter)
              }
              className="text-xs rounded-full border border-ink-100 px-3 py-1.5 bg-white hover:bg-ink-50"
            >
              <option value="all">すべて</option>
              <option value="filled">入力済</option>
              <option value="empty">未入力</option>
              <option value="stuck">Stuckあり</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-500 font-medium">担当者:</span>
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="text-xs rounded-full border border-ink-100 px-3 py-1.5 bg-white hover:bg-ink-50"
            >
              <option value="all">全員</option>
              {assigneeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-500 font-medium">並び順:</span>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="text-xs rounded-full border border-ink-100 px-3 py-1.5 bg-white hover:bg-ink-50"
            >
              <option value="default">既定</option>
              <option value="empty_first">未入力を上に</option>
              <option value="name">企業名</option>
            </select>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-ink-500">
              {filteredRows.length} / {rows.length} 社
            </span>
            {/* 表示モード切替 */}
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-ink-50 border border-ink-100">
              <button
                onClick={() => setViewMode("table")}
                className={[
                  "px-2.5 py-1 rounded-full text-[11px] transition",
                  viewMode === "table"
                    ? "bg-white shadow-liquid font-medium text-ink-900"
                    : "text-ink-500 hover:text-ink-700"
                ].join(" ")}
              >
                テーブル
              </button>
              <button
                onClick={() => setViewMode("card")}
                className={[
                  "px-2.5 py-1 rounded-full text-[11px] transition",
                  viewMode === "card"
                    ? "bg-white shadow-liquid font-medium text-ink-900"
                    : "text-ink-500 hover:text-ink-700"
                ].join(" ")}
              >
                カード
              </button>
            </div>
            <button
              onClick={expandAll}
              className="text-xs px-3 py-1.5 rounded-full border border-ink-100 text-ink-700 hover:bg-ink-50"
            >
              全展開
            </button>
            <button
              onClick={collapseAll}
              className="text-xs px-3 py-1.5 rounded-full border border-ink-100 text-ink-700 hover:bg-ink-50"
            >
              全折りたたみ
            </button>
            {!bulkMode ? (
              <button
                onClick={enterBulkMode}
                className="text-xs px-3 py-1.5 rounded-full text-white font-medium hover:opacity-90"
                style={{ background: p.accent }}
              >
                今週の一括入力モード
              </button>
            ) : (
              <button
                onClick={exitBulkMode}
                className="text-xs px-3 py-1.5 rounded-full border border-ink-100 text-ink-700 hover:bg-ink-50"
              >
                一括モード終了
              </button>
            )}
          </div>
        </section>

        {/* 企業リスト */}
        {viewMode === "table" ? (
          <section>
            <WeeklyTable
              rows={filteredRows.map((r) => ({
                companyId: r.companyId,
                companyName: r.companyName,
                courseKeys: r.courseKeys,
                review: r.review,
                prevReview: r.prevReview,
                stuckCount: r.stuckCount
              }))}
              product={selectedProduct}
              weekStart={selectedWeekStart}
              getDraft={getDraft}
              setDraftFor={setDraftFor}
              expandedCompanyIds={expandedCompanyIds}
              toggleExpand={toggleExpand}
            />
          </section>
        ) : (
        <section className="liquid-surface overflow-hidden">
          {filteredRows.length === 0 ? (
            <div className="p-10 text-center text-sm text-ink-500">
              該当する企業はありません
            </div>
          ) : (
            <ul className="divide-y divide-ink-100">
              {filteredRows.map((r) => {
                const isExpanded = expandedCompanyIds.has(r.companyId);
                const isFilled = r.review !== null;
                const goodPreview = r.review?.good
                  ? truncate(r.review.good, 40)
                  : "—";
                const morePreview = r.review?.more
                  ? truncate(r.review.more, 40)
                  : "—";
                return (
                  <li
                    key={r.companyId}
                    className={isExpanded ? "bg-ink-50/40" : "bg-white"}
                  >
                    {/* サマリー行 */}
                    <div className="px-5 py-3 flex items-center gap-4 flex-wrap">
                      <div className="min-w-[180px] flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/companies/${r.companyId}`}
                            className="text-sm font-bold text-ink-900 hover:underline"
                          >
                            {r.companyName}
                          </Link>
                          {hasMultipleCourses(selectedProduct) &&
                            r.courseKeys.length > 0 && (
                              <span
                                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                                style={{
                                  color: p.accent,
                                  background: `${p.accent}14`,
                                  border: `1px solid ${p.accent}33`
                                }}
                              >
                                {r.courseKeys
                                  .map((ck) =>
                                    courseShortName(selectedProduct, ck)
                                  )
                                  .join(" / ")}
                              </span>
                            )}
                        </div>
                      </div>

                      <div className="hidden md:block flex-[2] min-w-0 text-xs text-ink-500 space-y-0.5">
                        <div className="truncate">
                          <span className="text-emerald-700 font-medium">
                            Good:
                          </span>{" "}
                          <span className="text-ink-700">{goodPreview}</span>
                        </div>
                        <div className="truncate">
                          <span className="text-amber-700 font-medium">
                            More:
                          </span>{" "}
                          <span className="text-ink-700">{morePreview}</span>
                        </div>
                      </div>

                      <div className="hidden lg:flex items-center gap-3 text-[11px] text-ink-500 min-w-[120px]">
                        <span>
                          Next{" "}
                          <span className="text-ink-700 font-medium">
                            {r.nextCount}
                          </span>
                        </span>
                        {r.assigneeSummary && (
                          <span className="text-ink-500">
                            {r.assigneeSummary}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {r.stuckCount > 0 && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                            ⚠ Stuck {r.stuckCount}
                          </span>
                        )}
                        {isFilled ? (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                            入力済
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100">
                            未入力
                          </span>
                        )}
                        <button
                          onClick={() => toggleExpand(r.companyId)}
                          className="text-xs px-2.5 py-1 rounded-full border border-ink-100 text-ink-700 hover:bg-ink-50"
                        >
                          {isExpanded ? "▲ 閉じる" : "▼ 開く"}
                        </button>
                      </div>
                    </div>

                    {/* 展開部 */}
                    {isExpanded && (
                      <div className="px-5 pb-5">
                        <CompanyWeeklyEditor
                          companyId={r.companyId}
                          product={selectedProduct}
                          weekStart={selectedWeekStart}
                          draft={getDraft(r.companyId)}
                          setDraft={(d) => setDraftFor(r.companyId, d)}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        )}

        <div className="text-center text-[11px] text-ink-400 pb-4">
          {isCurrentWeek
            ? "今週は入力可能。過去週はロック済みのため閲覧のみ。"
            : "過去週は閲覧のみ（編集は今週を選択してください）"}
        </div>
      </main>
    </>
  );
}

