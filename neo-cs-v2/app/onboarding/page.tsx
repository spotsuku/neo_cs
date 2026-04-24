"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { KpiCard } from "@/components/KpiCard";
import { ProductBadge } from "@/components/ProductBadge";
import { products, ProductCode, productByCode, yen } from "@/lib/mock/data";
import { companies } from "@/lib/mock/entities";
import {
  activeContracts,
  contractOnboardingItems,
  productOnboardingTemplates,
  categoryProgress,
  contractProgress,
  daysUntilStart,
  ActiveContract
} from "@/lib/mock/onboarding";
import { MatrixView } from "./MatrixView";

function companyName(id: string): string {
  return companies.find((c) => c.id === id)?.name ?? id;
}

function ProgressBar({
  done,
  total,
  color,
  thin
}: {
  done: number;
  total: number;
  color: string;
  thin?: boolean;
}) {
  const pct = total > 0 ? (done / total) * 100 : 0;
  return (
    <div
      className={`relative rounded-full bg-ink-100 overflow-hidden ${
        thin ? "h-1" : "h-1.5"
      }`}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

function categoryLabels(product: ProductCode): { key: string; label: string }[] {
  return productOnboardingTemplates[product]
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((c) => ({ key: c.key, label: c.label }));
}

function overdueInCategory(contractId: string, categoryKey: string) {
  return contractOnboardingItems.filter(
    (i) =>
      i.contractId === contractId &&
      i.categoryKey === categoryKey &&
      i.status === "overdue"
  ).length;
}

function ContractCard({ contract }: { contract: ActiveContract }) {
  const p = productByCode[contract.product];
  const prog = contractProgress(contract.id);
  const cats = categoryLabels(contract.product);
  const days = daysUntilStart(contract.startDate);
  const overdueDays = days < 0;

  return (
    <Link
      href={`/onboarding/${contract.id}`}
      className="block liquid-surface p-5 hover:shadow-liquid-lg transition"
    >
      <div className="flex items-start justify-between gap-4">
        {/* 左: 企業情報・カテゴリ進捗 */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-bold text-ink-900 truncate">
              {companyName(contract.companyId)}
            </span>
            <ProductBadge code={contract.product} size="sm" />
            {contract.planName && (
              <span className="text-[11px] text-ink-500">
                {contract.planName}
              </span>
            )}
            <span
              className={[
                "text-[11px] font-medium px-2 py-0.5 rounded-full",
                overdueDays
                  ? "bg-rose-50 text-rose-600 border border-rose-200"
                  : days <= 7
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "bg-ink-50 text-ink-700 border border-ink-100"
              ].join(" ")}
            >
              {overdueDays
                ? `開始超過 ${Math.abs(days)}日`
                : days === 0
                ? "本日開始"
                : `開始まで ${days}日`}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-500">
            <span>
              開始日{" "}
              <span className="text-ink-700 font-medium">
                {contract.startDate.replace(/-/g, "/")}
              </span>
            </span>
            <span>
              担当{" "}
              <span className="text-ink-700 font-medium">
                {contract.ownerName}
              </span>
            </span>
            <span>
              参加者{" "}
              <span className="text-ink-700 font-medium">
                {contract.participants}名
              </span>
            </span>
            {contract.mrr !== undefined && (
              <span>
                MRR{" "}
                <span className="text-ink-700 font-medium">
                  {yen(contract.mrr)}
                </span>
              </span>
            )}
            {contract.revenue !== undefined && (
              <span>
                Revenue{" "}
                <span className="text-ink-700 font-medium">
                  {yen(contract.revenue)}
                </span>
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {cats.map((c) => {
              const cp = categoryProgress(contract.id, c.key);
              const od = overdueInCategory(contract.id, c.key);
              return (
                <div key={c.key}>
                  <div className="flex items-baseline justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-ink-700 font-medium">
                        {c.label}
                      </span>
                      {od > 0 && (
                        <span className="text-[10px] text-rose-500">
                          🔴{od}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-ink-500">
                      {cp.done}/{cp.total}
                    </span>
                  </div>
                  <div className="mt-1">
                    <ProgressBar
                      done={cp.done}
                      total={cp.total}
                      color={p.accent}
                      thin
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 右: 全体進捗 */}
        <div className="w-40 shrink-0 text-right">
          <div className="text-[11px] text-ink-500">全体進捗</div>
          <div className="mt-1 text-lg font-bold text-ink-900">
            {prog.done}/{prog.total}
          </div>
          <div className="mt-2">
            <ProgressBar done={prog.done} total={prog.total} color={p.accent} />
          </div>
          {prog.overdue > 0 && (
            <div className="mt-1 text-[11px] text-rose-500 font-medium">
              期日超過 {prog.overdue}件
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function OnboardingPage() {
  const [product, setProduct] = useState<ProductCode>("academia");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [completeOpen, setCompleteOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"card" | "category" | "item">("card");

  const p = productByCode[product];

  const productContracts = useMemo(
    () => activeContracts.filter((c) => c.product === product),
    [product]
  );

  const inProgress = useMemo(
    () => productContracts.filter((c) => c.onboardingStatus === "in_progress"),
    [productContracts]
  );
  const completed = useMemo(
    () => productContracts.filter((c) => c.onboardingStatus === "complete"),
    [productContracts]
  );

  const filteredInProgress = useMemo(() => {
    return inProgress.filter((c) => {
      if (assigneeFilter !== "all" && c.ownerName !== assigneeFilter)
        return false;
      if (statusFilter === "overdue") {
        if (contractProgress(c.id).overdue === 0) return false;
      }
      // 進行中はin_progress自体なので別絞り込みは不要
      return true;
    });
  }, [inProgress, assigneeFilter, statusFilter]);

  const kpi = useMemo(() => {
    const activeCount = inProgress.length;
    const overdueTotal = inProgress.reduce(
      (sum, c) => sum + contractProgress(c.id).overdue,
      0
    );
    const within7 = inProgress.filter((c) => {
      const d = daysUntilStart(c.startDate);
      return d >= 0 && d <= 7;
    }).length;
    const avgPct =
      inProgress.length === 0
        ? 0
        : Math.round(
            (inProgress.reduce((sum, c) => {
              const pr = contractProgress(c.id);
              return sum + (pr.total > 0 ? pr.done / pr.total : 0);
            }, 0) /
              inProgress.length) *
              100
          );
    return { activeCount, overdueTotal, within7, avgPct };
  }, [inProgress]);

  return (
    <>
      <TopNav current="/onboarding" />
      <main className="mx-auto max-w-[1400px] px-6 py-8 space-y-8">
        {/* ヘッダ */}
        <section className="flex items-end justify-between gap-4">
          <div>
            <div className="text-xs text-ink-500 font-medium">
              契約単位のチェックリスト
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight flex items-center gap-3">
              <span className="brand-text-gradient">オンボーディング</span>
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
              内諾後から契約開始までのチェックリスト管理
            </div>
          </div>

          {/* 研修切替 */}
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-ink-50 border border-ink-100 shrink-0">
            {products.map((x) => {
              const active = x.code === product;
              return (
                <button
                  key={x.code}
                  onClick={() => setProduct(x.code)}
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
        </section>

        {/* KPI */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="オンボ進行中"
            value={`${kpi.activeCount} 件`}
            sub="契約数"
            accent={p.accent}
          />
          <KpiCard
            label="期日超過項目"
            value={`${kpi.overdueTotal} 件`}
            sub="要即対応"
            accent="#EF4444"
          />
          <KpiCard
            label="契約開始 7日以内"
            value={`${kpi.within7} 件`}
            sub="直近でオンボ仕上げ"
            accent="#FF9838"
          />
          <KpiCard
            label="平均進捗率"
            value={`${kpi.avgPct}%`}
            sub="進行中契約の平均"
            accent="#4CD97B"
          />
        </section>

        {/* フィルタ */}
        <section className="liquid-surface p-4 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-500 font-medium">担当者:</span>
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="text-xs rounded-full border border-ink-100 px-3 py-1.5 bg-white hover:bg-ink-50"
            >
              <option value="all">全員</option>
              <option value="古野">古野</option>
              <option value="松田">松田</option>
              <option value="三木">三木</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-500 font-medium">
              ステータス:
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs rounded-full border border-ink-100 px-3 py-1.5 bg-white hover:bg-ink-50"
            >
              <option value="all">すべて</option>
              <option value="in_progress">進行中</option>
              <option value="overdue">期日超過あり</option>
            </select>
          </div>

          {/* 表示切替 */}
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-ink-50 border border-ink-100">
            {[
              { key: "card" as const, label: "カード" },
              { key: "category" as const, label: "一覧(カテゴリ)" },
              { key: "item" as const, label: "一覧(項目)" }
            ].map((v) => (
              <button
                key={v.key}
                onClick={() => setViewMode(v.key)}
                className={[
                  "px-3 py-1 rounded-full text-xs transition",
                  viewMode === v.key
                    ? "bg-white shadow-liquid font-medium text-ink-900"
                    : "text-ink-500 hover:text-ink-700"
                ].join(" ")}
              >
                {v.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-ink-500">
              {filteredInProgress.length} / {inProgress.length} 件
            </span>
            <Link
              href={`/settings/products/${product}`}
              className="text-xs text-ink-500 hover:text-ink-700 underline"
            >
              カテゴリ・項目を編集
            </Link>
          </div>
        </section>

        {/* 契約リスト(カード or 一覧表) */}
        <section className={viewMode === "card" ? "space-y-3" : ""}>
          {filteredInProgress.length === 0 ? (
            <div className="liquid-surface p-10 text-center text-sm text-ink-500">
              該当する契約はありません
            </div>
          ) : viewMode === "card" ? (
            filteredInProgress.map((c) => (
              <ContractCard key={c.id} contract={c} />
            ))
          ) : (
            <MatrixView
              product={product}
              contracts={filteredInProgress}
              mode={viewMode === "item" ? "item" : "category"}
            />
          )}
        </section>

        {/* 完了済契約 */}
        <section>
          <button
            type="button"
            onClick={() => setCompleteOpen((v) => !v)}
            className="w-full liquid-surface p-4 flex items-center justify-between hover:bg-ink-50/50"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-ink-700">
                オンボ完了済（運用中）
              </span>
              <span className="text-xs text-ink-500">
                {completed.length} 件
              </span>
            </div>
            <span className="text-ink-500 text-sm">
              {completeOpen ? "閉じる ▲" : "開く ▼"}
            </span>
          </button>
          {completeOpen && (
            <div className="mt-3">
              {completed.length === 0 ? (
                <div className="liquid-surface p-8 text-center text-sm text-ink-500">
                  完了済の契約はありません
                </div>
              ) : viewMode === "card" ? (
                <div className="space-y-3">
                  {completed.map((c) => (
                    <ContractCard key={c.id} contract={c} />
                  ))}
                </div>
              ) : (
                <MatrixView
                  product={product}
                  contracts={completed}
                  mode={viewMode === "item" ? "item" : "category"}
                />
              )}
            </div>
          )}
        </section>

        <footer className="pt-8 pb-4 text-center text-[11px] text-ink-500">
          NEO CS v2 — 契約単位のチェックリスト管理（研修ごとにカテゴリ・項目を編集可能）
        </footer>
      </main>
    </>
  );
}
