"use client";

// 週次レビュー テーブルビュー
// 1行 = 1企業 × 選択研修 × 選択週。折りたたみ状態でも全項目が並列表示され、
// 全セルがその場で編集可能。詳細ボタンで下にCompanyWeeklyEditor展開。
//
// 保存は親 WeeklyView の自動保存 (Notion 風) に委ねる。
// このコンポーネントは draft を更新するだけ。

import Link from "next/link";
import { useState } from "react";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { useActiveMembers } from "@/lib/hooks/useActiveMembers";

const FALLBACK_ASSIGNEE = "古野";
import {
  ProductCode,
  productByCode,
  hasMultipleCourses,
  courseShortName
} from "@/lib/master";
import { getWeekRange } from "@/lib/master/date";
import {
  weeksStuck,
  CURRENT_WEEK_MONDAY
} from "@/lib/master/date";
import type {
  WeeklyReview,
  WeeklyAction,
  WeeklyNextAction
} from "@/lib/master/date";
import {
  CompanyWeeklyEditor,
  WeeklyDraft,
  buildInitialDraft
} from "./CompanyWeeklyEditor";

export type TableRow = {
  companyId: string;
  companyName: string;
  courseKeys: string[];
  review: WeeklyReview | null;
  prevReview: WeeklyReview | null;
  stuckCount: number;
};

export function WeeklyTable({
  rows,
  product,
  weekStart,
  getDraft,
  setDraftFor,
  expandedCompanyIds,
  toggleExpand,
  courseKeysFor,
  reviewsFor
}: {
  rows: TableRow[];
  product: ProductCode;
  weekStart: string;
  getDraft: (cid: string) => WeeklyDraft | null;
  setDraftFor: (cid: string, d: WeeklyDraft) => void;
  expandedCompanyIds: Set<string>;
  toggleExpand: (cid: string) => void;
  courseKeysFor: (cid: string) => string[];
  reviewsFor: (cid: string) => WeeklyReview[];
}) {
  const p = productByCode[product];
  const isCurrentWeek = weekStart === CURRENT_WEEK_MONDAY;
  const weekRange = getWeekRange(weekStart);

  // 表示用の合成データ: ユーザのドラフト > DB の確定レビュー > 初期値
  // (draft より review を優先すると、入力中にテキストが消えて見える)
  const resolveDisplay = (row: TableRow): WeeklyDraft => {
    const d = getDraft(row.companyId);
    if (d) return d;
    if (row.review) {
      return {
        actions: row.review.actions,
        good: row.review.good,
        more: row.review.more,
        nextActions: row.review.nextActions
      };
    }
    return buildInitialDraft(row.prevReview);
  };

  // draft確保 + 更新ヘルパ
  const ensureAndSet = (
    row: TableRow,
    mutate: (d: WeeklyDraft) => WeeklyDraft
  ) => {
    const current =
      getDraft(row.companyId) ??
      (row.review
        ? {
            actions: row.review.actions.map((a) => ({ ...a })),
            good: row.review.good,
            more: row.review.more,
            nextActions: row.review.nextActions.map((a) => ({ ...a }))
          }
        : buildInitialDraft(row.prevReview));
    setDraftFor(row.companyId, mutate(current));
  };

  const isRowEditable = (row: TableRow) =>
    isCurrentWeek && !row.review?.locked;

  return (
    <div className="liquid-surface">
      <div className="overflow-auto rounded-liquid max-h-[calc(100vh-220px)]">
        <table className="w-full min-w-[1500px] border-collapse">
          <thead className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-ink-100 shadow-[0_2px_8px_rgba(14,15,18,0.04)]">
            <tr className="text-[11px] text-ink-500 font-medium uppercase tracking-wider">
              <th
                className="sticky left-0 z-30 bg-white/95 backdrop-blur-sm text-left p-3 min-w-[240px] w-[240px] border-r border-ink-100"
              >
                企業
              </th>
              <th className="text-left p-3 min-w-[280px]">実施事項</th>
              <th className="text-left p-3 min-w-[260px]">Good</th>
              <th className="text-left p-3 min-w-[260px]">More</th>
              <th className="text-left p-3 min-w-[280px]">Next Action</th>
              <th className="text-left p-3 w-[90px]">状態</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const data = resolveDisplay(row);
              const editable = isRowEditable(row);
              const expanded = expandedCompanyIds.has(row.companyId);
              const isFilled = row.review !== null;
              const draftDirty = getDraft(row.companyId) !== null;
              const zebra = idx % 2 === 1 ? "bg-ink-50/30" : "bg-white";

              return (
                <>
                  <tr
                    key={row.companyId}
                    className={`${zebra} border-b border-ink-50 align-top`}
                  >
                    {/* 企業 */}
                    <td
                      className={`sticky left-0 z-10 ${zebra} p-3 border-r border-ink-100 align-top`}
                    >
                      <div className="space-y-1.5">
                        <Link
                          href={`/companies/${row.companyId}`}
                          className="text-sm font-bold text-ink-900 hover:underline block"
                        >
                          {row.companyName}
                        </Link>
                        {hasMultipleCourses(product) &&
                          row.courseKeys.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {row.courseKeys.map((ck) => (
                                <span
                                  key={ck}
                                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                                  style={{
                                    color: p.accent,
                                    background: `${p.accent}14`,
                                    border: `1px solid ${p.accent}33`
                                  }}
                                >
                                  {courseShortName(product, ck)}
                                </span>
                              ))}
                            </div>
                          )}
                        <Link
                          href={`/companies/${row.companyId}`}
                          className="text-[10px] text-ink-500 hover:text-ink-700 inline-flex items-center gap-0.5"
                        >
                          詳細ページ →
                        </Link>
                      </div>
                    </td>

                    {/* 実施事項 */}
                    <td className="p-3 align-top">
                      <ActionsCell
                        actions={data.actions}
                        editable={editable}
                        currentWeekLabel={weekRange.label}
                        onToggle={(id) => {
                          ensureAndSet(row, (cur) => ({
                            ...cur,
                            actions: cur.actions.map((a) =>
                              a.id === id
                                ? {
                                    ...a,
                                    done: !a.done,
                                    completedAt: !a.done
                                      ? new Date().toISOString().slice(0, 10)
                                      : undefined
                                  }
                                : a
                            )
                          }));
                        }}
                        onAddNew={(text) => {
                          ensureAndSet(row, (cur) => ({
                            ...cur,
                            actions: [
                              ...cur.actions,
                              {
                                id: `new-${Date.now()}`,
                                text,
                                done: true,
                                assigneeName: "古野",
                                completedAt: new Date()
                                  .toISOString()
                                  .slice(0, 10)
                              }
                            ]
                          }));
                        }}
                      />
                    </td>

                    {/* Good */}
                    <td className="p-3 align-top">
                      <TextareaCell
                        value={data.good}
                        editable={editable}
                        tone="good"
                        placeholder="うまくいったこと..."
                        onChange={(v) =>
                          ensureAndSet(row, (cur) => ({ ...cur, good: v }))
                        }
                      />
                    </td>

                    {/* More */}
                    <td className="p-3 align-top">
                      <TextareaCell
                        value={data.more}
                        editable={editable}
                        tone="more"
                        placeholder="改善点・課題..."
                        onChange={(v) =>
                          ensureAndSet(row, (cur) => ({ ...cur, more: v }))
                        }
                      />
                    </td>

                    {/* Next */}
                    <td className="p-3 align-top">
                      <NextActionsCell
                        actions={data.nextActions}
                        editable={editable}
                        onChange={(list) =>
                          ensureAndSet(row, (cur) => ({
                            ...cur,
                            nextActions: list
                          }))
                        }
                      />
                    </td>

                    {/* 状態 */}
                    <td className="p-3 align-top">
                      <div className="flex flex-col items-start gap-1.5">
                        {isFilled ? (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                            入力済
                          </span>
                        ) : draftDirty ? (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100">
                            下書き
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100">
                            未入力
                          </span>
                        )}
                        {row.stuckCount > 0 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                            ⚠ Stuck {row.stuckCount}
                          </span>
                        )}
                        <button
                          onClick={() => toggleExpand(row.companyId)}
                          className="text-[10px] px-2 py-0.5 rounded-full border border-ink-100 text-ink-700 hover:bg-ink-50 whitespace-nowrap"
                        >
                          {expanded ? "▲ 閉じる" : "▼ 詳細"}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {expanded && (
                    <tr
                      key={`${row.companyId}-expand`}
                      className="bg-ink-50/40 border-b border-ink-50"
                    >
                      <td
                        colSpan={6}
                        className="p-5"
                      >
                        <CompanyWeeklyEditor
                          companyId={row.companyId}
                          product={product}
                          weekStart={weekStart}
                          draft={getDraft(row.companyId)}
                          setDraft={(d) => setDraftFor(row.companyId, d)}
                          courseKeys={courseKeysFor(row.companyId)}
                          reviewsForCompany={reviewsFor(row.companyId)}
                        />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="p-10 text-center text-sm text-ink-500"
                >
                  該当する企業はありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────────────── セル: 実施事項 ──────────────────
function ActionsCell({
  actions,
  editable,
  currentWeekLabel,
  onToggle,
  onAddNew
}: {
  actions: WeeklyAction[];
  editable: boolean;
  currentWeekLabel: string;
  onToggle: (id: string) => void;
  onAddNew: (text: string) => void;
}) {
  const [newText, setNewText] = useState("");
  const carried = actions.filter((a) => a.fromPrevWeek);
  const added = actions.filter((a) => !a.fromPrevWeek);

  return (
    <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
      {carried.length === 0 && added.length === 0 && !editable && (
        <div className="text-[11px] text-ink-400">—</div>
      )}
      {carried.map((a) => {
        const stuck = a.carriedFromWeek
          ? weeksStuck(a.carriedFromWeek, currentWeekLabel)
          : 0;
        return (
          <label
            key={a.id}
            className={[
              "flex items-start gap-1.5 px-1.5 py-1 rounded-md cursor-pointer hover:bg-ink-50/60",
              stuck >= 2 && !a.done
                ? "border border-rose-200 bg-rose-50/40"
                : ""
            ].join(" ")}
          >
            <input
              type="checkbox"
              checked={a.done}
              disabled={!editable}
              onChange={() => editable && onToggle(a.id)}
              className="mt-0.5 w-3.5 h-3.5 rounded accent-ink-900 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div
                className={[
                  "text-[12px] leading-snug",
                  a.done
                    ? "text-ink-500 line-through"
                    : "text-ink-400"
                ].join(" ")}
              >
                {a.text}
              </div>
              {stuck >= 2 && !a.done && (
                <div className="text-[10px] text-rose-500 font-semibold mt-0.5">
                  ⚠ {stuck}週持越
                </div>
              )}
            </div>
          </label>
        );
      })}
      {added.map((a) => (
        <div
          key={a.id}
          className="flex items-start gap-1.5 px-1.5 py-1 rounded-md bg-white border border-ink-100"
        >
          <span className="mt-0.5 text-emerald-600 text-[11px] shrink-0">✓</span>
          <div className="text-[12px] leading-snug text-ink-900">{a.text}</div>
        </div>
      ))}
      {editable && (
        <div className="flex items-center gap-1 pt-1">
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="+ 実施したことを追加"
            className="flex-1 text-[11px] rounded-lg border border-ink-100 bg-white px-2 py-1 focus:outline-hidden focus:border-ink-300"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newText.trim()) {
                onAddNew(newText.trim());
                setNewText("");
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

// ────────────────── セル: Good/More ──────────────────
function TextareaCell({
  value,
  editable,
  tone,
  placeholder,
  onChange
}: {
  value: string;
  editable: boolean;
  tone: "good" | "more";
  placeholder: string;
  onChange: (v: string) => void;
}) {
  const toneBg =
    tone === "good"
      ? "bg-emerald-50/30 border-emerald-100 focus:border-emerald-300"
      : "bg-amber-50/30 border-amber-100 focus:border-amber-300";
  if (!editable) {
    return (
      <div
        className={`rounded-lg border ${toneBg} px-2 py-1.5 text-[12px] text-ink-700 min-h-[80px] whitespace-pre-wrap leading-snug`}
      >
        {value || <span className="text-ink-400">—</span>}
      </div>
    );
  }
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-lg border ${toneBg} bg-white px-2 py-1.5 text-[12px] text-ink-700 min-h-[80px] max-h-[220px] leading-snug resize-y focus:outline-hidden`}
    />
  );
}

// ────────────────── セル: NextActions ──────────────────
function NextActionsCell({
  actions,
  editable,
  onChange
}: {
  actions: WeeklyNextAction[];
  editable: boolean;
  onChange: (list: WeeklyNextAction[]) => void;
}) {
  const { name: currentUserName } = useCurrentUser();
  const { names: assigneeOptions } = useActiveMembers();
  const [newText, setNewText] = useState("");
  const update = (id: string, patch: Partial<WeeklyNextAction>) =>
    onChange(actions.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const remove = (id: string) => onChange(actions.filter((a) => a.id !== id));
  const add = () => {
    if (!newText.trim()) return;
    onChange([
      ...actions,
      {
        id: `next-${Date.now()}`,
        text: newText.trim(),
        assigneeName: currentUserName ?? FALLBACK_ASSIGNEE
      }
    ]);
    setNewText("");
  };

  return (
    <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
      {actions.length === 0 && !editable && (
        <div className="text-[11px] text-ink-400">—</div>
      )}
      {actions.map((a) => {
        const hasAssignee = Boolean(a.assigneeName);
        return (
          <div
            key={a.id}
            className={[
              "rounded-lg border px-1.5 py-1 space-y-1",
              hasAssignee
                ? "border-ink-100 bg-white"
                : "border-amber-200 bg-amber-50"
            ].join(" ")}
          >
            <div className="flex items-start gap-1">
              {editable ? (
                <input
                  type="text"
                  value={a.text}
                  onChange={(e) => update(a.id, { text: e.target.value })}
                  className="flex-1 text-[12px] rounded border border-transparent hover:border-ink-100 focus:border-ink-300 focus:outline-hidden px-1 py-0.5 bg-white"
                />
              ) : (
                <div className="flex-1 text-[12px] text-ink-900 px-1">
                  {a.text}
                </div>
              )}
              {editable && (
                <button
                  onClick={() => remove(a.id)}
                  className="text-ink-300 hover:text-rose-500 text-xs leading-none px-1"
                >
                  ×
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {editable ? (
                <select
                  value={a.assigneeName}
                  onChange={(e) =>
                    update(a.id, { assigneeName: e.target.value })
                  }
                  className="text-[10px] rounded-lg border border-ink-100 bg-white px-1.5 py-0.5"
                >
                  {assigneeOptions.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-[10px] text-ink-700">
                  {a.assigneeName || "—"}
                </span>
              )}
              {editable ? (
                <input
                  type="date"
                  value={a.dueDate ?? ""}
                  onChange={(e) =>
                    update(a.id, { dueDate: e.target.value || undefined })
                  }
                  className="text-[10px] rounded-lg border border-ink-100 bg-white px-1.5 py-0.5"
                />
              ) : (
                a.dueDate && (
                  <span className="text-[10px] text-ink-500">
                    期限 {a.dueDate.slice(5)}
                  </span>
                )
              )}
            </div>
          </div>
        );
      })}
      {editable && (
        <div className="flex items-center gap-1 pt-1">
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="+ 来週やることを追加"
            className="flex-1 text-[11px] rounded-lg border border-ink-100 bg-white px-2 py-1 focus:outline-hidden focus:border-ink-300"
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
        </div>
      )}
    </div>
  );
}
