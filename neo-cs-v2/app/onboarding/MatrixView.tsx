"use client";

// オンボ一覧マトリクス (item モードのみ)。
// 行=契約 / 列=各オンボ項目。各セルに status / 担当 / 期日 / メモ を表示し、
// 列ヘッダで期日と責任者を一括設定できる。事業内ToDo マトリクスと同じ操作感。

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  type ProductCode,
  productByCode,
  hasMultipleCourses,
  courseShortName
} from "@/lib/mock/data";
import {
  productOnboardingTemplates,
  type ActiveContract
} from "@/lib/mock/onboarding";
import type {
  ContractOnboardingItem,
  OnboardingItemEditableStatus
} from "@/lib/repository/types";
import {
  setOnboardingItemAssignee,
  setOnboardingItemDueDate,
  setOnboardingItemNote,
  setOnboardingItemStatus
} from "./[contractId]/itemActions";

const STATUS_LABEL: Record<OnboardingItemEditableStatus, string> = {
  todo: "未着手",
  doing: "進行中",
  done: "完了",
  not_applicable: "実施必要なし"
};

const STATUS_CYCLE: OnboardingItemEditableStatus[] = [
  "todo",
  "doing",
  "done",
  "not_applicable"
];

export function MatrixView({
  product,
  contracts,
  itemsByContract,
  companyMap,
  users,
  today
}: {
  product: ProductCode;
  contracts: ActiveContract[];
  itemsByContract: Record<string, ContractOnboardingItem[]>;
  companyMap: Record<string, string>;
  users: { id: string; name: string }[];
  today: string;
}) {
  const p = productByCode[product];
  const template = productOnboardingTemplates[product]
    .slice()
    .sort((a, b) => a.order - b.order);

  // ローカル state (optimistic update 用)
  const [localItems, setLocalItems] = useState<
    Record<string, ContractOnboardingItem[]>
  >(itemsByContract);
  useEffect(() => {
    setLocalItems(itemsByContract);
  }, [itemsByContract]);

  const [, startTransition] = useTransition();

  // セル詳細エディタ (右クリック)
  const [editor, setEditor] = useState<
    { itemId: string; contractId: string; x: number; y: number } | null
  >(null);
  // セル単独 担当プルダウン (左クリック)
  const [assigneeMenu, setAssigneeMenu] = useState<
    { itemId: string; contractId: string; x: number; y: number } | null
  >(null);
  // セル単独 期日 input
  const [editingDue, setEditingDue] = useState<string | null>(null);
  // メモモーダル
  const [noteEditor, setNoteEditor] = useState<
    { itemId: string; contractId: string; itemName: string; draft: string } | null
  >(null);
  // 列ヘッダ 責任者プルダウン
  const [colResponsible, setColResponsible] = useState<
    { catKey: string; itemKey: string; x: number; y: number } | null
  >(null);

  // 列単位の入力値 (日付・責任者) — bulk-apply のためのローカル状態
  const [colDueDate, setColDueDate] = useState<Record<string, string>>({});
  const [colResponsibleId, setColResponsibleId] = useState<Record<string, string>>({});

  const userMap = useMemo(
    () => new Map(users.map((u) => [u.id, u.name])),
    [users]
  );

  function colKey(catKey: string, itemKey: string): string {
    return `${catKey}::${itemKey}`;
  }

  function patchItem(
    contractId: string,
    itemId: string,
    patch: Partial<ContractOnboardingItem>
  ) {
    setLocalItems((prev) => {
      const arr = prev[contractId] ?? [];
      return {
        ...prev,
        [contractId]: arr.map((i) =>
          i.id === itemId ? { ...i, ...patch } : i
        )
      };
    });
  }

  function changeStatus(item: ContractOnboardingItem, next: OnboardingItemEditableStatus) {
    const original = item.status;
    patchItem(item.contractId, item.id, { status: next });
    startTransition(async () => {
      try {
        await setOnboardingItemStatus(item.id, item.contractId, next);
      } catch (e) {
        console.error(e);
        patchItem(item.contractId, item.id, { status: original });
      }
    });
  }

  function cycleStatus(item: ContractOnboardingItem) {
    const cur = isEditable(item.status) ? item.status : "todo";
    const i = STATUS_CYCLE.indexOf(cur);
    changeStatus(item, STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length]);
  }

  function changeAssignee(item: ContractOnboardingItem, userId: string) {
    const next = userId || null;
    const display = next ? userMap.get(next) ?? next : "";
    const original = item.assignee;
    patchItem(item.contractId, item.id, { assignee: display });
    startTransition(async () => {
      try {
        await setOnboardingItemAssignee(item.id, item.contractId, next);
      } catch (e) {
        console.error(e);
        patchItem(item.contractId, item.id, { assignee: original });
      }
    });
  }

  function changeDueDate(item: ContractOnboardingItem, value: string) {
    const original = item.dueDate;
    patchItem(item.contractId, item.id, { dueDate: value });
    startTransition(async () => {
      try {
        await setOnboardingItemDueDate(item.id, item.contractId, value || null);
      } catch (e) {
        console.error(e);
        patchItem(item.contractId, item.id, { dueDate: original });
      }
    });
  }

  function saveNote() {
    if (!noteEditor) return;
    const value = noteEditor.draft.trim() === "" ? null : noteEditor.draft;
    const itemId = noteEditor.itemId;
    const contractId = noteEditor.contractId;
    const original = (localItems[contractId] ?? []).find((i) => i.id === itemId)?.note;
    patchItem(contractId, itemId, { note: value ?? undefined });
    setNoteEditor(null);
    startTransition(async () => {
      try {
        await setOnboardingItemNote(itemId, contractId, value);
      } catch (e) {
        console.error(e);
        patchItem(contractId, itemId, { note: original });
      }
    });
  }

  // 列の期日を一括設定 (open 状態のセルのみ反映)
  function bulkApplyDueDate(catKey: string, itemKey: string, value: string) {
    setColDueDate((prev) => ({ ...prev, [colKey(catKey, itemKey)]: value }));
    const next = value || null;
    for (const c of contracts) {
      const items = localItems[c.id] ?? [];
      const item = items.find(
        (i) => i.categoryKey === catKey && i.itemKey === itemKey
      );
      if (!item) continue;
      if (item.status === "done" || item.status === "not_applicable") continue;
      patchItem(c.id, item.id, { dueDate: value });
      startTransition(async () => {
        try {
          await setOnboardingItemDueDate(item.id, c.id, next);
        } catch (e) {
          console.error(e);
        }
      });
    }
  }

  // 列の責任者を一括設定
  function bulkApplyResponsible(catKey: string, itemKey: string, userId: string) {
    setColResponsibleId((prev) => ({ ...prev, [colKey(catKey, itemKey)]: userId }));
    const next = userId || null;
    const display = next ? userMap.get(next) ?? next : "";
    for (const c of contracts) {
      const items = localItems[c.id] ?? [];
      const item = items.find(
        (i) => i.categoryKey === catKey && i.itemKey === itemKey
      );
      if (!item) continue;
      if (item.status === "done" || item.status === "not_applicable") continue;
      patchItem(c.id, item.id, { assignee: display });
      startTransition(async () => {
        try {
          await setOnboardingItemAssignee(item.id, c.id, next);
        } catch (e) {
          console.error(e);
        }
      });
    }
  }

  // 列ごとの完了数を集計
  const completionByCol = useMemo(() => {
    const m = new Map<string, { done: number; total: number }>();
    for (const cat of template) {
      for (const it of cat.items) {
        m.set(colKey(cat.key, it.key), { done: 0, total: 0 });
      }
    }
    for (const c of contracts) {
      const items = localItems[c.id] ?? [];
      for (const i of items) {
        const k = colKey(i.categoryKey, i.itemKey);
        const s = m.get(k);
        if (!s) continue;
        if (i.status === "not_applicable") continue;
        s.total++;
        if (i.status === "done") s.done++;
      }
    }
    return m;
  }, [contracts, localItems, template]);

  const allItems = template.flatMap((cat) =>
    cat.items.map((it) => ({ catKey: cat.key, catLabel: cat.label, ...it }))
  );

  function findItem(
    contractId: string,
    catKey: string,
    itemKey: string
  ): ContractOnboardingItem | undefined {
    return (localItems[contractId] ?? []).find(
      (x) => x.categoryKey === catKey && x.itemKey === itemKey
    );
  }

  return (
    <div className="liquid-surface overflow-auto max-h-[calc(100vh-160px)]">
      <table className="text-xs border-separate border-spacing-0">
        <thead>
          <tr>
            <th
              rowSpan={2}
              style={{ minWidth: 240, width: 240 }}
              className="text-left px-4 py-2 text-[11px] font-medium text-ink-500 sticky top-0 left-0 bg-white z-30 border-b border-ink-100"
            >
              企業
            </th>
            {template.map((cat) => (
              <th
                key={cat.key}
                colSpan={cat.items.length}
                className="sticky top-0 bg-white z-20 px-2 py-2 font-semibold text-center border-l border-b border-ink-100 text-ink-700"
              >
                {cat.label}
              </th>
            ))}
            <th
              rowSpan={2}
              className="sticky top-0 bg-white z-20 px-2 py-2 font-medium text-center min-w-[80px] border-l border-b border-ink-100"
            >
              進捗
            </th>
          </tr>
          <tr>
            {allItems.map((it) => {
              const c = completionByCol.get(colKey(it.catKey, it.key)) ?? { done: 0, total: 0 };
              const pct = c.total === 0 ? 0 : Math.round((c.done / c.total) * 100);
              const k = colKey(it.catKey, it.key);
              return (
                <th
                  key={k}
                  style={{ minWidth: 140, width: 140 }}
                  className="sticky top-[34px] bg-white z-20 px-1.5 py-2 font-normal text-center border-l border-b border-ink-100 align-top"
                  title={it.name}
                >
                  <div className="line-clamp-2 leading-tight text-ink-700 text-[11px] font-semibold">
                    {it.name}
                  </div>
                  {it.required && (
                    <div className="text-[9px] text-rose-500 font-normal">
                      必須
                    </div>
                  )}
                  {/* 列の期日 (一括) */}
                  <div className="mt-1.5">
                    <input
                      type="date"
                      value={colDueDate[k] ?? ""}
                      onChange={(e) => bulkApplyDueDate(it.catKey, it.key, e.target.value)}
                      className="w-full text-[10px] px-1 py-0.5 rounded border border-ink-200 bg-white text-ink-700 font-normal"
                      title="この列の期日を一括設定 (open セルに反映)"
                    />
                  </div>
                  {/* 列の責任者 (一括) */}
                  <div className="mt-1">
                    <ColumnResponsibleTrigger
                      currentName={
                        colResponsibleId[k]
                          ? userMap.get(colResponsibleId[k]) ?? null
                          : null
                      }
                      isOpen={
                        colResponsible?.catKey === it.catKey &&
                        colResponsible?.itemKey === it.key
                      }
                      onToggle={(rect) => {
                        if (
                          colResponsible?.catKey === it.catKey &&
                          colResponsible?.itemKey === it.key
                        ) {
                          setColResponsible(null);
                        } else {
                          setColResponsible({
                            catKey: it.catKey,
                            itemKey: it.key,
                            x: rect.left + rect.width / 2,
                            y: rect.bottom + 4
                          });
                        }
                      }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] text-ink-700 font-medium">
                    完了 {c.done}/{c.total}
                    <span className="ml-0.5 text-ink-500 font-normal">({pct}%)</span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {contracts.map((c) => {
            const items = localItems[c.id] ?? [];
            const prog = computeProgress(items, today);
            return (
              <tr key={c.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/40">
                <td
                  style={{ minWidth: 240, width: 240 }}
                  className="sticky left-0 bg-white/95 backdrop-blur z-10 px-4 py-2 font-medium align-top"
                >
                  <Link
                    href={`/onboarding/${c.id}`}
                    className="block hover:underline"
                  >
                    <div className="text-ink-900 text-sm leading-snug">
                      {companyMap[c.companyId] ?? c.companyId}
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
                  const item = findItem(c.id, it.catKey, it.key);
                  return (
                    <td
                      key={`${it.catKey}-${it.key}`}
                      className="px-1.5 py-2 text-center border-l border-b border-ink-50 align-top"
                    >
                      {!item ? (
                        <span className="text-ink-300">—</span>
                      ) : (
                        <CompactCell
                          item={item}
                          accent={p.accent}
                          today={today}
                          userMap={userMap}
                          isAssigneeMenuOpen={
                            assigneeMenu?.itemId === item.id
                          }
                          editingDue={editingDue === item.id}
                          onCycleStatus={() => cycleStatus(item)}
                          onOpenStatusEditor={(e) => {
                            e.preventDefault();
                            setEditor({
                              itemId: item.id,
                              contractId: item.contractId,
                              x: e.clientX,
                              y: e.clientY
                            });
                          }}
                          onOpenNote={() =>
                            setNoteEditor({
                              itemId: item.id,
                              contractId: item.contractId,
                              itemName: item.name,
                              draft: item.note ?? ""
                            })
                          }
                          onToggleAssigneeMenu={(rect) => {
                            if (assigneeMenu?.itemId === item.id) {
                              setAssigneeMenu(null);
                            } else {
                              setAssigneeMenu({
                                itemId: item.id,
                                contractId: item.contractId,
                                x: rect.left + rect.width / 2,
                                y: rect.bottom + 4
                              });
                            }
                          }}
                          onStartEditDue={() => setEditingDue(item.id)}
                          onEndEditDue={() => setEditingDue(null)}
                          onChangeDueDate={(d) => changeDueDate(item, d)}
                        />
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-center border-l border-b border-ink-100 text-[11px] font-bold whitespace-nowrap align-top">
                  {prog.done}/{prog.total}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* 凡例 */}
      <div className="flex items-center gap-3 px-4 py-3 border-t border-ink-100 text-[11px] text-ink-500 flex-wrap">
        <span className="font-medium text-ink-600">凡例:</span>
        <Legend symbol="✓" label="完了" cls="text-white" style={{ background: p.accent, borderColor: p.accent }} />
        <Legend symbol="◐" label="進行中" cls="bg-white border-2" style={{ borderColor: p.accent, color: p.accent }} />
        <Legend symbol="○" label="未着手" cls="bg-white text-ink-300 border border-ink-300" />
        <Legend symbol="!" label="期日超過" cls="bg-rose-500 text-white border border-rose-500" />
        <Legend symbol="⊘" label="実施必要なし" cls="bg-ink-100 text-ink-500 border border-ink-200" />
        <span className="ml-auto text-[10px] text-ink-400">
          クリック=ステータス循環 / 右クリック=全ステータス選択
        </span>
      </div>

      {/* セル詳細エディタ (右クリック) */}
      {editor &&
        (() => {
          const item = (localItems[editor.contractId] ?? []).find(
            (x) => x.id === editor.itemId
          );
          if (!item) return null;
          return (
            <StatusMenu
              x={editor.x}
              y={editor.y}
              currentStatus={item.status}
              onSelect={(s) => {
                changeStatus(item, s);
                setEditor(null);
              }}
              onClose={() => setEditor(null)}
            />
          );
        })()}

      {/* 担当プルダウン (セル) */}
      {assigneeMenu &&
        (() => {
          const item = (localItems[assigneeMenu.contractId] ?? []).find(
            (x) => x.id === assigneeMenu.itemId
          );
          if (!item) return null;
          return (
            <AssigneeMenu
              x={assigneeMenu.x}
              y={assigneeMenu.y}
              currentUserId={userIdForAssignee(item.assignee, userMap)}
              users={users}
              onSelect={(uid) => {
                changeAssignee(item, uid);
                setAssigneeMenu(null);
              }}
              onClose={() => setAssigneeMenu(null)}
            />
          );
        })()}

      {/* 列ヘッダ 責任者プルダウン */}
      {colResponsible &&
        (() => {
          const k = colKey(colResponsible.catKey, colResponsible.itemKey);
          return (
            <AssigneeMenu
              x={colResponsible.x}
              y={colResponsible.y}
              currentUserId={colResponsibleId[k] ?? null}
              users={users}
              title="列の責任者 (一括設定)"
              onSelect={(uid) => {
                bulkApplyResponsible(colResponsible.catKey, colResponsible.itemKey, uid);
                setColResponsible(null);
              }}
              onClose={() => setColResponsible(null)}
            />
          );
        })()}

      {/* メモモーダル */}
      {noteEditor && (
        <NoteModal
          draft={noteEditor.draft}
          itemName={noteEditor.itemName}
          onChange={(v) =>
            setNoteEditor((prev) => (prev ? { ...prev, draft: v } : prev))
          }
          onSave={saveNote}
          onCancel={() => setNoteEditor(null)}
        />
      )}
    </div>
  );
}

function isEditable(s: ContractOnboardingItem["status"]): s is OnboardingItemEditableStatus {
  return s === "todo" || s === "doing" || s === "done" || s === "not_applicable";
}

function isOverdue(item: ContractOnboardingItem, today: string): boolean {
  if (item.status === "done" || item.status === "not_applicable") return false;
  if (!item.dueDate) return false;
  return item.dueDate < today;
}

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
    )
      overdue++;
  }
  return { done, overdue, total };
}

function userIdForAssignee(assignee: string, userMap: Map<string, string>): string | null {
  if (!assignee) return null;
  for (const [uid, name] of userMap) {
    if (name === assignee) return uid;
  }
  return null;
}

function formatDate(d: string): string {
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return d;
  return `${Number(m[2])}/${Number(m[3])}`;
}

// ─────────────────────────────────────────────
// CompactCell: status badge + memo + assignee + due (programs と同じレイアウト)
// ─────────────────────────────────────────────
function CompactCell({
  item,
  accent,
  today,
  userMap,
  isAssigneeMenuOpen,
  editingDue,
  onCycleStatus,
  onOpenStatusEditor,
  onOpenNote,
  onToggleAssigneeMenu,
  onStartEditDue,
  onEndEditDue,
  onChangeDueDate
}: {
  item: ContractOnboardingItem;
  accent: string;
  today: string;
  userMap: Map<string, string>;
  isAssigneeMenuOpen: boolean;
  editingDue: boolean;
  onCycleStatus: () => void;
  onOpenStatusEditor: (e: React.MouseEvent) => void;
  onOpenNote: () => void;
  onToggleAssigneeMenu: (rect: DOMRect) => void;
  onStartEditDue: () => void;
  onEndEditDue: () => void;
  onChangeDueDate: (d: string) => void;
}) {
  const overdue = isOverdue(item, today);
  const assigneeName = item.assignee || null;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative inline-flex items-center">
        <StatusBadge
          item={item}
          overdue={overdue}
          accent={accent}
          onClick={onCycleStatus}
          onContextMenu={onOpenStatusEditor}
        />
        <button
          type="button"
          onClick={onOpenNote}
          title={item.note ? `メモ: ${item.note}` : "メモを残す"}
          className={[
            "absolute -right-3.5 -top-1 inline-flex items-center justify-center text-[11px] leading-none transition",
            item.note
              ? "text-amber-500 font-bold"
              : "text-ink-300 hover:text-ink-600"
          ].join(" ")}
        >
          ✎
        </button>
      </div>
      {/* 担当 */}
      <button
        type="button"
        data-assignee-menu
        onClick={(e) => {
          e.stopPropagation();
          onToggleAssigneeMenu(
            (e.currentTarget as HTMLElement).getBoundingClientRect()
          );
        }}
        className={[
          "text-[10px] leading-tight px-1 rounded hover:bg-ink-100 max-w-[120px] truncate",
          isAssigneeMenuOpen ? "bg-ink-100" : "",
          assigneeName ? "text-ink-700" : "text-ink-400"
        ].join(" ")}
        title={assigneeName ? `担当: ${assigneeName} (クリックで変更)` : "担当を設定"}
      >
        {assigneeName ?? "担当 +"}
      </button>
      {/* 期日 */}
      {editingDue ? (
        <input
          type="date"
          autoFocus
          value={item.dueDate ?? ""}
          onBlur={onEndEditDue}
          onChange={(e) => {
            onChangeDueDate(e.target.value);
            onEndEditDue();
          }}
          className="text-[10px] px-1 py-0.5 rounded border border-ink-300 bg-white max-w-[110px]"
        />
      ) : (
        <button
          type="button"
          onClick={onStartEditDue}
          className={[
            "text-[10px] leading-tight px-1 rounded hover:bg-ink-100",
            overdue
              ? "text-rose-600 font-bold"
              : item.dueDate
              ? "text-ink-700"
              : "text-ink-400"
          ].join(" ")}
          title={
            item.dueDate ? `期日 ${item.dueDate} (クリックで変更)` : "期日を設定"
          }
        >
          {item.dueDate ? formatDate(item.dueDate) : "期日 +"}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
function StatusBadge({
  item,
  overdue,
  accent,
  onClick,
  onContextMenu
}: {
  item: ContractOnboardingItem;
  overdue: boolean;
  accent: string;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const base =
    "inline-flex items-center justify-center w-7 h-7 rounded-full text-[12px] font-bold transition cursor-pointer";

  let label: string;
  let symbol: string;
  let cls: string;
  let style: React.CSSProperties | undefined;
  if (item.status === "done") {
    label = "完了";
    symbol = "✓";
    cls = "text-white border";
    style = { background: accent, borderColor: accent };
  } else if (overdue) {
    label = "期日超過";
    symbol = "!";
    cls = "bg-rose-500 text-white border border-rose-500 hover:bg-rose-600";
  } else if (item.status === "doing") {
    label = "進行中";
    symbol = "◐";
    cls = "bg-white border-2 hover:bg-sky-50";
    style = { borderColor: accent, color: accent };
  } else if (item.status === "not_applicable") {
    label = "実施必要なし";
    symbol = "⊘";
    cls = "bg-ink-100 text-ink-500 border border-ink-200 hover:bg-ink-200";
  } else {
    label = "未着手";
    symbol = "○";
    cls = "bg-white text-ink-300 border border-ink-300 hover:border-ink-500 hover:text-ink-500";
  }

  return (
    <span className="group/badge relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        onContextMenu={onContextMenu}
        aria-label={label}
        className={`${base} ${cls}`}
        style={style}
      >
        {symbol}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-7 z-40 whitespace-nowrap px-2 py-0.5 rounded-md bg-white text-ink-800 text-[10px] font-medium opacity-0 group-hover/badge:opacity-100 transition border border-ink-200 shadow-liquid"
      >
        {label}
      </span>
    </span>
  );
}

// ─────────────────────────────────────────────
function StatusMenu({
  x,
  y,
  currentStatus,
  onSelect,
  onClose
}: {
  x: number;
  y: number;
  currentStatus: ContractOnboardingItem["status"];
  onSelect: (s: OnboardingItemEditableStatus) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const click = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-status-menu]")) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("click", click);
    window.addEventListener("keydown", key);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("click", click);
      window.removeEventListener("keydown", key);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  const items: { value: OnboardingItemEditableStatus; symbol: string; cls: string }[] = [
    { value: "todo", symbol: "○", cls: "text-ink-500" },
    { value: "doing", symbol: "◐", cls: "text-sky-600" },
    { value: "done", symbol: "✓", cls: "text-emerald-600" },
    { value: "not_applicable", symbol: "⊘", cls: "text-ink-500" }
  ];

  return (
    <div
      role="menu"
      data-status-menu
      className="fixed z-50 bg-white rounded-xl border border-ink-200 shadow-liquid-lg py-1 min-w-[160px]"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          onClick={() => onSelect(it.value)}
          className={[
            "w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-ink-50",
            it.value === currentStatus ? "font-semibold bg-ink-50" : ""
          ].join(" ")}
        >
          <span className={`inline-block w-4 text-center ${it.cls}`}>
            {it.symbol}
          </span>
          <span className="text-ink-800">{STATUS_LABEL[it.value]}</span>
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
function ColumnResponsibleTrigger({
  currentName,
  isOpen,
  onToggle
}: {
  currentName: string | null;
  isOpen: boolean;
  onToggle: (rect: DOMRect) => void;
}) {
  return (
    <button
      type="button"
      data-responsible-menu
      onClick={(e) => {
        e.stopPropagation();
        onToggle((e.currentTarget as HTMLElement).getBoundingClientRect());
      }}
      title="列の責任者 (一括設定)"
      className={[
        "w-full text-[10px] leading-tight px-1 py-0.5 rounded hover:bg-ink-100 truncate font-normal",
        isOpen ? "bg-ink-100" : "",
        currentName ? "text-ink-800 font-medium" : "text-ink-400"
      ].join(" ")}
    >
      {currentName ? `責任者: ${currentName}` : "責任者 +"}
    </button>
  );
}

// ─────────────────────────────────────────────
function AssigneeMenu({
  x,
  y,
  currentUserId,
  users,
  title,
  onSelect,
  onClose
}: {
  x: number;
  y: number;
  currentUserId: string | null;
  users: { id: string; name: string }[];
  title?: string;
  onSelect: (uid: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const click = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-assignee-menu]")) return;
      if (t.closest("[data-responsible-menu]")) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("click", click);
    window.addEventListener("keydown", key);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("click", click);
      window.removeEventListener("keydown", key);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  return (
    <div
      role="menu"
      data-assignee-menu
      className="fixed z-50 bg-white rounded-xl border border-ink-200 shadow-liquid-lg py-1 w-[180px]"
      style={{ left: x, top: y, transform: "translateX(-50%)" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-1 text-[10px] text-ink-500 font-medium">
        {title ?? "担当"}
      </div>
      <button
        type="button"
        onClick={() => onSelect("")}
        className={[
          "w-full text-left px-3 py-1.5 text-xs hover:bg-ink-50",
          !currentUserId ? "font-semibold bg-ink-50 text-ink-900" : "text-ink-700"
        ].join(" ")}
      >
        未設定
      </button>
      {users.map((u) => (
        <button
          key={u.id}
          type="button"
          onClick={() => onSelect(u.id)}
          className={[
            "w-full text-left px-3 py-1.5 text-xs hover:bg-ink-50",
            u.id === currentUserId
              ? "font-semibold bg-ink-50 text-ink-900"
              : "text-ink-700"
          ].join(" ")}
        >
          {u.name}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
function NoteModal({
  draft,
  itemName,
  onChange,
  onSave,
  onCancel
}: {
  draft: string;
  itemName: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/30 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-liquid-lg w-full max-w-lg p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="text-base font-semibold text-ink-900">
            {itemName} のメモ
          </div>
          <div className="text-[11px] text-ink-500 mt-0.5">
            状況メモ・引き継ぎ事項など
          </div>
        </div>
        <textarea
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          autoFocus
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ink-300"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-full text-sm text-ink-700 border border-ink-200 hover:bg-ink-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onSave}
            className="px-3 py-1.5 rounded-full text-sm bg-ink-900 text-white hover:bg-ink-800"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
function Legend({
  symbol,
  label,
  cls,
  style
}: {
  symbol: string;
  label: string;
  cls: string;
  style?: React.CSSProperties;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${cls}`}
        style={style}
      >
        {symbol}
      </span>
      {label}
    </span>
  );
}
