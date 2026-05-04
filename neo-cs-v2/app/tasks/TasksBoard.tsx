"use client";

// /tasks 一覧ボード
// - フィルタ: status / priority / due (今日まで/今週/期限切れ) / assigned_to
// - 期日順ソート、overdue 強調
// - 各 row から企業詳細にジャンプ

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
  CompanyTaskPriority,
  CompanyTaskStatus
} from "@/lib/repository/types";
import { setCompanyTaskStatus } from "@/app/companies/[id]/taskActions";

const TODAY = new Date().toISOString().slice(0, 10);
const WEEK_END = endOfWeek(TODAY);

type StatusFilter = CompanyTaskStatus | "all" | "open";
type DueFilter = "all" | "overdue" | "today" | "week";

const PRIORITY_BADGE: Record<CompanyTaskPriority, string> = {
  urgent: "bg-rose-50 text-rose-700 border-rose-200",
  high: "bg-amber-50 text-amber-700 border-amber-200",
  med: "bg-sky-50 text-sky-700 border-sky-200",
  low: "bg-ink-50 text-ink-700 border-ink-200"
};

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
  const [scope, setScope] = useState<"mine" | "team">(currentUserId ? "mine" : "team");
  const [status, setStatus] = useState<StatusFilter>("open");
  const [priority, setPriority] = useState<CompanyTaskPriority | "all">("all");
  const [due, setDue] = useState<DueFilter>("all");
  const [assignee, setAssignee] = useState<string>("all");
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<
    | { taskId: string; companyId: string; nextStatus: CompanyTaskStatus; title: string }
    | null
  >(null);

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
    return sortByDueAsc(list);
  }, [initialTasks, scope, currentUserId, status, priority, due, assignee]);

  function applyStatusChange() {
    if (!confirm) return;
    const { taskId, companyId, nextStatus } = confirm;
    startTransition(async () => {
      await setCompanyTaskStatus(taskId, nextStatus, companyId);
      setConfirm(null);
    });
  }

  return (
    <div className="space-y-4">
      {/* スコープ */}
      <div className="flex items-center gap-2">
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
        <span className="ml-auto text-xs text-ink-500">{filtered.length} 件</span>
      </div>

      {/* フィルタ */}
      <div className="liquid-surface p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
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
      </div>

      {/* リスト */}
      {filtered.length === 0 ? (
        <div className="liquid-surface p-8 text-center text-sm text-ink-500">
          条件に合うToDoはありません
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((t) => {
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
                        setConfirm({
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
                        setConfirm({
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
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.nextStatus === "done"
            ? "このToDoを完了にしますか?"
            : "このToDoをスキップしますか?"
        }
        description={confirm?.title}
        confirmLabel={confirm?.nextStatus === "done" ? "完了にする" : "スキップする"}
        tone="warning"
        onConfirm={applyStatusChange}
        onCancel={() => setConfirm(null)}
      />

      {pending && <div className="text-[11px] text-ink-500">処理中...</div>}
    </div>
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
