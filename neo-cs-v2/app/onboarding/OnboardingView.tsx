"use client";

// /onboarding 一覧 (item マトリクスのみ)。
// 事業内ToDo と同じ操作感: セルのクリック / 右クリック / 列ヘッダの一括期日・責任者設定。

import { useMemo, useState } from "react";
import Link from "next/link";
import { KpiCard } from "@/components/KpiCard";
import {
  products,
  type ProductCode,
  productByCode
} from "@/lib/mock/data";
import {
  daysUntilStart,
  type ActiveContract
} from "@/lib/mock/onboarding";
import type { ContractOnboardingItem } from "@/lib/repository/types";
import { MatrixView } from "./MatrixView";

function computeProgress(
  items: ContractOnboardingItem[],
  today: string
): { done: number; total: number; overdue: number } {
  let done = 0;
  let overdue = 0;
  let total = 0;
  for (const i of items) {
    if (i.status === "not_applicable") continue;
    total++;
    if (i.status === "done") done++;
    if (
      (i.status === "todo" || i.status === "doing" || i.status === "overdue") &&
      i.dueDate &&
      i.dueDate < today
    ) {
      overdue++;
    }
  }
  return { done, overdue, total };
}

export function OnboardingView({
  activeContracts,
  itemsByContract,
  companyMap,
  users,
  today
}: {
  activeContracts: ActiveContract[];
  itemsByContract: Record<string, ContractOnboardingItem[]>;
  companyMap: Record<string, string>;
  users: { id: string; name: string }[];
  today: string;
}) {
  const [product, setProduct] = useState<ProductCode>("academia");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [completeOpen, setCompleteOpen] = useState(false);

  const p = productByCode[product];

  const productContracts = useMemo(
    () => activeContracts.filter((c) => c.product === product),
    [activeContracts, product]
  );

  const inProgress = useMemo(
    () => productContracts.filter((c) => c.status === "onboarding"),
    [productContracts]
  );
  const completed = useMemo(
    () =>
      productContracts.filter(
        (c) => c.status !== "onboarding" && c.status !== "handoff"
      ),
    [productContracts]
  );

  const filteredInProgress = useMemo(() => {
    return inProgress.filter((c) => {
      if (assigneeFilter !== "all" && c.ownerName !== assigneeFilter) return false;
      if (statusFilter === "overdue") {
        const items = itemsByContract[c.id] ?? [];
        if (computeProgress(items, today).overdue === 0) return false;
      }
      return true;
    });
  }, [inProgress, assigneeFilter, statusFilter, itemsByContract, today]);

  const kpi = useMemo(() => {
    const activeCount = inProgress.length;
    let overdueTotal = 0;
    let pctSum = 0;
    let pctN = 0;
    for (const c of inProgress) {
      const items = itemsByContract[c.id] ?? [];
      const pr = computeProgress(items, today);
      overdueTotal += pr.overdue;
      if (pr.total > 0) {
        pctSum += pr.done / pr.total;
        pctN++;
      }
    }
    const within7 = inProgress.filter((c) => {
      const d = daysUntilStart(c.startDate);
      return d >= 0 && d <= 7;
    }).length;
    const avgPct = pctN === 0 ? 0 : Math.round((pctSum / pctN) * 100);
    return { activeCount, overdueTotal, within7, avgPct };
  }, [inProgress, itemsByContract, today]);

  return (
    <main className="mx-auto max-w-[1600px] px-6 py-8 space-y-8">
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
          <span className="text-xs text-ink-500 font-medium">ステータス:</span>
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

      {/* 進行中マトリクス */}
      <section>
        {filteredInProgress.length === 0 ? (
          <div className="liquid-surface p-10 text-center text-sm text-ink-500">
            該当する契約はありません
          </div>
        ) : (
          <MatrixView
            product={product}
            contracts={filteredInProgress}
            itemsByContract={itemsByContract}
            companyMap={companyMap}
            users={users}
            today={today}
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
            <span className="text-xs text-ink-500">{completed.length} 件</span>
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
            ) : (
              <MatrixView
                product={product}
                contracts={completed}
                itemsByContract={itemsByContract}
                companyMap={companyMap}
                users={users}
                today={today}
              />
            )}
          </div>
        )}
      </section>

      <footer className="pt-8 pb-4 text-center text-[11px] text-ink-500">
        NEO CS v2 — 契約単位のチェックリスト管理（クリック=ステータス循環 / 右クリック=詳細エディタ）
      </footer>
    </main>
  );
}
