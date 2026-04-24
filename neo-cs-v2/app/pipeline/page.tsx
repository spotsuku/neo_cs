"use client";

import { useMemo, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { KpiCard } from "@/components/KpiCard";
import { ProductBadge } from "@/components/ProductBadge";
import { products, ProductCode, yen } from "@/lib/mock/data";
import { deals, stageOrder, stageLabels } from "@/lib/mock/entities";

// 今月/来月判定（固定: 今日=2026-04-24）
const TODAY = new Date("2026-04-24");
function isSameYearMonth(dateStr: string, d: Date): boolean {
  const t = new Date(dateStr);
  return t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth();
}
function nextMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

export default function PipelinePage() {
  const [productFilter, setProductFilter] = useState<ProductCode[]>([]);

  const filtered = useMemo(() => {
    return deals.filter((d) => {
      if (productFilter.length > 0 && !productFilter.includes(d.product)) return false;
      return true;
    });
  }, [productFilter]);

  // KPI（フィルタ非依存で全体感を表示）
  const kpi = useMemo(() => {
    const total = deals.length;
    const totalMrr = deals.reduce((sum, d) => sum + d.expectedMrr, 0);
    const thisMonth = deals.filter((d) => isSameYearMonth(d.expectedStart, TODAY)).length;
    const next = nextMonth(TODAY);
    const nextMonthCount = deals.filter((d) => isSameYearMonth(d.expectedStart, next)).length;
    return { total, totalMrr, thisMonth, nextMonthCount };
  }, []);

  const toggleProduct = (code: ProductCode) => {
    setProductFilter((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  return (
    <>
      <TopNav current="/pipeline" />
      <main className="mx-auto max-w-[1400px] px-6 py-8 space-y-8">
        {/* ヘッダ */}
        <section className="flex items-end justify-between">
          <div>
            <div className="text-xs text-ink-500 font-medium">新規案件の進捗</div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              <span className="brand-text-gradient">パイプライン</span>
            </h1>
            <div className="mt-1 text-sm text-ink-500">
              内諾までの案件ステージ管理
            </div>
          </div>
        </section>

        {/* KPI */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="総案件数"
            value={`${kpi.total} 件`}
            sub="全ステージ合計"
            accent="#3D9EFF"
          />
          <KpiCard
            label="総見込みMRR"
            value={yen(kpi.totalMrr)}
            sub="継続型の見込み"
            accent="#8B5CF6"
          />
          <KpiCard
            label="見込み開始 今月"
            value={`${kpi.thisMonth} 件`}
            sub="2026年4月"
            accent="#4CD97B"
          />
          <KpiCard
            label="見込み開始 来月"
            value={`${kpi.nextMonthCount} 件`}
            sub="2026年5月"
            accent="#FF9838"
          />
        </section>

        {/* フィルタ */}
        <section className="liquid-surface p-4 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-500 font-medium">研修:</span>
            <div className="flex items-center gap-1.5">
              {products.map((p) => {
                const active = productFilter.includes(p.code);
                return (
                  <button
                    key={p.code}
                    onClick={() => toggleProduct(p.code)}
                    className={[
                      "transition rounded-full",
                      active ? "ring-2 ring-offset-1" : "opacity-50 hover:opacity-100"
                    ].join(" ")}
                    style={{
                      ["--tw-ring-color" as string]: p.accent
                    } as React.CSSProperties}
                  >
                    <ProductBadge code={p.code} size="sm" />
                  </button>
                );
              })}
              {productFilter.length > 0 && (
                <button
                  onClick={() => setProductFilter([])}
                  className="ml-1 text-[11px] text-ink-500 hover:text-ink-700 underline"
                >
                  クリア
                </button>
              )}
            </div>
          </div>
          <div className="ml-auto text-xs text-ink-500">
            {filtered.length} / {deals.length} 件
          </div>
        </section>

        {/* Kanban */}
        <section className="overflow-x-auto -mx-6 px-6 pb-4">
          <div className="flex gap-4 min-w-max">
            {stageOrder.map((stage) => {
              const stageDeals = filtered.filter((d) => d.stage === stage);
              const stageMrr = stageDeals.reduce((s, d) => s + d.expectedMrr, 0);
              return (
                <div key={stage} className="w-[300px] shrink-0">
                  <div className="mb-3 px-1">
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-sm font-semibold text-ink-700">
                        {stageLabels[stage]}
                      </h3>
                      <span className="text-xs text-ink-500">
                        {stageDeals.length} 件
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink-500">
                      見込み合計 {yen(stageMrr)}
                    </div>
                  </div>
                  <div className="space-y-3">
                    {stageDeals.length === 0 ? (
                      <div className="liquid-surface p-6 text-center text-xs text-ink-500">
                        案件なし
                      </div>
                    ) : (
                      stageDeals.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          className="w-full text-left liquid-surface p-4 hover:shadow-liquid-lg transition cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-ink-900 truncate">
                              {d.companyName}
                            </span>
                            <ProductBadge code={d.product} size="sm" />
                          </div>
                          <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-base font-bold text-ink-900">
                              {d.expectedMrr > 0 ? yen(d.expectedMrr) : "—"}
                            </span>
                            <span className="text-[11px] text-ink-500">
                              {d.expectedMrr > 0 ? "/月" : "単発"}
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] text-ink-500">
                            開始予定 {d.expectedStart.replace(/-/g, "/")}
                          </div>
                          <div className="mt-2 text-[11px] font-bold text-ink-700 leading-snug">
                            {d.nextAction}
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-ink-500">
                            <span>{d.ownerName}</span>
                            <span>{d.updatedDays}日前更新</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <footer className="pt-8 pb-4 text-center text-[11px] text-ink-500">
          NEO CS v2 — パイプライン管理
        </footer>
      </main>
    </>
  );
}
