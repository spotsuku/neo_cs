"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  PROGRAM_TASK_CATEGORY_LABEL,
  isOverdueCell,
  type ProgramCellStatus
} from "@/lib/domain/program/program";
import type {
  ProgramCompanyTask,
  ProgramTaskTemplate
} from "@/lib/repository/types";
import {
  setProgramCellStatus,
  setProgramTemplateDueDate,
  setProgramCellAssignee,
  setProgramCellNote,
  setProgramCellDueDate,
  setProgramTemplateAssignee,
  applyTemplateAssigneeToCells
} from "./cellActions";

export function ProgramMatrix({
  termId,
  templates,
  companyIds,
  companyMap,
  users,
  initialCells,
  today
}: {
  termId: string;
  templates: ProgramTaskTemplate[];
  companyIds: string[];
  companyMap: Record<string, string>;
  users: { id: string; name: string }[];
  initialCells: ProgramCompanyTask[];
  today: string;
}) {
  const [cells, setCells] = useState<ProgramCompanyTask[]>(initialCells);
  const [templateDueDates, setTemplateDueDates] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const tp of templates) if (tp.defaultDueDate) init[tp.id] = tp.defaultDueDate;
    return init;
  });
  const [templateAssignees, setTemplateAssignees] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const tp of templates) if (tp.defaultAssigneeTo) init[tp.id] = tp.defaultAssigneeTo;
    return init;
  });
  const [, startTransition] = useTransition();
  const [noteEditor, setNoteEditor] = useState<{ cellId: string; draft: string } | null>(null);
  // セル内のインライン編集 (担当 / 期日) と、ステータス右クリックメニュー
  const [inlineEdit, setInlineEdit] = useState<
    { cellId: string; field: "due" } | null
  >(null);
  const [statusMenu, setStatusMenu] = useState<
    { cellId: string; x: number; y: number } | null
  >(null);
  // 列ヘッダの「責任者」プルダウン (fixed 位置でクリップを回避)
  const [responsibleMenu, setResponsibleMenu] = useState<
    { templateId: string; x: number; y: number } | null
  >(null);
  // セルの「担当」プルダウン
  const [assigneeMenu, setAssigneeMenu] = useState<
    { cellId: string; x: number; y: number } | null
  >(null);

  // メニュー外クリックで閉じる
  useEffect(() => {
    if (!statusMenu) return;
    const handler = () => setStatusMenu(null);
    window.addEventListener("click", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [statusMenu]);

  const userMap = useMemo(
    () => new Map(users.map((u) => [u.id, u.name])),
    [users]
  );

  const cellMap = useMemo(() => {
    const m = new Map<string, ProgramCompanyTask>();
    for (const c of cells) m.set(`${c.companyId}::${c.templateId}`, c);
    return m;
  }, [cells]);

  const completionByTemplate = useMemo(() => {
    const m = new Map<string, { done: number; total: number }>();
    for (const tp of templates) m.set(tp.id, { done: 0, total: 0 });
    for (const c of cells) {
      const s = m.get(c.templateId);
      if (!s) continue;
      // 「実施必要なし」は分母から除外
      if (c.status === "not_applicable") continue;
      s.total++;
      if (c.status === "done") s.done++;
    }
    return m;
  }, [cells, templates]);

  function changeCellDueDate(cell: ProgramCompanyTask, value: string) {
    const next = value || null;
    setCells((prev) =>
      prev.map((c) =>
        c.id === cell.id ? { ...c, dueDate: next ?? undefined } : c
      )
    );
    startTransition(async () => {
      try {
        await setProgramCellDueDate(cell.id, termId, next);
      } catch (e) {
        console.error(e);
        setCells((prev) =>
          prev.map((c) => (c.id === cell.id ? { ...c, dueDate: cell.dueDate } : c))
        );
      }
    });
  }

  function changeCellAssignee(cell: ProgramCompanyTask, userId: string) {
    const next = userId || null;
    setCells((prev) =>
      prev.map((c) => (c.id === cell.id ? { ...c, assignedTo: next ?? undefined } : c))
    );
    startTransition(async () => {
      try {
        await setProgramCellAssignee(cell.id, termId, next);
      } catch (e) {
        console.error(e);
        setCells((prev) =>
          prev.map((c) => (c.id === cell.id ? { ...c, assignedTo: cell.assignedTo } : c))
        );
      }
    });
  }

  function openNoteEditor(cell: ProgramCompanyTask) {
    setNoteEditor({ cellId: cell.id, draft: cell.note ?? "" });
  }

  function saveNote() {
    if (!noteEditor) return;
    const { cellId, draft } = noteEditor;
    const value = draft.trim() === "" ? null : draft;
    const original = cells.find((c) => c.id === cellId);
    setCells((prev) =>
      prev.map((c) => (c.id === cellId ? { ...c, note: value ?? undefined } : c))
    );
    setNoteEditor(null);
    startTransition(async () => {
      try {
        await setProgramCellNote(cellId, termId, value);
      } catch (e) {
        console.error(e);
        setCells((prev) =>
          prev.map((c) => (c.id === cellId ? { ...c, note: original?.note } : c))
        );
      }
    });
  }

  // 列の責任者を変更 (セルへは反映しない)
  function changeTemplateResponsible(templateId: string, userId: string) {
    const next = userId || null;
    setTemplateAssignees((prev) => ({ ...prev, [templateId]: userId }));
    startTransition(async () => {
      try {
        await setProgramTemplateAssignee(templateId, termId, next);
      } catch (e) {
        console.error(e);
      }
    });
  }

  // 列の責任者を全 open セルに反映
  function applyResponsibleToAll(templateId: string) {
    const userId = templateAssignees[templateId] || null;
    setCells((prev) =>
      prev.map((c) =>
        c.templateId === templateId && (c.status === "pending" || c.status === "in_progress")
          ? { ...c, assignedTo: userId ?? undefined }
          : c
      )
    );
    startTransition(async () => {
      try {
        await applyTemplateAssigneeToCells(templateId, termId, userId);
      } catch (e) {
        console.error(e);
      }
    });
  }

  function changeTemplateDueDate(templateId: string, value: string) {
    const dueDate = value || null;
    setTemplateDueDates((prev) => ({ ...prev, [templateId]: value }));
    // 楽観的に open セルへも反映
    setCells((prev) =>
      prev.map((c) =>
        c.templateId === templateId && (c.status === "pending" || c.status === "in_progress")
          ? { ...c, dueDate: dueDate ?? undefined }
          : c
      )
    );
    startTransition(async () => {
      try {
        await setProgramTemplateDueDate(templateId, termId, dueDate);
      } catch (e) {
        console.error(e);
      }
    });
  }

  function changeStatus(cell: ProgramCompanyTask, next: ProgramCellStatus) {
    setCells((prev) =>
      prev.map((c) => (c.id === cell.id ? { ...c, status: next } : c))
    );
    startTransition(async () => {
      try {
        await setProgramCellStatus(cell.id, termId, next);
      } catch (e) {
        // ロールバック
        setCells((prev) =>
          prev.map((c) => (c.id === cell.id ? { ...c, status: cell.status } : c))
        );
        console.error(e);
      }
    });
  }

  // クリック = pending → in_progress → done → not_applicable → pending
  // 右クリック = 逆方向
  const STATUS_CYCLE: ProgramCellStatus[] = [
    "pending",
    "in_progress",
    "done",
    "not_applicable"
  ];
  function cycleStatus(cell: ProgramCompanyTask) {
    const i = STATUS_CYCLE.indexOf(cell.status);
    // 想定外のステータス (skipped/cancelled) からは pending に戻す
    const next = i < 0 ? "pending" : STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length];
    changeStatus(cell, next);
  }

  if (templates.length === 0) {
    return (
      <div className="liquid-surface p-10 text-center text-sm text-ink-500">
        タスクテンプレートがまだ登録されていません
      </div>
    );
  }
  if (companyIds.length === 0) {
    return (
      <div className="liquid-surface p-10 text-center text-sm text-ink-500">
        対象企業が0社です。スコープに合致する契約中企業がありません
      </div>
    );
  }

  return (
    <div className="liquid-surface overflow-auto max-h-[calc(100vh-160px)]">
      <table className="text-sm border-separate border-spacing-0 table-fixed">
        <thead className="sticky top-0 z-20 bg-white">
          <tr>
            <th className="text-left px-4 py-2 text-[11px] font-medium text-ink-500 border-b border-ink-100 sticky top-0 left-0 bg-white z-30 w-[240px]">
              企業
            </th>
            {templates.map((tp) => {
              const c = completionByTemplate.get(tp.id) ?? { done: 0, total: 0 };
              const pct = c.total === 0 ? 0 : Math.round((c.done / c.total) * 100);
              return (
                <th
                  key={tp.id}
                  className="px-2 py-2 border-b border-ink-100 text-center w-[130px] min-w-[130px] align-top"
                >
                  <div className="text-xs font-semibold text-ink-900">
                    {tp.orderNo}. {tp.label}
                  </div>
                  {tp.category && (
                    <div className="text-[10px] text-ink-500 mt-0.5">
                      {PROGRAM_TASK_CATEGORY_LABEL[tp.category]}
                    </div>
                  )}
                  <div className="mt-1.5">
                    <input
                      type="date"
                      value={templateDueDates[tp.id] ?? ""}
                      onChange={(e) => changeTemplateDueDate(tp.id, e.target.value)}
                      className="w-full text-[11px] px-1.5 py-1 rounded-md border border-ink-200 bg-white text-ink-700 font-normal"
                      title="この列の期日を一括設定 (open セルに反映)"
                    />
                  </div>
                  <div className="mt-1.5">
                    <ColumnResponsibleTrigger
                      currentName={
                        templateAssignees[tp.id]
                          ? userMap.get(templateAssignees[tp.id]) ?? null
                          : null
                      }
                      isOpen={responsibleMenu?.templateId === tp.id}
                      onToggle={(rect) => {
                        if (responsibleMenu?.templateId === tp.id) {
                          setResponsibleMenu(null);
                        } else {
                          setResponsibleMenu({
                            templateId: tp.id,
                            x: rect.left + rect.width / 2,
                            y: rect.bottom + 4
                          });
                        }
                      }}
                    />
                  </div>
                  <div className="mt-1 text-[11px] text-ink-700 font-medium">
                    完了 {c.done}/{c.total}
                    <span className="ml-1 text-ink-500 font-normal">({pct}%)</span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {companyIds.map((companyId) => {
            const name = companyMap[companyId] ?? companyId;
            return (
              <tr key={companyId} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/40 group">
                <td className="sticky left-0 bg-white/95 backdrop-blur-sm z-10 px-4 py-2 font-medium">
                  <Link
                    href={`/companies/${companyId}`}
                    className="block group-hover:underline"
                  >
                    <div className="text-ink-900 text-sm">{name}</div>
                  </Link>
                </td>
                {templates.map((tp) => {
                  const cell = cellMap.get(`${companyId}::${tp.id}`);
                  if (!cell) {
                    return (
                      <td
                        key={tp.id}
                        className="px-2 py-2 border-b border-ink-50 text-center text-ink-300"
                      >
                        —
                      </td>
                    );
                  }
                  const overdue = isOverdueCell(cell, today);
                  return (
                    <td
                      key={tp.id}
                      className="px-1.5 py-1.5 border-b border-ink-50 text-center relative align-top"
                    >
                      <CompactCell
                        cell={cell}
                        template={templates.find((t) => t.id === tp.id)!}
                        overdue={overdue}
                        userMap={userMap}
                        editingField={
                          inlineEdit?.cellId === cell.id ? inlineEdit.field : null
                        }
                        isAssigneeMenuOpen={assigneeMenu?.cellId === cell.id}
                        onCycleStatus={() => cycleStatus(cell)}
                        onOpenStatusMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setStatusMenu({
                            cellId: cell.id,
                            x: e.clientX,
                            y: e.clientY
                          });
                        }}
                        onOpenNote={() => openNoteEditor(cell)}
                        onToggleAssigneeMenu={(rect) => {
                          if (assigneeMenu?.cellId === cell.id) {
                            setAssigneeMenu(null);
                          } else {
                            setAssigneeMenu({
                              cellId: cell.id,
                              x: rect.left + rect.width / 2,
                              y: rect.bottom + 4
                            });
                          }
                        }}
                        onStartEdit={(field) =>
                          setInlineEdit({ cellId: cell.id, field })
                        }
                        onEndEdit={() => setInlineEdit(null)}
                        onChangeDueDate={(d) => changeCellDueDate(cell, d)}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>


      {responsibleMenu && (() => {
        const tplId = responsibleMenu.templateId;
        const currentUserId = templateAssignees[tplId] ?? null;
        return (
          <ResponsibleMenu
            x={responsibleMenu.x}
            y={responsibleMenu.y}
            currentUserId={currentUserId}
            users={users}
            onSelect={(uid) => {
              changeTemplateResponsible(tplId, uid);
              setResponsibleMenu(null);
            }}
            onApplyAll={() => {
              applyResponsibleToAll(tplId);
              setResponsibleMenu(null);
            }}
            onClose={() => setResponsibleMenu(null)}
          />
        );
      })()}

      {assigneeMenu && (() => {
        const cell = cells.find((c) => c.id === assigneeMenu.cellId);
        if (!cell) return null;
        return (
          <AssigneeMenu
            x={assigneeMenu.x}
            y={assigneeMenu.y}
            currentUserId={cell.assignedTo ?? null}
            users={users}
            onSelect={(uid) => {
              changeCellAssignee(cell, uid);
              setAssigneeMenu(null);
            }}
            onClose={() => setAssigneeMenu(null)}
          />
        );
      })()}

      {statusMenu && (() => {
        const cell = cells.find((c) => c.id === statusMenu.cellId);
        if (!cell) return null;
        return (
          <StatusMenu
            x={statusMenu.x}
            y={statusMenu.y}
            currentStatus={cell.status}
            onSelect={(s) => {
              changeStatus(cell, s);
              setStatusMenu(null);
            }}
            onClose={() => setStatusMenu(null)}
          />
        );
      })()}

      {noteEditor && (
        <NoteModal
          draft={noteEditor.draft}
          companyName={
            companyMap[
              cells.find((c) => c.id === noteEditor.cellId)?.companyId ?? ""
            ] ?? ""
          }
          templateLabel={
            templates.find(
              (t) =>
                t.id === cells.find((c) => c.id === noteEditor.cellId)?.templateId
            )?.label ?? ""
          }
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

// セルの担当プルダウン (fixed 配置)
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
      className="fixed z-50 bg-white rounded-xl border border-ink-200 shadow-liquid-lg py-1 w-[160px]"
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
            u.id === currentUserId ? "font-semibold bg-ink-50 text-ink-900" : "text-ink-700"
          ].join(" ")}
        >
          {u.name}
        </button>
      ))}
    </div>
  );
}

// 列ヘッダの責任者トリガー: テキスト + クリックで親に座標を返して dropdown を開閉
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
      title="列の責任者"
      className={[
        "w-full text-[11px] leading-tight px-1.5 py-1 rounded hover:bg-ink-100 truncate",
        isOpen ? "bg-ink-100" : "",
        currentName ? "text-ink-800 font-medium" : "text-ink-400"
      ].join(" ")}
    >
      {currentName ? `責任者: ${currentName}` : "責任者 +"}
    </button>
  );
}

// 列ヘッダの責任者プルダウン (fixed 配置でクリップ回避)
function ResponsibleMenu({
  x,
  y,
  currentUserId,
  users,
  onSelect,
  onApplyAll,
  onClose
}: {
  x: number;
  y: number;
  currentUserId: string | null;
  users: { id: string; name: string }[];
  onSelect: (uid: string) => void;
  onApplyAll: () => void;
  onClose: () => void;
}) {
  // 外側クリック・スクロール・ESC で閉じる
  useEffect(() => {
    const handler = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      onClose();
    };
    const click = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-responsible-menu]")) return;
      onClose();
    };
    window.addEventListener("click", click);
    window.addEventListener("keydown", handler as EventListener);
    window.addEventListener("scroll", () => onClose(), true);
    return () => {
      window.removeEventListener("click", click);
      window.removeEventListener("keydown", handler as EventListener);
    };
  }, [onClose]);

  return (
    <div
      role="menu"
      data-responsible-menu
      className="fixed z-50 bg-white rounded-xl border border-ink-200 shadow-liquid-lg py-1 w-[200px]"
      style={{ left: x, top: y, transform: "translateX(-50%)" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-1 text-[10px] text-ink-500 font-medium">
        列の責任者
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
            u.id === currentUserId ? "font-semibold bg-ink-50 text-ink-900" : "text-ink-700"
          ].join(" ")}
        >
          {u.name}
        </button>
      ))}
      <div className="border-t border-ink-100 my-1" />
      <button
        type="button"
        onClick={onApplyAll}
        disabled={!currentUserId}
        className="w-full text-left px-3 py-2 text-xs text-sky-700 hover:bg-sky-50 disabled:text-ink-300 disabled:cursor-not-allowed"
      >
        ↻ 全タスクをこの責任者に揃える
      </button>
    </div>
  );
}

// セル本体: ステータスバッジを主役に、担当・期日・メモは小さく
function CompactCell({
  cell,
  template,
  overdue,
  userMap,
  editingField,
  isAssigneeMenuOpen,
  onCycleStatus,
  onOpenStatusMenu,
  onOpenNote,
  onToggleAssigneeMenu,
  onStartEdit,
  onEndEdit,
  onChangeDueDate
}: {
  cell: ProgramCompanyTask;
  template: ProgramTaskTemplate;
  overdue: boolean;
  userMap: Map<string, string>;
  editingField: "due" | null;
  isAssigneeMenuOpen: boolean;
  onCycleStatus: () => void;
  onOpenStatusMenu: (e: React.MouseEvent) => void;
  onOpenNote: () => void;
  onToggleAssigneeMenu: (rect: DOMRect) => void;
  onStartEdit: (field: "due") => void;
  onEndEdit: () => void;
  onChangeDueDate: (d: string) => void;
}) {
  const tplDefault = template.defaultDueDate;
  const isOverridden = cell.dueDate != null && cell.dueDate !== tplDefault;
  const assigneeName = cell.assignedTo ? userMap.get(cell.assignedTo) : null;

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* メイン: ステータスバッジ + 小さなメモアイコン */}
      <div className="relative inline-flex items-center">
        <StatusBadge
          cell={cell}
          overdue={overdue}
          onClick={onCycleStatus}
          onContextMenu={onOpenStatusMenu}
        />
        <button
          type="button"
          onClick={onOpenNote}
          title={cell.note ? `メモ: ${cell.note}` : "メモを残す"}
          className={[
            "absolute -right-3.5 -top-1 inline-flex items-center justify-center text-[11px] leading-none transition",
            cell.note
              ? "text-amber-500 font-bold"
              : "text-ink-300 hover:text-ink-600"
          ].join(" ")}
        >
          ✎
        </button>
      </div>

      {/* 担当: クリックでプルダウン開閉 (fixed-position menu) */}
      <button
        type="button"
        data-assignee-menu
        onClick={(e) => {
          e.stopPropagation();
          onToggleAssigneeMenu((e.currentTarget as HTMLElement).getBoundingClientRect());
        }}
        className={[
          "text-[10px] leading-tight px-1 rounded hover:bg-ink-100",
          isAssigneeMenuOpen ? "bg-ink-100" : "",
          assigneeName ? "text-ink-700" : "text-ink-400"
        ].join(" ")}
        title={assigneeName ? `担当: ${assigneeName} (クリックで変更)` : "担当を設定"}
      >
        {assigneeName ?? "担当 +"}
      </button>

      {/* 期日: クリックで date input */}
      {editingField === "due" ? (
        <input
          type="date"
          autoFocus
          value={cell.dueDate ?? ""}
          onBlur={onEndEdit}
          onChange={(e) => {
            onChangeDueDate(e.target.value);
          }}
          className="text-[10px] px-1 py-0.5 rounded border border-ink-300 bg-white max-w-[110px]"
        />
      ) : (
        <button
          type="button"
          onClick={() => onStartEdit("due")}
          className={[
            "text-[10px] leading-tight px-1.5 rounded hover:bg-ink-100",
            overdue
              ? "text-rose-600 font-bold"
              : isOverridden
              ? "text-orange-600 font-bold bg-orange-50"
              : cell.dueDate
              ? "text-ink-700"
              : "text-ink-400"
          ].join(" ")}
          title={
            isOverridden
              ? `個別期日 (列既定: ${tplDefault ?? "未設定"})`
              : tplDefault
              ? `列既定: ${tplDefault}`
              : "期日を設定"
          }
        >
          {cell.dueDate ? formatDate(cell.dueDate) : "期日 +"}
        </button>
      )}
    </div>
  );
}

function formatDate(d: string): string {
  // 2026-05-15 → 5/15 (年は当年なら省略)
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return d;
  return `${Number(m[2])}/${Number(m[3])}`;
}

// ステータス右クリック時のフルメニュー (全6状態)
function StatusMenu({
  x,
  y,
  currentStatus,
  onSelect,
  onClose
}: {
  x: number;
  y: number;
  currentStatus: ProgramCellStatus;
  onSelect: (s: ProgramCellStatus) => void;
  onClose: () => void;
}) {
  const items: { value: ProgramCellStatus; label: string; symbol: string; cls: string }[] = [
    { value: "pending", label: "未着手", symbol: "○", cls: "text-ink-500" },
    { value: "in_progress", label: "進行中", symbol: "◐", cls: "text-sky-600" },
    { value: "done", label: "完了", symbol: "✓", cls: "text-emerald-600" },
    { value: "not_applicable", label: "実施必要なし", symbol: "⊘", cls: "text-ink-500" },
    { value: "skipped", label: "スキップ", symbol: "—", cls: "text-ink-500" }
  ];
  return (
    <div
      role="menu"
      className="fixed z-50 bg-white rounded-xl border border-ink-200 shadow-liquid-lg py-1 min-w-[160px]"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
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
          <span className={`inline-block w-4 text-center ${it.cls}`}>{it.symbol}</span>
          <span className="text-ink-800">{it.label}</span>
        </button>
      ))}
    </div>
  );
}

export function ProgramMatrixLegend() {
  return (
    <div className="flex items-center gap-3 text-[11px] text-ink-500 flex-wrap">
      <span className="font-medium text-ink-600">凡例:</span>
      <LegendItem className="bg-emerald-500 text-white border-emerald-500" symbol="✓" label="完了" />
      <LegendItem className="bg-white text-sky-600 border-2 border-sky-500" symbol="◐" label="進行中" />
      <LegendItem className="bg-white text-ink-300 border-ink-300" symbol="○" label="未着手" />
      <LegendItem className="bg-rose-500 text-white border-rose-500" symbol="!" label="期日超過" />
      <LegendItem className="bg-ink-100 text-ink-500 border-ink-200" symbol="⊘" label="実施必要なし" />
      <span className="flex items-center gap-1.5">
        <span className="inline-block px-1.5 rounded text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200">
          5/15
        </span>
        列既定と異なる個別期日
      </span>
      <span className="text-ink-400">
        クリックで状態を進める / 右クリックで全ステータスから選択
      </span>
    </div>
  );
}

function LegendItem({
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

// オンボのマトリクスと同じ円形バッジ。
// クリックで pending → in_progress → done → not_applicable → pending を循環。
// 右クリックで全ステータスから選択。ホバーでステータス名をツールチップ表示。
function StatusBadge({
  cell,
  overdue,
  onClick,
  onContextMenu
}: {
  cell: ProgramCompanyTask;
  overdue: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const base =
    "inline-flex items-center justify-center w-7 h-7 rounded-full text-[13px] font-bold transition cursor-pointer";

  let label: string;
  let symbol: string;
  let cls: string;
  if (cell.status === "done") {
    label = "完了";
    symbol = "✓";
    cls = "bg-emerald-500 text-white border border-emerald-500 hover:bg-emerald-600";
  } else if (overdue) {
    label = "期日超過";
    symbol = "!";
    cls = "bg-rose-500 text-white border border-rose-500 hover:bg-rose-600";
  } else if (cell.status === "in_progress") {
    label = "進行中";
    symbol = "◐";
    cls = "bg-white text-sky-600 border-2 border-sky-500 hover:bg-sky-50";
  } else if (cell.status === "not_applicable") {
    label = "実施必要なし";
    symbol = "⊘";
    cls = "bg-ink-100 text-ink-500 border border-ink-200 hover:bg-ink-200";
  } else if (cell.status === "skipped") {
    label = "スキップ";
    symbol = "—";
    cls = "bg-ink-100 text-ink-500 border border-ink-200";
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
      >
        {symbol}
      </button>
      {/* ホバー時に表示するステータス名 (custom tooltip)
         - 行 (tr) にも group があるため `group/badge` で名前付き group にして衝突回避 */}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-7 z-40 whitespace-nowrap px-2 py-0.5 rounded-md bg-white text-ink-800 text-[10px] font-medium opacity-0 group-hover/badge:opacity-100 transition border border-ink-200 shadow-liquid"
      >
        {label}
      </span>
    </span>
  );
}

function NoteModal({
  draft,
  companyName,
  templateLabel,
  onChange,
  onSave,
  onCancel
}: {
  draft: string;
  companyName: string;
  templateLabel: string;
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
          <div className="text-[11px] text-ink-500">{companyName}</div>
          <div className="text-base font-semibold text-ink-900">
            {templateLabel} のメモ
          </div>
        </div>
        <textarea
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          autoFocus
          placeholder="先方とのやり取り、注意点、状況メモなど…"
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-hidden focus:ring-1 focus:ring-ink-300"
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
