"use client";

import Link from "next/link";
// コース表示に対応
import { ProductCode, productByCode, hasMultipleCourses, courseShortName } from "@/lib/mock/data";
import {
  activeContracts,
  contractOnboardingItems,
  productOnboardingTemplates,
  categoryProgress,
  contractProgress,
  daysUntilStart,
  ActiveContract
} from "@/lib/mock/onboarding";
import { companies } from "@/lib/mock/entities";

function companyName(id: string): string {
  return companies.find((c) => c.id === id)?.name ?? id;
}

// セルの描画: 大: 項目レベル(●○🔴) / 小: カテゴリレベル(進捗バー)
export function MatrixView({
  product,
  contracts,
  mode
}: {
  product: ProductCode;
  contracts: ActiveContract[];
  mode: "category" | "item";
}) {
  const p = productByCode[product];
  const template = productOnboardingTemplates[product]
    .slice()
    .sort((a, b) => a.order - b.order);

  if (mode === "category") {
    return (
      <div className="liquid-surface overflow-auto max-h-[calc(100vh-220px)]">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-[11px] text-ink-500 border-b border-ink-100">
              <th className="sticky left-0 top-0 bg-white z-30 px-4 py-3 font-medium min-w-[240px] border-b border-ink-100">
                企業
              </th>
              <th className="sticky top-0 bg-white z-20 px-3 py-3 font-medium whitespace-nowrap border-b border-ink-100">残日数</th>
              <th className="sticky top-0 bg-white z-20 px-3 py-3 font-medium whitespace-nowrap border-b border-ink-100">担当</th>
              {template.map((cat) => (
                <th
                  key={cat.key}
                  className="sticky top-0 bg-white z-20 px-3 py-3 font-medium min-w-[130px] border-b border-ink-100"
                >
                  {cat.label}
                </th>
              ))}
              <th className="sticky top-0 bg-white z-20 px-3 py-3 font-medium min-w-[140px] border-b border-ink-100">全体</th>
              <th className="sticky top-0 bg-white z-20 px-3 py-3 font-medium whitespace-nowrap border-b border-ink-100">期日超過</th>
              <th className="sticky top-0 bg-white z-20 px-4 py-3 font-medium w-8 border-b border-ink-100"></th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((c) => {
              const prog = contractProgress(c.id);
              const days = daysUntilStart(c.startDate);
              return (
                <tr
                  key={c.id}
                  className="border-b border-ink-50 last:border-0 hover:bg-ink-50/40 group"
                >
                  <td className="sticky left-0 bg-white/95 backdrop-blur z-10 px-4 py-3 font-medium">
                    <Link
                      href={`/onboarding/${c.id}`}
                      className="block group-hover:underline"
                    >
                      <div className="text-ink-900">
                        {companyName(c.companyId)}
                      </div>
                      {hasMultipleCourses(c.product) && (
                        <div className="text-[11px] text-ink-500">
                          {courseShortName(c.product, c.courseKey)}
                        </div>
                      )}
                    </Link>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span
                      className={[
                        "text-[11px] font-medium px-2 py-0.5 rounded-full",
                        days < 0
                          ? "bg-rose-50 text-rose-600 border border-rose-200"
                          : days <= 7
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-ink-50 text-ink-700 border border-ink-100"
                      ].join(" ")}
                    >
                      {days < 0
                        ? `超過 ${Math.abs(days)}`
                        : days === 0
                        ? "当日"
                        : `${days}日`}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-ink-700 whitespace-nowrap">
                    {c.ownerName}
                  </td>
                  {template.map((cat) => {
                    const cp = categoryProgress(c.id, cat.key);
                    const overdue = contractOnboardingItems.filter(
                      (i) =>
                        i.contractId === c.id &&
                        i.categoryKey === cat.key &&
                        i.status === "overdue"
                    ).length;
                    const pct = cp.total > 0 ? (cp.done / cp.total) * 100 : 0;
                    return (
                      <td key={cat.key} className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="relative rounded-full bg-ink-100 overflow-hidden h-1.5 flex-1">
                            <div
                              className="absolute inset-y-0 left-0 rounded-full"
                              style={{
                                width: `${pct}%`,
                                background: p.accent
                              }}
                            />
                          </div>
                          <span className="text-[11px] text-ink-700 font-medium whitespace-nowrap">
                            {cp.done}/{cp.total}
                          </span>
                          {overdue > 0 && (
                            <span className="text-[10px] text-rose-500 whitespace-nowrap">
                              🔴{overdue}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="relative rounded-full bg-ink-100 overflow-hidden h-2 flex-1">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{
                            width: `${
                              prog.total > 0
                                ? (prog.done / prog.total) * 100
                                : 0
                            }%`,
                            background: p.accent
                          }}
                        />
                      </div>
                      <span className="text-[11px] text-ink-900 font-bold whitespace-nowrap">
                        {prog.done}/{prog.total}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {prog.overdue > 0 ? (
                      <span className="text-[11px] font-semibold text-rose-500">
                        {prog.overdue}
                      </span>
                    ) : (
                      <span className="text-[11px] text-ink-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/onboarding/${c.id}`}
                      className="text-[11px] text-ink-500 hover:text-ink-700"
                    >
                      詳細 →
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

  // 項目レベル: すべてのチェック項目を列として展開
  const allItems = template.flatMap((cat) =>
    cat.items.map((it) => ({ catKey: cat.key, catLabel: cat.label, ...it }))
  );

  return (
    <div className="liquid-surface overflow-auto max-h-[calc(100vh-220px)]">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="text-left text-[10px] text-ink-500 border-b border-ink-100">
            <th
              rowSpan={2}
              className="sticky left-0 top-0 bg-white z-30 px-4 py-2 font-medium min-w-[200px] border-b border-ink-100"
            >
              企業
            </th>
            {template.map((cat) => (
              <th
                key={cat.key}
                colSpan={cat.items.length}
                className="sticky top-0 bg-white z-20 px-2 py-2 font-semibold text-center border-l border-ink-100 text-ink-700"
              >
                {cat.label}
              </th>
            ))}
            <th
              rowSpan={2}
              className="sticky top-0 bg-white z-20 px-2 py-2 font-medium text-center min-w-[80px] border-l border-ink-100 border-b"
            >
              進捗
            </th>
          </tr>
          <tr className="text-[10px] text-ink-500 border-b border-ink-100">
            {allItems.map((it) => (
              <th
                key={`${it.catKey}-${it.key}`}
                className="sticky top-[34px] bg-white z-20 px-2 py-2 font-normal text-center min-w-[80px] border-l border-ink-100 border-b"
                title={it.name}
              >
                <div className="line-clamp-2 leading-tight text-ink-700">
                  {it.name}
                </div>
                {it.required && (
                  <div className="mt-0.5 text-[9px] text-rose-500">必須</div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {contracts.map((c) => {
            const prog = contractProgress(c.id);
            return (
              <tr
                key={c.id}
                className="border-b border-ink-50 last:border-0 hover:bg-ink-50/40 group"
              >
                <td className="sticky left-0 bg-white/95 backdrop-blur z-10 px-4 py-2 font-medium">
                  <Link
                    href={`/onboarding/${c.id}`}
                    className="block group-hover:underline"
                  >
                    <div className="text-ink-900 text-sm">
                      {companyName(c.companyId)}
                    </div>
                    {hasMultipleCourses(c.product) && (
                      <div className="text-[10px] text-ink-500">
                        {courseShortName(c.product, c.courseKey)}
                      </div>
                    )}
                    <div className="text-[10px] text-ink-500">
                      開始 {c.startDate.slice(5).replace("-", "/")} · {c.ownerName}
                    </div>
                  </Link>
                </td>
                {allItems.map((it) => {
                  const item = contractOnboardingItems.find(
                    (x) =>
                      x.contractId === c.id &&
                      x.categoryKey === it.catKey &&
                      x.itemKey === it.key
                  );
                  return (
                    <td
                      key={`${it.catKey}-${it.key}`}
                      className="px-2 py-2 text-center border-l border-ink-50"
                    >
                      {!item ? (
                        <span className="text-ink-300">—</span>
                      ) : item.status === "done" ? (
                        <span
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] font-bold"
                          style={{ background: p.accent }}
                          title={`完了 ${item.completedAt ?? ""}`}
                        >
                          ✓
                        </span>
                      ) : item.status === "overdue" ? (
                        <span
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold"
                          title={`期日超過 ${item.dueDate}`}
                        >
                          !
                        </span>
                      ) : item.status === "doing" ? (
                        <span
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white border-2 text-[10px]"
                          style={{ borderColor: p.accent, color: p.accent }}
                          title={`進行中 期日${item.dueDate}`}
                        >
                          ◐
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-ink-300 text-ink-300 text-[10px]"
                          title={`未着手 期日${item.dueDate}`}
                        >
                          ○
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-center border-l border-ink-100 text-[11px] font-bold whitespace-nowrap">
                  {prog.done}/{prog.total}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex items-center gap-4 px-4 py-3 border-t border-ink-100 text-[11px] text-ink-500 flex-wrap">
        <span className="font-medium">凡例:</span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] font-bold"
            style={{ background: p.accent }}
          >
            ✓
          </span>
          完了
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white border-2 text-[10px]"
            style={{ borderColor: p.accent, color: p.accent }}
          >
            ◐
          </span>
          進行中
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-ink-300 text-ink-300 text-[10px]">
            ○
          </span>
          未着手
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
            !
          </span>
          期日超過
        </span>
      </div>
    </div>
  );
}
