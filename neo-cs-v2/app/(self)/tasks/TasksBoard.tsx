"use client";

// /tasks 一覧ボード — Notion風データベースビュー
// - ビュー切替: テーブル / ボード(Kanban) / リスト
// - フィルタ: status / priority / due / assignee / scope (mine/team)
// - テーブル: 各列ソート + セルのインライン編集 (status/priority/assignee/dueDate/category)
// - ボード: status 列を Kanban で表示 (簡易)
// - リスト: 期日順 + overdue 強調 (旧UI)

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  TASK_CATEGORY_LABEL,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  endOfWeek,
  isOverdue,
  isDueByToday,
  isDueByWeekEnd,
  sortByDueAsc
} from "@/lib/domain/task";
import type {
  CompanyTask,
  CompanyTaskCategory,
  CompanyTaskPriority,
  CompanyTaskStatus
} from "@/lib/repository/types";
import {
  setCompanyTaskStatus,
  updateCompanyTaskFields
} from "@/app/(relationship)/companies/[id]/taskActions";

const TODAY = new Date().toISOString().slice(0, 10);
const WEEK_END = endOfWeek(TODAY);

type StatusFilter = CompanyTaskStatus | "all" | "open";
type DueFilter = "all" | "overdue" | "today" | "week";
type ViewMode = "table" | "board" | "list";

const PRIORITY_BADGE: Record<CompanyTaskPriority, string> = {
  urgent: "bg-rose-50 text-rose-700 border-rose-200",
  high: "bg-amber-50 text-amber-700 border-amber-200",
  med: "bg-sky-50 text-sky-700 border-sky-200",
  low: "bg-ink-50 text-ink-700 border-ink-200"
};

const STATUS_BADGE: Record<CompanyTaskStatus, string> = {
  pending: "bg-ink-50 text-ink-700 border-ink-200",
  in_progress: "bg-sky-50 text-sky-700 border-sky-200",
  done: "bg-emerald-50 text-emerald-700 border-emerald-200",
  skipped: "bg-ink-100 text-ink-500 border-ink-200",
  cancelled: "bg-ink-100 text-ink-500 border-ink-200"
};

const PRIORITY_ORDER: CompanyTaskPriority[] = ["urgent", "high", "med", "low"];
const STATUS_ORDER: CompanyTaskStatus[] = [
  "pending",
  "in_progress",
  "done",
  "skipped",
  "cancelled"
];
const CATEGORY_ORDER: CompanyTaskCategory[] = [
  "meeting_schedule",
  "document_check",
  "material_send",
  "followup",
  "other"
];

type SortKey =
  | "title"
  | "company"
  | "assignee"
  | "priority"
  | "category"
  | "dueDate"
  | "status";
type SortDir = "asc" | "desc";

export function TasksBoard({
  initialTasks,
  companies,
  users,
  currentUserId
}: {
  initialTasks: CompanyTask[];
  companies: { id: string; name: string }[];
  users: { id: string; name: string }[];
  currentUserId: string | null;
}) {
  const [view, setView] = useState<ViewMode>("table");
  const [scope, setScope] = useState<"mine" | "team">(currentUserId ? "mine" : "team");
  const [status, setStatus] = useState<StatusFilter>("open");
  const [priority, setPriority] = useState<CompanyTaskPriority | "all">("all");
  const [due, setDue] = useState<DueFilter>("all");
  const [assignee, setAssignee] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<
    | { taskId: string; companyId: string; nextStatus: CompanyTaskStatus; title: string }
    | null
  >(null);
  const [sortKey, setSortKey] = useState<SortKey>("dueDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const companyMap = useMemo(
    () => new Map(companies.map((c) => [c.id, c.name])),
    [companies]
  );
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);

  const filtered = useMemo(() => {
    let list = initialTasks;
    if (scope === "mine" && currentUserId) {
      list = list.filter((t) => t.assignedTo === currentUserId);
    }
    if (assignee !== "all") {
      list = list.filter((t) => t.assignedTo === assignee);
    }
    if (companyFilter !== "all") {
      list = list.filter((t) => t.companyId === companyFilter);
    }
    if (status === "open") {
      list = list.filter((t) => t.status === "pending" || t.status === "in_progress");
    } else if (status !== "all") {
      list = list.filter((t) => t.status === status);
    }
    if (priority !== "all") {
      list = list.filter((t) => t.priority === priority);
    }
    if (due === "overdue") list = list.filter((t) => isOverdue(t, TODAY));
    if (due === "today") list = list.filter((t) => isDueByToday(t, TODAY));
    if (due === "week") list = list.filter((t) => isDueByWeekEnd(t, WEEK_END));
    return list;
  }, [
    initialTasks,
    scope,
    currentUserId,
    status,
    priority,
    due,
    assignee,
    companyFilter
  ]);

  // 企業セレクトのオプションは、現在タスクのある企業のみに絞る (UI を散らかさない)
  const companyOptions = useMemo(() => {
    const ids = new Set<string>();
    initialTasks.forEach((t) => ids.add(t.companyId));
    return companies
      .filter((c) => ids.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [initialTasks, companies]);

  const sorted = useMemo(() => {
    const dirMul = sortDir === "asc" ? 1 : -1;
    const arr = [...filtered];
    arr.sort((a, b) => {
      switch (sortKey) {
        case "title":
          return a.title.localeCompare(b.title) * dirMul;
        case "company": {
          const an = companyMap.get(a.companyId) ?? "";
          const bn = companyMap.get(b.companyId) ?? "";
          return an.localeCompare(bn) * dirMul;
        }
        case "assignee": {
          const an = (a.assignedTo && userMap.get(a.assignedTo)) ?? "";
          const bn = (b.assignedTo && userMap.get(b.assignedTo)) ?? "";
          return an.localeCompare(bn) * dirMul;
        }
        case "priority":
          return (
            (PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)) *
            dirMul
          );
        case "category": {
          const ai = a.category ? CATEGORY_ORDER.indexOf(a.category) : 999;
          const bi = b.category ? CATEGORY_ORDER.indexOf(b.category) : 999;
          return (ai - bi) * dirMul;
        }
        case "status":
          return (
            (STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)) * dirMul
          );
        case "dueDate":
        default: {
          const ad = a.dueDate ?? "9999-12-31";
          const bd = b.dueDate ?? "9999-12-31";
          return ad.localeCompare(bd) * dirMul;
        }
      }
    });
    return arr;
  }, [filtered, sortKey, sortDir, companyMap, userMap]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function applyStatusChange() {
    if (!confirm) return;
    const { taskId, companyId, nextStatus } = confirm;
    startTransition(async () => {
      await setCompanyTaskStatus(taskId, nextStatus, companyId);
      setConfirm(null);
    });
  }

  function patchTask(
    task: CompanyTask,
    patch: Parameters<typeof updateCompanyTaskFields>[0]["patch"]
  ) {
    startTransition(async () => {
      await updateCompanyTaskFields({
        id: task.id,
        companyId: task.companyId,
        patch
      });
    });
  }

  function changeStatus(task: CompanyTask, next: CompanyTaskStatus) {
    if (next === task.status) return;
    if (next === "done" || next === "skipped" || next === "cancelled") {
      setConfirm({
        taskId: task.id,
        companyId: task.companyId,
        nextStatus: next,
        title: task.title
      });
      return;
    }
    startTransition(async () => {
      await setCompanyTaskStatus(task.id, next, task.companyId);
    });
  }

  return (
    <div className="space-y-4">
      {/* スコープ + ビュー切替 */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setScope("mine")}
          className={[
            "px-3 py-1.5 rounded-full text-sm",
            scope === "mine"
              ? "bg-ink-900 text-white"
              : "bg-white border border-ink-200 text-ink-700 hover:bg-ink-50"
          ].join(" ")}
        >
          自分の担当
        </button>
        <button
          type="button"
          onClick={() => setScope("team")}
          className={[
            "px-3 py-1.5 rounded-full text-sm",
            scope === "team"
              ? "bg-ink-900 text-white"
              : "bg-white border border-ink-200 text-ink-700 hover:bg-ink-50"
          ].join(" ")}
        >
          チーム全体
        </button>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-ink-500">{sorted.length} 件</span>
          <div className="inline-flex rounded-lg border border-ink-200 bg-white overflow-hidden">
            {(["table", "board", "list"] as ViewMode[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={[
                  "px-3 py-1.5 text-xs",
                  view === v
                    ? "bg-ink-900 text-white"
                    : "text-ink-700 hover:bg-ink-50"
                ].join(" ")}
              >
                {v === "table" ? "テーブル" : v === "board" ? "ボード" : "リスト"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* フィルタ */}
      <div className="liquid-surface p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <FilterSelect
          label="ステータス"
          value={status}
          onChange={(v) => setStatus(v as StatusFilter)}
          options={[
            { value: "open", label: "未完了 (未着手+進行中)" },
            { value: "all", label: "すべて" },
            { value: "pending", label: TASK_STATUS_LABEL.pending },
            { value: "in_progress", label: TASK_STATUS_LABEL.in_progress },
            { value: "done", label: TASK_STATUS_LABEL.done },
            { value: "skipped", label: TASK_STATUS_LABEL.skipped },
            { value: "cancelled", label: TASK_STATUS_LABEL.cancelled }
          ]}
        />
        <FilterSelect
          label="優先度"
          value={priority}
          onChange={(v) => setPriority(v as CompanyTaskPriority | "all")}
          options={[
            { value: "all", label: "すべて" },
            { value: "urgent", label: TASK_PRIORITY_LABEL.urgent },
            { value: "high", label: TASK_PRIORITY_LABEL.high },
            { value: "med", label: TASK_PRIORITY_LABEL.med },
            { value: "low", label: TASK_PRIORITY_LABEL.low }
          ]}
        />
        <FilterSelect
          label="期日"
          value={due}
          onChange={(v) => setDue(v as DueFilter)}
          options={[
            { value: "all", label: "すべて" },
            { value: "overdue", label: "期限切れ" },
            { value: "today", label: "今日まで" },
            { value: "week", label: `今週 (〜${WEEK_END})` }
          ]}
        />
        <FilterSelect
          label="担当者"
          value={assignee}
          onChange={setAssignee}
          options={[
            { value: "all", label: "全員" },
            ...users.map((u) => ({ value: u.id, label: u.name }))
          ]}
        />
        <FilterSelect
          label="企業"
          value={companyFilter}
          onChange={setCompanyFilter}
          options={[
            { value: "all", label: "すべて" },
            ...companyOptions.map((c) => ({ value: c.id, label: c.name }))
          ]}
        />
      </div>

      {/* ビュー本体 */}
      {sorted.length === 0 ? (
        <div className="liquid-surface p-8 text-center text-sm text-ink-500">
          条件に合うToDoはありません
        </div>
      ) : view === "table" ? (
        <TableView
          tasks={sorted}
          companyMap={companyMap}
          users={users}
          userMap={userMap}
          sortKey={sortKey}
          sortDir={sortDir}
          onToggleSort={toggleSort}
          onPatch={patchTask}
          onStatusChange={changeStatus}
          pending={pending}
        />
      ) : view === "board" ? (
        <BoardView
          tasks={sorted}
          companyMap={companyMap}
          userMap={userMap}
          onStatusChange={changeStatus}
        />
      ) : (
        <ListView
          tasks={sortByDueAsc(sorted)}
          companyMap={companyMap}
          userMap={userMap}
          onConfirm={(c) => setConfirm(c)}
        />
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.nextStatus === "done"
            ? "このToDoを完了にしますか?"
            : confirm?.nextStatus === "skipped"
              ? "このToDoをスキップしますか?"
              : "このToDoを取消にしますか?"
        }
        description={confirm?.title}
        confirmLabel={
          confirm?.nextStatus === "done"
            ? "完了にする"
            : confirm?.nextStatus === "skipped"
              ? "スキップする"
              : "取消にする"
        }
        tone="warning"
        onConfirm={applyStatusChange}
        onCancel={() => setConfirm(null)}
      />

      {pending && <div className="text-[11px] text-ink-500">処理中...</div>}
    </div>
  );
}

// ─────────────────────────────────────────────
// テーブルビュー (Notion風)
// ─────────────────────────────────────────────
function TableView({
  tasks,
  companyMap,
  users,
  userMap,
  sortKey,
  sortDir,
  onToggleSort,
  onPatch,
  onStatusChange,
  pending
}: {
  tasks: CompanyTask[];
  companyMap: Map<string, string>;
  users: { id: string; name: string }[];
  userMap: Map<string, string>;
  sortKey: SortKey;
  sortDir: SortDir;
  onToggleSort: (k: SortKey) => void;
  onPatch: (
    task: CompanyTask,
    patch: Parameters<typeof updateCompanyTaskFields>[0]["patch"]
  ) => void;
  onStatusChange: (task: CompanyTask, next: CompanyTaskStatus) => void;
  pending: boolean;
}) {
  const cols: { key: SortKey; label: string; w?: string }[] = [
    { key: "title", label: "タイトル", w: "min-w-[220px]" },
    { key: "company", label: "企業", w: "min-w-[140px]" },
    { key: "status", label: "ステータス", w: "w-[120px]" },
    { key: "priority", label: "優先度", w: "w-[100px]" },
    { key: "category", label: "カテゴリ", w: "w-[120px]" },
    { key: "assignee", label: "担当", w: "w-[140px]" },
    { key: "dueDate", label: "期日", w: "w-[140px]" }
  ];

  return (
    <div className="liquid-surface overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-ink-200 bg-ink-50/60 text-[11px] text-ink-500 uppercase tracking-wide">
            {cols.map((c) => (
              <th
                key={c.key}
                className={[
                  "text-left font-medium px-3 py-2 cursor-pointer select-none hover:bg-ink-100/50",
                  c.w ?? ""
                ].join(" ")}
                onClick={() => onToggleSort(c.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {c.label}
                  {sortKey === c.key && (
                    <span className="text-ink-400">{sortDir === "asc" ? "▲" : "▼"}</span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const overdue = isOverdue(t, TODAY);
            return (
              <tr
                key={t.id}
                className={[
                  "border-b border-ink-100 hover:bg-ink-50/40 align-top",
                  overdue ? "bg-rose-50/20" : ""
                ].join(" ")}
              >
                {/* タイトル */}
                <td className="px-3 py-2">
                  <Link
                    href={`/companies/${t.companyId}`}
                    className="font-medium text-ink-900 hover:underline"
                  >
                    {t.title}
                  </Link>
                  {overdue && (
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-semibold">
                      期限切れ
                    </span>
                  )}
                </td>
                {/* 企業 */}
                <td className="px-3 py-2 text-ink-600">
                  <Link
                    href={`/companies/${t.companyId}`}
                    className="hover:underline"
                  >
                    {companyMap.get(t.companyId) ?? t.companyId}
                  </Link>
                </td>
                {/* ステータス */}
                <td className="px-3 py-2">
                  <CellSelect
                    value={t.status}
                    onChange={(v) => onStatusChange(t, v as CompanyTaskStatus)}
                    badgeClass={STATUS_BADGE[t.status]}
                    options={STATUS_ORDER.map((s) => ({
                      value: s,
                      label: TASK_STATUS_LABEL[s]
                    }))}
                    disabled={pending}
                  />
                </td>
                {/* 優先度 */}
                <td className="px-3 py-2">
                  <CellSelect
                    value={t.priority}
                    onChange={(v) =>
                      onPatch(t, { priority: v as CompanyTaskPriority })
                    }
                    badgeClass={PRIORITY_BADGE[t.priority]}
                    options={PRIORITY_ORDER.map((p) => ({
                      value: p,
                      label: TASK_PRIORITY_LABEL[p]
                    }))}
                    disabled={pending}
                  />
                </td>
                {/* カテゴリ */}
                <td className="px-3 py-2">
                  <CellSelect
                    value={t.category ?? ""}
                    onChange={(v) =>
                      onPatch(t, {
                        category: (v || undefined) as CompanyTaskCategory | undefined
                      })
                    }
                    badgeClass="bg-ink-50 text-ink-700 border-ink-200"
                    options={[
                      { value: "", label: "—" },
                      ...CATEGORY_ORDER.map((c) => ({
                        value: c,
                        label: TASK_CATEGORY_LABEL[c]
                      }))
                    ]}
                    disabled={pending}
                  />
                </td>
                {/* 担当 */}
                <td className="px-3 py-2">
                  <CellSelect
                    value={t.assignedTo ?? ""}
                    onChange={(v) => onPatch(t, { assignedTo: v || null })}
                    badgeClass="bg-white text-ink-700 border-ink-200"
                    options={[
                      { value: "", label: "未設定" },
                      ...users.map((u) => ({ value: u.id, label: u.name }))
                    ]}
                    disabled={pending}
                  />
                </td>
                {/* 期日 */}
                <td className="px-3 py-2">
                  <input
                    type="date"
                    value={t.dueDate ?? ""}
                    onChange={(e) =>
                      onPatch(t, { dueDate: e.target.value || null })
                    }
                    disabled={pending}
                    className={[
                      "px-2 py-1 rounded border bg-transparent text-xs",
                      overdue
                        ? "border-rose-300 text-rose-700"
                        : "border-transparent hover:border-ink-200 text-ink-700"
                    ].join(" ")}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CellSelect({
  value,
  onChange,
  options,
  badgeClass,
  disabled
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  badgeClass: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={[
        "text-[11px] px-2 py-1 rounded-full border appearance-none cursor-pointer",
        "focus:outline-none focus:ring-1 focus:ring-ink-300",
        badgeClass
      ].join(" ")}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-white text-ink-900">
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ─────────────────────────────────────────────
// ボード (Kanban by status)
// ─────────────────────────────────────────────
function BoardView({
  tasks,
  companyMap,
  userMap,
  onStatusChange
}: {
  tasks: CompanyTask[];
  companyMap: Map<string, string>;
  userMap: Map<string, string>;
  onStatusChange: (task: CompanyTask, next: CompanyTaskStatus) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<CompanyTaskStatus, CompanyTask[]>();
    STATUS_ORDER.forEach((s) => map.set(s, []));
    tasks.forEach((t) => map.get(t.status)?.push(t));
    return map;
  }, [tasks]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {STATUS_ORDER.map((s) => {
        const list = groups.get(s) ?? [];
        return (
          <div key={s} className="liquid-surface p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full border ${STATUS_BADGE[s]}`}
              >
                {TASK_STATUS_LABEL[s]}
              </span>
              <span className="text-[11px] text-ink-500">{list.length}</span>
            </div>
            <ul className="space-y-2">
              {list.map((t) => {
                const overdue = isOverdue(t, TODAY);
                const company = companyMap.get(t.companyId) ?? t.companyId;
                const assignedName = t.assignedTo ? userMap.get(t.assignedTo) : null;
                return (
                  <li
                    key={t.id}
                    className={[
                      "rounded-lg border bg-white p-2 text-[12px]",
                      overdue ? "border-rose-300" : "border-ink-100"
                    ].join(" ")}
                  >
                    <Link
                      href={`/companies/${t.companyId}`}
                      className="font-medium text-ink-900 hover:underline block"
                    >
                      {t.title}
                    </Link>
                    <div className="text-[11px] text-ink-500 mt-1">{company}</div>
                    <div className="flex items-center gap-1 flex-wrap mt-1.5">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full border ${PRIORITY_BADGE[t.priority]}`}
                      >
                        {TASK_PRIORITY_LABEL[t.priority]}
                      </span>
                      {t.dueDate && (
                        <span
                          className={[
                            "text-[10px] px-1.5 py-0.5 rounded-full border",
                            overdue
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-ink-50 text-ink-700 border-ink-200"
                          ].join(" ")}
                        >
                          {t.dueDate}
                        </span>
                      )}
                      {assignedName && (
                        <span className="text-[10px] text-ink-500">@{assignedName}</span>
                      )}
                    </div>
                    <select
                      value={t.status}
                      onChange={(e) =>
                        onStatusChange(t, e.target.value as CompanyTaskStatus)
                      }
                      className="mt-2 w-full text-[11px] px-1.5 py-1 rounded border border-ink-200 bg-white"
                    >
                      {STATUS_ORDER.map((ss) => (
                        <option key={ss} value={ss}>
                          {TASK_STATUS_LABEL[ss]}に変更
                        </option>
                      ))}
                    </select>
                  </li>
                );
              })}
              {list.length === 0 && (
                <li className="text-[11px] text-ink-400 text-center py-4">—</li>
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// リスト (旧UI互換)
// ─────────────────────────────────────────────
function ListView({
  tasks,
  companyMap,
  userMap,
  onConfirm
}: {
  tasks: CompanyTask[];
  companyMap: Map<string, string>;
  userMap: Map<string, string>;
  onConfirm: (c: {
    taskId: string;
    companyId: string;
    nextStatus: CompanyTaskStatus;
    title: string;
  }) => void;
}) {
  return (
    <ul className="space-y-2">
      {tasks.map((t) => {
        const overdue = isOverdue(t, TODAY);
        const companyName = companyMap.get(t.companyId) ?? t.companyId;
        const assignedName = t.assignedTo ? userMap.get(t.assignedTo) : undefined;
        return (
          <li
            key={t.id}
            className={[
              "rounded-xl border p-3 bg-white flex items-start gap-3",
              overdue ? "border-rose-300 bg-rose-50/30" : "border-ink-100"
            ].join(" ")}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/companies/${t.companyId}`}
                  className="text-xs text-ink-500 hover:underline"
                >
                  {companyName}
                </Link>
                <span className="text-ink-300">·</span>
                <span className="text-sm font-medium text-ink-900">{t.title}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full border ${PRIORITY_BADGE[t.priority]}`}
                >
                  {TASK_PRIORITY_LABEL[t.priority]}
                </span>
                {t.category && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-ink-50 border border-ink-200 text-ink-700">
                    {TASK_CATEGORY_LABEL[t.category]}
                  </span>
                )}
                {overdue && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-semibold">
                    期限切れ
                  </span>
                )}
              </div>
              <div className="text-[11px] text-ink-500 mt-1.5 flex items-center gap-3 flex-wrap">
                {t.dueDate && <span>期日: {t.dueDate}</span>}
                {assignedName && <span>担当: {assignedName}</span>}
                <span>状態: {TASK_STATUS_LABEL[t.status]}</span>
              </div>
            </div>
            {(t.status === "pending" || t.status === "in_progress") && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    onConfirm({
                      taskId: t.id,
                      companyId: t.companyId,
                      nextStatus: "done",
                      title: t.title
                    })
                  }
                  className="text-[11px] px-2 py-1 rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  完了
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onConfirm({
                      taskId: t.id,
                      companyId: t.companyId,
                      nextStatus: "skipped",
                      title: t.title
                    })
                  }
                  className="text-[11px] px-2 py-1 rounded-full border border-ink-200 text-ink-700 hover:bg-ink-50"
                >
                  スキップ
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] text-ink-500 font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1.5 rounded-lg border border-ink-200 text-sm bg-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
