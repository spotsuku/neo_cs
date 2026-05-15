"use client";

// 企業詳細ページ「個社ToDo」セクション (Client Component)
// - 状態別タブ (未着手/進行中/完了/スキップ)
// - 期日順ソート、overdue 強調
// - マーク完了/スキップ/取消 (ConfirmDialog 経由)
// - + ToDo追加 モーダル

import { useMemo, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  TASK_CATEGORY_LABEL,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  isOverdue,
  sortByDueAsc
} from "@/lib/domain/tasks/task";
import type {
  CompanyTask,
  CompanyTaskPriority,
  CompanyTaskStatus,
  CompanyTaskCategory
} from "@/lib/repository/types";
import { createCompanyTask, setCompanyTaskStatus } from "@/app/(relationship)/companies/[id]/taskActions";

const TODAY = new Date().toISOString().slice(0, 10);

const TAB_ORDER: { key: CompanyTaskStatus; label: string }[] = [
  { key: "pending", label: "未着手" },
  { key: "in_progress", label: "進行中" },
  { key: "done", label: "完了" },
  { key: "skipped", label: "スキップ" }
];

const PRIORITY_BADGE: Record<CompanyTaskPriority, string> = {
  urgent: "bg-rose-50 text-rose-700 border-rose-200",
  high: "bg-amber-50 text-amber-700 border-amber-200",
  med: "bg-sky-50 text-sky-700 border-sky-200",
  low: "bg-ink-50 text-ink-700 border-ink-200"
};

export function CompanyTasksSection({
  companyId,
  initialTasks,
  contracts,
  members
}: {
  companyId: string;
  initialTasks: CompanyTask[];
  contracts: { id: string; label: string }[];
  members: { id: string; name: string }[];
}) {
  const [tab, setTab] = useState<CompanyTaskStatus>("pending");
  const [showAdd, setShowAdd] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<
    | { taskId: string; nextStatus: CompanyTaskStatus; title: string }
    | null
  >(null);

  const grouped = useMemo(() => {
    const g: Record<CompanyTaskStatus, CompanyTask[]> = {
      pending: [],
      in_progress: [],
      done: [],
      skipped: [],
      cancelled: []
    };
    for (const t of initialTasks) g[t.status]?.push(t);
    return g;
  }, [initialTasks]);

  const visible = sortByDueAsc(grouped[tab] ?? []);

  function actionLabel(s: CompanyTaskStatus): string {
    return s === "done"
      ? "このToDoを完了にしますか?"
      : s === "skipped"
      ? "このToDoをスキップしますか?"
      : s === "cancelled"
      ? "このToDoを取消しますか?"
      : "状態を変更しますか?";
  }

  function applyStatusChange() {
    if (!confirm) return;
    const { taskId, nextStatus } = confirm;
    startTransition(async () => {
      await setCompanyTaskStatus(taskId, nextStatus, companyId);
      setConfirm(null);
    });
  }

  return (
    <section className="liquid-surface p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-ink-700">個社ToDo</div>
          <div className="text-[11px] text-ink-500 mt-0.5">
            オンボとは別の社内タスク (面談調整・提出物確認・資料送付など)
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 rounded-full bg-ink-900 text-white text-xs hover:opacity-90"
        >
          + ToDo追加
        </button>
      </div>

      {/* タブ */}
      <nav className="flex items-center gap-1 border-b border-ink-100">
        {TAB_ORDER.map((t) => {
          const active = tab === t.key;
          const count = grouped[t.key]?.length ?? 0;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={[
                "px-3 py-2 text-xs transition relative -mb-px",
                active
                  ? "text-ink-900 font-semibold border-b-2 border-ink-900"
                  : "text-ink-500 hover:text-ink-700"
              ].join(" ")}
            >
              {t.label}
              <span className="ml-1 text-[10px] text-ink-500">{count}</span>
            </button>
          );
        })}
      </nav>

      {/* リスト */}
      {visible.length === 0 ? (
        <div className="text-sm text-ink-500 py-6 text-center">
          {tab === "pending" ? "未着手のToDoはありません" : "該当するToDoはありません"}
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visible.map((t) => {
            const overdue = isOverdue(t, TODAY);
            const member = members.find((m) => m.id === t.assignedTo);
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
                  {t.description && (
                    <div className="text-xs text-ink-700 mt-1 whitespace-pre-wrap">
                      {t.description}
                    </div>
                  )}
                  <div className="text-[11px] text-ink-500 mt-1.5 flex items-center gap-3">
                    {t.dueDate && <span>期日: {t.dueDate}</span>}
                    {member && <span>担当: {member.name}</span>}
                    <span>状態: {TASK_STATUS_LABEL[t.status]}</span>
                  </div>
                </div>
                {(t.status === "pending" || t.status === "in_progress") && (
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setConfirm({ taskId: t.id, nextStatus: "done", title: t.title })
                      }
                      className="text-[11px] px-2 py-1 rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      完了
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirm({ taskId: t.id, nextStatus: "skipped", title: t.title })
                      }
                      className="text-[11px] px-2 py-1 rounded-full border border-ink-200 text-ink-700 hover:bg-ink-50"
                    >
                      スキップ
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirm({ taskId: t.id, nextStatus: "cancelled", title: t.title })
                      }
                      className="text-[11px] px-2 py-1 rounded-full text-rose-600 hover:bg-rose-50"
                    >
                      取消
                    </button>
                  </div>
                )}
                {t.status === "done" && t.completedAt && (
                  <div className="text-[11px] text-ink-500 shrink-0">
                    完了: {t.completedAt.slice(0, 10)}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {showAdd && (
        <AddTaskModal
          companyId={companyId}
          contracts={contracts}
          members={members}
          onClose={() => setShowAdd(false)}
        />
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm ? actionLabel(confirm.nextStatus) : ""}
        description={confirm?.title}
        confirmLabel={
          confirm?.nextStatus === "done"
            ? "完了にする"
            : confirm?.nextStatus === "skipped"
            ? "スキップする"
            : "取消する"
        }
        tone={confirm?.nextStatus === "cancelled" ? "danger" : "warning"}
        onConfirm={applyStatusChange}
        onCancel={() => setConfirm(null)}
      />

      {pending && (
        <div className="text-[11px] text-ink-500">処理中...</div>
      )}
    </section>
  );
}

function AddTaskModal({
  companyId,
  contracts,
  members,
  onClose
}: {
  companyId: string;
  contracts: { id: string; label: string }[];
  members: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CompanyTaskCategory | "">("");
  const [priority, setPriority] = useState<CompanyTaskPriority>("med");
  const [dueDate, setDueDate] = useState<string>("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [contractId, setContractId] = useState<string>("");
  const [submitting, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("タイトルは必須です");
      return;
    }
    startTransition(async () => {
      try {
        await createCompanyTask({
          companyId,
          title,
          description: description || undefined,
          category: (category || undefined) as CompanyTaskCategory | undefined,
          priority,
          dueDate: dueDate || undefined,
          assignedTo: assignedTo || undefined,
          contractId: contractId || undefined
        });
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存に失敗しました");
      }
    });
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-xs cursor-default"
      />
      <form
        onSubmit={handleSubmit}
        className="relative bg-white rounded-2xl shadow-xl border border-ink-100 w-[min(560px,94vw)] p-6 space-y-4"
      >
        <h2 className="text-base font-semibold text-ink-900">個社ToDoを追加</h2>

        <div className="space-y-1">
          <label className="text-xs text-ink-700">タイトル *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-ink-200 text-sm"
            placeholder="例: 次回定例の日程調整"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-ink-700">説明</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-ink-200 text-sm"
            placeholder="補足メモ"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-ink-700">カテゴリ</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CompanyTaskCategory | "")}
              className="w-full px-3 py-2 rounded-lg border border-ink-200 text-sm bg-white"
            >
              <option value="">未指定</option>
              {Object.entries(TASK_CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-ink-700">優先度 *</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as CompanyTaskPriority)}
              className="w-full px-3 py-2 rounded-lg border border-ink-200 text-sm bg-white"
            >
              {Object.entries(TASK_PRIORITY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-ink-700">期日</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-ink-200 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-ink-700">担当者</label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-ink-200 text-sm bg-white"
            >
              <option value="">未指定</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {contracts.length > 0 && (
          <div className="space-y-1">
            <label className="text-xs text-ink-700">関連契約 (任意)</label>
            <select
              value={contractId}
              onChange={(e) => setContractId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-ink-200 text-sm bg-white"
            >
              <option value="">指定しない</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && <div className="text-xs text-rose-600">{error}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-sm text-ink-700 border border-ink-100 hover:bg-ink-50"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-full text-sm text-white bg-ink-900 hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "保存中..." : "追加"}
          </button>
        </div>
      </form>
    </div>
  );
}
