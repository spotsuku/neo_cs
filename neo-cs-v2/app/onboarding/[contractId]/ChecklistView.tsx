"use client";

// オンボ項目チェックリスト (事業内ToDo マトリクスと同じ操作感)
//
// 各項目に:
//   - ステータスバッジ (クリックで循環 / 右クリックで全状態メニュー)
//   - 担当者 (テキスト → クリックで fixed-position プルダウン)
//   - 期日 (テキスト → クリックで date input)
//   - メモボタン (✎ / 入力済はアンバー色のモーダルで編集)

import { useEffect, useMemo, useState, useTransition } from "react";
import type {
  ContractOnboardingItem,
  OnboardingItemEditableStatus
} from "@/lib/repository/types";
import type { OnboardingCategory } from "@/lib/mock/onboarding";
import {
  setOnboardingItemStatus,
  setOnboardingItemAssignee,
  setOnboardingItemDueDate,
  setOnboardingItemNote
} from "./itemActions";

type ItemStatus = ContractOnboardingItem["status"];

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

export function ChecklistView({
  contractId,
  template,
  items: initialItems,
  accent,
  users,
  today
}: {
  contractId: string;
  template: OnboardingCategory[];
  items: ContractOnboardingItem[];
  accent: string;
  users: { id: string; name: string }[];
  today: string;
}) {
  const [items, setItems] = useState<ContractOnboardingItem[]>(initialItems);
  const [, startTransition] = useTransition();
  const [openCats, setOpenCats] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(template.map((c) => [c.key, true]))
  );
  const [statusMenu, setStatusMenu] = useState<
    { itemId: string; x: number; y: number } | null
  >(null);
  const [assigneeMenu, setAssigneeMenu] = useState<
    { itemId: string; x: number; y: number } | null
  >(null);
  const [editingDue, setEditingDue] = useState<string | null>(null);
  const [noteEditor, setNoteEditor] = useState<
    { itemId: string; draft: string } | null
  >(null);

  const userMap = useMemo(
    () => new Map(users.map((u) => [u.id, u.name])),
    [users]
  );

  function patchLocal(id: string, patch: Partial<ContractOnboardingItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function changeStatus(item: ContractOnboardingItem, next: OnboardingItemEditableStatus) {
    const original = item.status;
    patchLocal(item.id, { status: next });
    startTransition(async () => {
      try {
        await setOnboardingItemStatus(item.id, contractId, next);
      } catch (e) {
        console.error(e);
        patchLocal(item.id, { status: original });
      }
    });
  }

  function cycleStatus(item: ContractOnboardingItem) {
    const cur = isEditableStatus(item.status) ? item.status : "todo";
    const i = STATUS_CYCLE.indexOf(cur);
    const next = STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length];
    changeStatus(item, next);
  }

  function changeAssignee(item: ContractOnboardingItem, userId: string) {
    const next = userId || null;
    const original = item.assignee;
    patchLocal(item.id, { assignee: next ?? "" });
    startTransition(async () => {
      try {
        await setOnboardingItemAssignee(item.id, contractId, next);
      } catch (e) {
        console.error(e);
        patchLocal(item.id, { assignee: original });
      }
    });
  }

  function changeDueDate(item: ContractOnboardingItem, value: string) {
    const original = item.dueDate;
    patchLocal(item.id, { dueDate: value });
    setEditingDue(null);
    startTransition(async () => {
      try {
        await setOnboardingItemDueDate(item.id, contractId, value || null);
      } catch (e) {
        console.error(e);
        patchLocal(item.id, { dueDate: original });
      }
    });
  }

  function saveNote() {
    if (!noteEditor) return;
    const { itemId, draft } = noteEditor;
    const value = draft.trim() === "" ? null : draft;
    const original = items.find((i) => i.id === itemId)?.note;
    patchLocal(itemId, { note: value ?? undefined });
    setNoteEditor(null);
    startTransition(async () => {
      try {
        await setOnboardingItemNote(itemId, contractId, value);
      } catch (e) {
        console.error(e);
        patchLocal(itemId, { note: original });
      }
    });
  }

  return (
    <div className="space-y-4">
      {template
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((cat) => {
          const catItems = items.filter((i) => i.categoryKey === cat.key);
          const total = catItems.filter((i) => i.status !== "not_applicable").length;
          const done = catItems.filter((i) => i.status === "done").length;
          const isOpen = openCats[cat.key] ?? true;
          return (
            <section key={cat.key} className="liquid-surface overflow-hidden">
              <button
                type="button"
                onClick={() =>
                  setOpenCats((prev) => ({ ...prev, [cat.key]: !isOpen }))
                }
                className="w-full p-4 flex items-center gap-4 hover:bg-ink-50/50 text-left"
              >
                <div className="text-sm font-semibold text-ink-900 flex items-center gap-2">
                  <span className="text-ink-500 text-xs">
                    {isOpen ? "▼" : "▶"}
                  </span>
                  {cat.label}
                </div>
                <span className="text-xs text-ink-500">
                  {done}/{total}
                </span>
                <div className="flex-1 max-w-xs ml-4">
                  <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${total > 0 ? (done / total) * 100 : 0}%`,
                        background: accent
                      }}
                    />
                  </div>
                </div>
              </button>

              {isOpen && (
                <ul className="border-t border-ink-100 divide-y divide-ink-50">
                  {catItems.map((it) => {
                    const overdue = isOverdue(it, today);
                    const assigneeName =
                      (it.assignee && (userMap.get(it.assignee) ?? it.assignee)) || null;
                    return (
                      <li
                        key={it.id}
                        className="px-4 py-3 flex items-start gap-3 hover:bg-ink-50/30"
                      >
                        {/* ステータスバッジ */}
                        <ItemStatusBadge
                          status={it.status}
                          overdue={overdue}
                          accent={accent}
                          onClick={() => cycleStatus(it)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setStatusMenu({
                              itemId: it.id,
                              x: e.clientX,
                              y: e.clientY
                            });
                          }}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={[
                                "text-sm",
                                it.status === "done"
                                  ? "text-ink-500 line-through"
                                  : it.status === "not_applicable"
                                  ? "text-ink-400 line-through"
                                  : "text-ink-900 font-medium"
                              ].join(" ")}
                            >
                              {it.name}
                            </span>
                            {it.required ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100">
                                必須
                              </span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-ink-50 text-ink-500 border border-ink-100">
                                任意
                              </span>
                            )}
                            {/* メモアイコン (枠線なし、入力済はアンバー色) */}
                            <button
                              type="button"
                              onClick={() =>
                                setNoteEditor({
                                  itemId: it.id,
                                  draft: it.note ?? ""
                                })
                              }
                              title={it.note ? `メモ: ${it.note}` : "メモを残す"}
                              className={[
                                "text-[12px] leading-none transition px-0.5",
                                it.note
                                  ? "text-amber-500 font-bold"
                                  : "text-ink-300 hover:text-ink-600"
                              ].join(" ")}
                            >
                              ✎
                            </button>
                          </div>

                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                            {/* 期日 */}
                            {editingDue === it.id ? (
                              <input
                                type="date"
                                autoFocus
                                value={it.dueDate ?? ""}
                                onBlur={() => setEditingDue(null)}
                                onChange={(e) => changeDueDate(it, e.target.value)}
                                className="text-[11px] px-1.5 py-0.5 rounded border border-ink-300 bg-white"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditingDue(it.id)}
                                className={[
                                  "px-1.5 rounded hover:bg-ink-100",
                                  overdue
                                    ? "text-rose-600 font-bold"
                                    : it.dueDate
                                    ? "text-ink-700"
                                    : "text-ink-400"
                                ].join(" ")}
                                title={
                                  it.dueDate
                                    ? `期日 ${it.dueDate} (クリックで変更)`
                                    : "期日を設定"
                                }
                              >
                                {it.dueDate
                                  ? `期日 ${it.dueDate.slice(5).replace("-", "/")}`
                                  : "期日 +"}
                              </button>
                            )}
                            {/* 担当 */}
                            <button
                              type="button"
                              data-assignee-menu
                              onClick={(e) => {
                                e.stopPropagation();
                                if (assigneeMenu?.itemId === it.id) {
                                  setAssigneeMenu(null);
                                } else {
                                  const r = (
                                    e.currentTarget as HTMLElement
                                  ).getBoundingClientRect();
                                  setAssigneeMenu({
                                    itemId: it.id,
                                    x: r.left + r.width / 2,
                                    y: r.bottom + 4
                                  });
                                }
                              }}
                              className={[
                                "px-1.5 rounded hover:bg-ink-100",
                                assigneeMenu?.itemId === it.id ? "bg-ink-100" : "",
                                assigneeName ? "text-ink-700" : "text-ink-400"
                              ].join(" ")}
                              title="担当者"
                            >
                              {assigneeName ? `担当 ${assigneeName}` : "担当 +"}
                            </button>
                            {it.status === "done" && it.completedAt && (
                              <span className="text-emerald-600">
                                完了日{" "}
                                {it.completedAt.slice(5).replace("-", "/")}
                              </span>
                            )}
                            {overdue && (
                              <span className="text-rose-600 font-medium">
                                期日超過
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                  {catItems.length === 0 && (
                    <li className="px-4 py-6 text-xs text-center text-ink-500">
                      項目なし
                    </li>
                  )}
                </ul>
              )}
            </section>
          );
        })}

      {/* ステータスメニュー */}
      {statusMenu &&
        (() => {
          const it = items.find((x) => x.id === statusMenu.itemId);
          if (!it) return null;
          return (
            <StatusMenu
              x={statusMenu.x}
              y={statusMenu.y}
              currentStatus={it.status}
              onSelect={(s) => {
                changeStatus(it, s);
                setStatusMenu(null);
              }}
              onClose={() => setStatusMenu(null)}
            />
          );
        })()}

      {/* 担当者メニュー */}
      {assigneeMenu &&
        (() => {
          const it = items.find((x) => x.id === assigneeMenu.itemId);
          if (!it) return null;
          return (
            <AssigneeMenu
              x={assigneeMenu.x}
              y={assigneeMenu.y}
              currentUserId={userIdForAssignee(it.assignee, userMap)}
              users={users}
              onSelect={(uid) => {
                changeAssignee(it, uid);
                setAssigneeMenu(null);
              }}
              onClose={() => setAssigneeMenu(null)}
            />
          );
        })()}

      {/* メモモーダル */}
      {noteEditor && (
        <NoteModal
          draft={noteEditor.draft}
          itemName={items.find((i) => i.id === noteEditor.itemId)?.name ?? ""}
          onChange={(v) =>
            setNoteEditor((prev) => (prev ? { ...prev, draft: v } : prev))
          }
          onSave={saveNote}
          onCancel={() => setNoteEditor(null)}
        />
      )}

      {/* 凡例 */}
      <div className="flex items-center gap-3 px-4 py-2 text-[11px] text-ink-500 flex-wrap">
        <span className="font-medium text-ink-600">凡例:</span>
        <Legend className="bg-emerald-500 text-white border-emerald-500" symbol="✓" label="完了" />
        <Legend className="bg-white text-sky-600 border-2 border-sky-500" symbol="◐" label="進行中" />
        <Legend className="bg-white text-ink-300 border-ink-300" symbol="○" label="未着手" />
        <Legend className="bg-rose-500 text-white border-rose-500" symbol="!" label="期日超過" />
        <Legend className="bg-ink-100 text-ink-500 border-ink-200" symbol="⊘" label="実施必要なし" />
        <span className="ml-auto text-[11px] text-ink-400">
          クリックで状態を進める / 右クリックで全ステータスから選択
        </span>
      </div>
    </div>
  );
}

function isEditableStatus(s: ItemStatus): s is OnboardingItemEditableStatus {
  return s === "todo" || s === "doing" || s === "done" || s === "not_applicable";
}

function isOverdue(item: ContractOnboardingItem, today: string): boolean {
  if (item.status === "done" || item.status === "not_applicable") return false;
  if (!item.dueDate) return false;
  return item.dueDate < today;
}

// item.assignee は user id を保存する想定。既存 seed は名前文字列を持つので両対応
function userIdForAssignee(
  assignee: string,
  userMap: Map<string, string>
): string | null {
  if (!assignee) return null;
  if (userMap.has(assignee)) return assignee;
  for (const [uid, name] of userMap) {
    if (name === assignee) return uid;
  }
  return null;
}

// ─────────────────────────────────────────────
// Sub components
// ─────────────────────────────────────────────

function ItemStatusBadge({
  status,
  overdue,
  accent,
  onClick,
  onContextMenu
}: {
  status: ItemStatus;
  overdue: boolean;
  accent: string;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const base =
    "mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full text-[12px] font-bold transition cursor-pointer shrink-0";

  let label: string;
  let symbol: string;
  let style: React.CSSProperties | undefined;
  let cls: string;
  if (status === "done") {
    label = "完了";
    symbol = "✓";
    cls = "text-white border";
    style = { background: accent, borderColor: accent };
  } else if (overdue) {
    label = "期日超過";
    symbol = "!";
    cls = "bg-rose-500 text-white border border-rose-500 hover:bg-rose-600";
  } else if (status === "doing") {
    label = "進行中";
    symbol = "◐";
    cls = "bg-white border-2 hover:bg-sky-50";
    style = { borderColor: accent, color: accent };
  } else if (status === "not_applicable") {
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

function StatusMenu({
  x,
  y,
  currentStatus,
  onSelect,
  onClose
}: {
  x: number;
  y: number;
  currentStatus: ItemStatus;
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

function AssigneeMenu({
  x,
  y,
  currentUserId,
  users,
  onSelect,
  onClose
}: {
  x: number;
  y: number;
  currentUserId: string | null;
  users: { id: string; name: string }[];
  onSelect: (uid: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const click = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-assignee-menu]")) return;
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
      <div className="px-3 py-1 text-[10px] text-ink-500 font-medium">担当</div>
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
            先方のリアクション、注意点、状況メモなど
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

function Legend({
  className,
  symbol,
  label
}: {
  className: string;
  symbol: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold border ${className}`}
      >
        {symbol}
      </span>
      {label}
    </span>
  );
}
