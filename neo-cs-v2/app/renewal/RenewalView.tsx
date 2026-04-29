"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { KpiCard } from "@/components/KpiCard";
import { ProductBadge } from "@/components/ProductBadge";
import type { Company } from "@/lib/mock/entities";
import type { ActiveContract } from "@/lib/mock/onboarding";
import type { ChurnRecord } from "@/lib/mock/churn";
import { reasonCategoryLabels } from "@/lib/mock/churn";
import { generateRenewalMilestones } from "@/lib/mock/cycles";
import { courseShortName, hasMultipleCourses } from "@/lib/mock/data";

const TODAY = "2026-04-24";

type Tab = "renewal" | "reapproach";

function daysBetween(a: string, b: string): number {
  return Math.ceil(
    (new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function RenewalView({
  renewalContracts,
  allContracts,
  companies,
  churnRecords
}: {
  renewalContracts: ActiveContract[];
  allContracts: ActiveContract[];
  companies: Company[];
  churnRecords: ChurnRecord[];
}) {
  const [tab, setTab] = useState<Tab>("renewal");
  // 解約レコードはモック state（モック完了通知用）
  const [records, setRecords] = useState<ChurnRecord[]>(churnRecords);

  const companyById = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies]
  );
  const contractById = useMemo(
    () => new Map(allContracts.map((c) => [c.id, c])),
    [allContracts]
  );

  // KPI計算
  const greenCount = renewalContracts.filter((c) => c.healthScore?.color === "green").length;
  const yellowCount = renewalContracts.filter((c) => c.healthScore?.color === "yellow").length;
  const redCount = renewalContracts.filter((c) => c.healthScore?.color === "red").length;

  // 再アプローチ予定（30日以内）
  const reapproachSoon = records.filter((r) => {
    if (!r.nextActionDate) return false;
    const d = daysBetween(r.nextActionDate, TODAY);
    return d >= 0 && d <= 30;
  });

  // 再アプローチ予定（今日〜90日後）
  const reapproachAll = records
    .filter((r) => {
      if (!r.nextActionDate) return false;
      const d = daysBetween(r.nextActionDate, TODAY);
      return d >= 0 && d <= 90;
    })
    .sort((a, b) => (a.nextActionDate! < b.nextActionDate! ? -1 : 1));

  const markDone = (contractId: string) => {
    // モック: notified=true に更新するだけ
    setRecords((prev) =>
      prev.map((r) =>
        r.contractId === contractId ? { ...r, notified: true } : r
      )
    );
  };

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">更新ダッシュボード</h1>
        <p className="text-xs text-ink-500 mt-0.5">
          更新ウィンドウ契約と、解約後の再アプローチ予定を統合表示
        </p>
      </header>

      {/* KPI */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          label="更新ウィンドウ"
          value={`${renewalContracts.length}件`}
          accent="#3D9EFF"
        />
        <KpiCard
          label="更新確定 (Green)"
          value={`${greenCount}件`}
          accent="#10B981"
        />
        <KpiCard
          label="注視 (Yellow)"
          value={`${yellowCount}件`}
          accent="#F59E0B"
        />
        <KpiCard
          label="危機 (Red)"
          value={`${redCount}件`}
          accent="#EF4444"
        />
        <KpiCard
          label="再アプローチ予定 (30日以内)"
          value={`${reapproachSoon.length}件`}
          accent="#8B5CF6"
        />
      </section>

      {/* タブ */}
      <nav className="flex items-center gap-1 border-b border-ink-100">
        {(
          [
            { key: "renewal" as Tab, label: `更新対象 (${renewalContracts.length})` },
            { key: "reapproach" as Tab, label: `再アプローチ予定 (${reapproachAll.length})` }
          ]
        ).map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={[
                "px-4 py-2.5 text-sm transition relative -mb-px",
                active
                  ? "text-ink-900 font-semibold border-b-2 border-ink-900"
                  : "text-ink-500 hover:text-ink-700"
              ].join(" ")}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {tab === "renewal" && (
        <RenewalListSection
          contracts={renewalContracts}
          companyById={companyById}
        />
      )}
      {tab === "reapproach" && (
        <ReapproachListSection
          records={reapproachAll}
          companyById={companyById}
          contractById={contractById}
          onComplete={markDone}
        />
      )}
    </main>
  );
}

function RenewalListSection({
  contracts,
  companyById
}: {
  contracts: ActiveContract[];
  companyById: Map<string, Company>;
}) {
  if (contracts.length === 0) {
    return (
      <div className="liquid-surface p-10 text-center text-sm text-ink-500">
        更新ウィンドウ対象の契約はありません
      </div>
    );
  }
  const sorted = contracts.slice().sort((a, b) => {
    const da = a.endDate ?? "9999-12-31";
    const db = b.endDate ?? "9999-12-31";
    return da < db ? -1 : 1;
  });
  return (
    <div className="liquid-surface overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] text-ink-500 border-b border-ink-100">
            <th className="px-5 py-3 font-medium">企業</th>
            <th className="px-3 py-3 font-medium">研修</th>
            <th className="px-3 py-3 font-medium">終了日</th>
            <th className="px-3 py-3 font-medium">残日数</th>
            <th className="px-3 py-3 font-medium">Health</th>
            <th className="px-3 py-3 font-medium">担当</th>
            <th className="px-3 py-3 font-medium">直近マイルストーン</th>
            <th className="px-5 py-3 font-medium w-16"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => {
            const co = companyById.get(c.companyId);
            const days = c.endDate ? daysBetween(c.endDate, TODAY) : null;
            const milestones = c.endDate ? generateRenewalMilestones(c.id, c.endDate) : [];
            const upcoming =
              milestones.find((m) => m.status !== "done") ??
              milestones[milestones.length - 1];
            const color = c.healthScore?.color;
            return (
              <tr key={c.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
                <td className="px-5 py-3 font-medium text-ink-900">
                  <Link href={`/companies/${c.companyId}`} className="hover:underline">
                    {co?.name ?? c.companyId}
                  </Link>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5">
                    <ProductBadge code={c.product} size="sm" />
                    {hasMultipleCourses(c.product) && (
                      <span className="text-[10px] text-ink-500">
                        {courseShortName(c.product, c.courseKey)}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-ink-700 text-xs whitespace-nowrap">
                  {c.endDate ?? "—"}
                </td>
                <td className="px-3 py-3 text-xs">
                  {days !== null ? (
                    <span
                      className={
                        days <= 30
                          ? "text-rose-600 font-semibold"
                          : days <= 60
                          ? "text-amber-600 font-semibold"
                          : "text-ink-700"
                      }
                    >
                      {days >= 0 ? `${days}日` : `${-days}日超過`}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-3">
                  {color ? (
                    <span
                      className={[
                        "text-[10px] px-2 py-0.5 rounded-full font-medium",
                        color === "green"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          : color === "yellow"
                          ? "bg-amber-50 text-amber-700 border border-amber-100"
                          : "bg-rose-50 text-rose-600 border border-rose-100"
                      ].join(" ")}
                    >
                      {color.toUpperCase()}
                    </span>
                  ) : (
                    <span className="text-[11px] text-ink-400">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-xs text-ink-700">{c.ownerName}</td>
                <td className="px-3 py-3 text-xs">
                  {upcoming ? (
                    <span className="text-ink-700">
                      <span className="text-[10px] text-ink-500 mr-1">{upcoming.type}</span>
                      <span
                        className={[
                          "text-[10px] px-1.5 py-0.5 rounded-full",
                          upcoming.status === "done"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-ink-50 text-ink-700"
                        ].join(" ")}
                      >
                        {upcoming.status === "done" ? "完了" : upcoming.dueDate.slice(5).replace("-", "/")}
                      </span>
                    </span>
                  ) : (
                    <span className="text-ink-400">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/companies/${c.companyId}`}
                    className="text-xs text-ink-700 hover:underline whitespace-nowrap"
                  >
                    →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ReapproachListSection({
  records,
  companyById,
  contractById,
  onComplete
}: {
  records: ChurnRecord[];
  companyById: Map<string, Company>;
  contractById: Map<string, ActiveContract>;
  onComplete: (contractId: string) => void;
}) {
  if (records.length === 0) {
    return (
      <div className="liquid-surface p-10 text-center text-sm text-ink-500">
        90日以内の再アプローチ予定はありません
      </div>
    );
  }
  return (
    <div className="liquid-surface overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] text-ink-500 border-b border-ink-100">
            <th className="px-5 py-3 font-medium">企業</th>
            <th className="px-3 py-3 font-medium">研修</th>
            <th className="px-3 py-3 font-medium">解約日</th>
            <th className="px-3 py-3 font-medium">理由</th>
            <th className="px-3 py-3 font-medium">次回予定日</th>
            <th className="px-3 py-3 font-medium">担当</th>
            <th className="px-3 py-3 font-medium">メモ</th>
            <th className="px-5 py-3 font-medium w-32"></th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const contract = contractById.get(r.contractId);
            const co = contract ? companyById.get(contract.companyId) : null;
            const days = r.nextActionDate ? daysBetween(r.nextActionDate, TODAY) : null;
            return (
              <tr
                key={r.contractId}
                className={[
                  "border-b border-ink-50 last:border-0 hover:bg-ink-50/50",
                  r.notified ? "opacity-60" : ""
                ].join(" ")}
              >
                <td className="px-5 py-3 font-medium text-ink-900">
                  {co ? (
                    <Link href={`/companies/${co.id}`} className="hover:underline">
                      {co.name}
                    </Link>
                  ) : (
                    r.contractId
                  )}
                </td>
                <td className="px-3 py-3">
                  {contract ? (
                    <ProductBadge code={contract.product} size="sm" />
                  ) : (
                    <span className="text-ink-400">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-xs text-ink-700">{r.churnedAt}</td>
                <td className="px-3 py-3 text-xs text-ink-700">
                  {reasonCategoryLabels[r.reasonCategory]}
                </td>
                <td className="px-3 py-3 text-xs">
                  <span
                    className={
                      days !== null && days <= 7
                        ? "text-rose-600 font-semibold"
                        : "text-ink-700"
                    }
                  >
                    {r.nextActionDate ?? "—"}
                    {days !== null && (
                      <span className="ml-1 text-[10px] text-ink-500">(あと{days}日)</span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs text-ink-700">
                  {contract?.ownerName ?? "—"}
                </td>
                <td className="px-3 py-3 text-xs text-ink-700 max-w-[280px]">
                  <div className="line-clamp-2">{r.nextActionNote ?? "—"}</div>
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    type="button"
                    disabled={r.notified}
                    onClick={() => onComplete(r.contractId)}
                    className={[
                      "px-3 py-1.5 rounded-full text-xs whitespace-nowrap",
                      r.notified
                        ? "bg-ink-50 text-ink-400 cursor-not-allowed"
                        : "bg-ink-900 text-white hover:opacity-90"
                    ].join(" ")}
                  >
                    {r.notified ? "完了済" : "アクション完了"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
