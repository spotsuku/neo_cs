"use client";

import { useMemo, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { KpiCard } from "@/components/KpiCard";
import { ProductBadge } from "@/components/ProductBadge";
import { products, ProductCode } from "@/lib/mock/data";
import { onboardingTasks, companies, OnboardingTask } from "@/lib/mock/entities";

// フェーズ定義
const phaseOrder = ["prep", "kickoff", "run", "close"] as const;
const phaseLabels: Record<(typeof phaseOrder)[number], string> = {
  prep: "準備",
  kickoff: "Kickoff",
  run: "運用中",
  close: "クローズ"
};

// ステータス色ドット
const statusMeta: Record<
  OnboardingTask["status"],
  { color: string; label: string }
> = {
  todo: { color: "#C4C7CD", label: "未着手" },
  doing: { color: "#3D9EFF", label: "進行中" },
  done: { color: "#4CD97B", label: "完了" },
  overdue: { color: "#EF4444", label: "期日超過" }
};

// 企業名解決
function companyName(id: string): string {
  return companies.find((c) => c.id === id)?.name ?? id;
}

// 週内判定（今日〜+7日）
function isWithinThisWeek(dateStr: string): boolean {
  const today = new Date("2026-04-24");
  const target = new Date(dateStr);
  const diff = (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 7;
}

export default function OnboardingPage() {
  const [productFilter, setProductFilter] = useState<ProductCode[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const assignees = useMemo(
    () => Array.from(new Set(onboardingTasks.map((t) => t.assignee))),
    []
  );

  const filtered = useMemo(() => {
    return onboardingTasks.filter((t) => {
      if (productFilter.length > 0 && !productFilter.includes(t.product)) return false;
      if (assigneeFilter !== "all" && t.assignee !== assigneeFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      return true;
    });
  }, [productFilter, assigneeFilter, statusFilter]);

  // KPI
  const kpi = useMemo(() => {
    const active = onboardingTasks.filter((t) => t.status !== "done");
    const overdue = onboardingTasks.filter((t) => t.status === "overdue");
    const thisWeek = onboardingTasks.filter(
      (t) => t.status !== "done" && isWithinThisWeek(t.dueDate)
    );
    const done = onboardingTasks.filter((t) => t.status === "done").length;
    const total = onboardingTasks.length;
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
    return {
      activeCount: active.length,
      overdueCount: overdue.length,
      thisWeekCount: thisWeek.length,
      completionRate
    };
  }, []);

  const toggleProduct = (code: ProductCode) => {
    setProductFilter((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  return (
    <>
      <TopNav current="/onboarding" />
      <main className="mx-auto max-w-[1400px] px-6 py-8 space-y-8">
        {/* ヘッダ */}
        <section className="flex items-end justify-between">
          <div>
            <div className="text-xs text-ink-500 font-medium">タスク進捗管理</div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              <span className="brand-text-gradient">オンボーディング</span>
            </h1>
            <div className="mt-1 text-sm text-ink-500">
              研修導入から運用定着までのタスク管理
            </div>
          </div>
        </section>

        {/* KPI */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="進行中タスク"
            value={`${kpi.activeCount} 件`}
            sub="未完了の総数"
            accent="#3D9EFF"
          />
          <KpiCard
            label="期日超過"
            value={`${kpi.overdueCount} 件`}
            sub="要即対応"
            accent="#EF4444"
          />
          <KpiCard
            label="今週期日"
            value={`${kpi.thisWeekCount} 件`}
            sub="今後7日以内"
            accent="#FF9838"
          />
          <KpiCard
            label="完了率"
            value={`${kpi.completionRate}%`}
            sub="全タスクベース"
            accent="#4CD97B"
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

          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-500 font-medium">担当者:</span>
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="text-xs rounded-full border border-ink-100 px-3 py-1.5 bg-white hover:bg-ink-50"
            >
              <option value="all">全員</option>
              {assignees.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-500 font-medium">ステータス:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs rounded-full border border-ink-100 px-3 py-1.5 bg-white hover:bg-ink-50"
            >
              <option value="all">すべて</option>
              <option value="todo">未着手</option>
              <option value="doing">進行中</option>
              <option value="done">完了</option>
              <option value="overdue">期日超過</option>
            </select>
          </div>

          <div className="ml-auto text-xs text-ink-500">
            {filtered.length} / {onboardingTasks.length} 件
          </div>
        </section>

        {/* Kanban */}
        <section className="overflow-x-auto -mx-6 px-6 pb-4">
          <div className="flex gap-4 min-w-max">
            {phaseOrder.map((phase) => {
              const tasks = filtered.filter((t) => t.phase === phase);
              return (
                <div key={phase} className="w-[300px] shrink-0">
                  <div className="flex items-baseline justify-between mb-3 px-1">
                    <h3 className="text-sm font-semibold text-ink-700">
                      {phaseLabels[phase]}
                    </h3>
                    <span className="text-xs text-ink-500">{tasks.length}</span>
                  </div>
                  <div className="space-y-3">
                    {tasks.length === 0 ? (
                      <div className="liquid-surface p-6 text-center text-xs text-ink-500">
                        タスクなし
                      </div>
                    ) : (
                      tasks.map((t) => {
                        const isOverdue = t.status === "overdue";
                        const meta = statusMeta[t.status];
                        return (
                          <button
                            key={t.id}
                            type="button"
                            className={[
                              "w-full text-left liquid-surface p-4 hover:shadow-liquid-lg transition cursor-pointer",
                              isOverdue ? "border-2 border-rose-400" : ""
                            ].join(" ")}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-ink-500 truncate">
                                {companyName(t.companyId)}
                              </span>
                              <ProductBadge code={t.product} size="sm" />
                            </div>
                            <div className="mt-2 text-sm font-medium text-ink-900 leading-snug">
                              {t.name}
                            </div>
                            <div className="mt-3 flex items-center justify-between text-[11px]">
                              <span
                                className={[
                                  "font-medium",
                                  isOverdue ? "text-rose-500" : "text-ink-500"
                                ].join(" ")}
                              >
                                期日 {t.dueDate.slice(5).replace("-", "/")}
                              </span>
                              <span className="text-ink-500">{t.assignee}</span>
                            </div>
                            <div className="mt-2 flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ background: meta.color }}
                              />
                              <span className="text-[11px] text-ink-700">
                                {meta.label}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <footer className="pt-8 pb-4 text-center text-[11px] text-ink-500">
          NEO CS v2 — オンボーディング管理
        </footer>
      </main>
    </>
  );
}
