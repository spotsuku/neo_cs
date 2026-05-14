"use client";

// VOC カンバンボード (Notion風 UI)
// - 4列 (未対応 / 対応中 / 完了 / 対応なし) で各カードを管理
// - カードはドラッグ&ドロップで列間を移動 (= ステータス変更)
// - カードクリックで右側パネルに詳細表示 (Notion のページプレビュー風)
// - フィルタ: 検索 / タグ / 担当者 / 優先度
// - CSV エクスポート (Notion / Linear 取り込み用)

import { useMemo, useState, useRef } from "react";
import Link from "next/link";
import type { VocItemRecord, VocStatus, VocPriority, VocSourceType } from "@/lib/repository";
import {
  listVocItemsAction,
  createVocItemAction,
  setVocStatusAction,
  setVocPriorityAction,
  setVocAssigneeAction,
  setVocTagsAction,
  appendVocCommentAction
} from "./actions";
import { VOC_TAG_LABEL, type VocTag } from "@/lib/domain/voc/voc";

const COLUMNS: { key: VocStatus; label: string; accent: string; dot: string }[] = [
  { key: "open", label: "未対応", accent: "border-info-100", dot: "bg-info-500" },
  { key: "in_progress", label: "対応中", accent: "border-warning-100", dot: "bg-warning-500" },
  { key: "done", label: "完了", accent: "border-success-100", dot: "bg-success-500" },
  { key: "wontfix", label: "対応なし", accent: "border-neutral-300", dot: "bg-neutral-400" }
];

const STATUS_LABEL: Record<VocStatus, string> = {
  open: "未対応",
  in_progress: "対応中",
  done: "完了",
  wontfix: "対応なし"
};

const PRIORITIES: VocPriority[] = ["high", "med", "low"];

const PRIORITY_LABEL: Record<VocPriority, string> = {
  high: "高",
  med: "中",
  low: "低"
};

const PRIORITY_BADGE: Record<VocPriority, string> = {
  high: "bg-danger-50 text-danger-700 border-danger-100",
  med: "bg-warning-50 text-warning-700 border-warning-100",
  low: "bg-info-50 text-info-700 border-info-100"
};

const SOURCE_LABEL: Record<VocItemRecord["sourceType"], string> = {
  survey_response: "サーベイ",
  meeting_log: "面談",
  weekly_review: "週次"
};

function escapeCsv(v: string | number | undefined): string {
  if (v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function exportCsv(items: VocItemRecord[]): void {
  const header = [
    "id",
    "company_id",
    "contract_id",
    "source_type",
    "source_id",
    "status",
    "priority",
    "tags",
    "excerpt",
    "linked_pr_url",
    "created_at",
    "updated_at"
  ];
  const rows = items.map((v) =>
    [
      v.id,
      v.companyId,
      v.contractId,
      v.sourceType,
      v.sourceId,
      v.status,
      v.priority,
      v.tags.join("|"),
      v.excerpt,
      v.linkedPrUrl,
      v.createdAt,
      v.updatedAt
    ]
      .map(escapeCsv)
      .join(",")
  );
  const csv = "﻿" + [header.join(","), ...rows].join("\n") + "\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `neo-cs-voc-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function VocBoard({
  initialItems,
  companies,
  users
}: {
  initialItems: VocItemRecord[];
  companies: { id: string; name: string }[];
  users: { id: string; name: string }[];
}) {
  const [items, setItems] = useState<VocItemRecord[]>(initialItems);
  const [search, setSearch] = useState<string>("");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<VocStatus | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const companyById = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies]
  );
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const filtered = useMemo(() => {
    return items.filter((v) => {
      if (tagFilter && !v.tags.includes(tagFilter)) return false;
      if (assigneeFilter && v.assignedTo !== assigneeFilter) return false;
      if (priorityFilter && v.priority !== priorityFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const co = v.companyId ? companyById.get(v.companyId)?.name ?? "" : "";
        const hay = [v.excerpt, v.id, co].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, tagFilter, assigneeFilter, priorityFilter, search, companyById]);

  const itemsByStatus = useMemo(() => {
    const map = new Map<VocStatus, VocItemRecord[]>();
    for (const c of COLUMNS) map.set(c.key, []);
    for (const v of filtered) {
      map.get(v.status)?.push(v);
    }
    return map;
  }, [filtered]);

  const openItem = openCardId ? items.find((v) => v.id === openCardId) ?? null : null;

  async function reload() {
    const list = await listVocItemsAction();
    setItems(list);
  }
  async function changeStatus(id: string, status: VocStatus) {
    // 楽観的更新
    setItems((prev) =>
      prev.map((v) => (v.id === id ? { ...v, status } : v))
    );
    await setVocStatusAction(id, status);
    reload();
  }
  async function changePriority(id: string, priority: VocPriority) {
    await setVocPriorityAction(id, priority);
    reload();
  }
  async function changeAssignee(id: string, userId: string) {
    await setVocAssigneeAction(id, userId || null);
    reload();
  }
  async function changeTags(id: string, tags: string[]) {
    setItems((prev) => prev.map((v) => (v.id === id ? { ...v, tags } : v)));
    await setVocTagsAction(id, tags);
    reload();
  }
  async function addComment(id: string, body: string) {
    await appendVocCommentAction(id, body);
    reload();
  }

  function handleDragStart(id: string) {
    setDraggingId(id);
  }
  function handleDragEnd() {
    setDraggingId(null);
    setDragOverCol(null);
  }
  function handleDragOver(e: React.DragEvent, col: VocStatus) {
    e.preventDefault();
    if (dragOverCol !== col) setDragOverCol(col);
  }
  function handleDrop(col: VocStatus) {
    if (draggingId) {
      const target = items.find((v) => v.id === draggingId);
      if (target && target.status !== col) {
        changeStatus(draggingId, col);
      }
    }
    setDraggingId(null);
    setDragOverCol(null);
  }

  return (
    <div className="space-y-4">
      {/* ツールバー */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="search"
          placeholder="抜粋・企業名・ID で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 rounded-md border border-borderc text-caption bg-surface focus-ring w-56"
        />
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="px-3 py-1.5 rounded-md border border-borderc text-caption bg-surface focus-ring"
        >
          <option value="">タグ: すべて</option>
          {(Object.keys(VOC_TAG_LABEL) as VocTag[]).map((t) => (
            <option key={t} value={t}>
              {VOC_TAG_LABEL[t]}
            </option>
          ))}
        </select>
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="px-3 py-1.5 rounded-md border border-borderc text-caption bg-surface focus-ring"
        >
          <option value="">担当: すべて</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-1.5 rounded-md border border-borderc text-caption bg-surface focus-ring"
        >
          <option value="">優先度: すべて</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
        <span className="text-caption text-neutral-500 tabular-nums">
          {filtered.length} / {items.length} 件
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="px-3 py-1.5 rounded-pill bg-neutral-900 text-surface text-caption hover:bg-neutral-700 focus-ring"
          >
            + 新規 VOC
          </button>
          <button
            type="button"
            onClick={() => exportCsv(filtered)}
            className="px-3 py-1.5 rounded-pill bg-surface border border-neutral-300 text-caption text-neutral-700 hover:bg-neutral-50 focus-ring"
          >
            CSV エクスポート ({filtered.length})
          </button>
        </div>
      </div>

      {/* カンバン */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {COLUMNS.map((col) => {
          const colItems = itemsByStatus.get(col.key) ?? [];
          const isOver = dragOverCol === col.key;
          return (
            <div
              key={col.key}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDrop={() => handleDrop(col.key)}
              className={[
                "rounded-lg border bg-neutral-50/60 p-2 min-h-[200px] flex flex-col gap-2 transition",
                col.accent,
                isOver ? "bg-info-50/60 ring-2 ring-info-200" : ""
              ].join(" ")}
            >
              <div className="flex items-center gap-2 px-2 pt-1 pb-2 sticky top-0">
                <span className={`inline-block w-2 h-2 rounded-full ${col.dot}`} />
                <span className="text-caption font-medium text-neutral-900">
                  {col.label}
                </span>
                <span className="text-caption text-neutral-500 tabular-nums">
                  {colItems.length}
                </span>
              </div>
              {colItems.length === 0 ? (
                <div className="text-caption text-neutral-400 text-center py-8 px-2">
                  カードはありません
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {colItems.map((v) => {
                    const co = v.companyId ? companyById.get(v.companyId) : null;
                    const assignee = v.assignedTo ? userById.get(v.assignedTo) : null;
                    return (
                      <button
                        type="button"
                        key={v.id}
                        id={v.id}
                        draggable
                        onDragStart={() => handleDragStart(v.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => setOpenCardId(v.id)}
                        className={[
                          "text-left bg-surface rounded-md border border-neutral-100 hover:border-neutral-300 hover:shadow-card transition px-3 py-2.5 space-y-1.5 cursor-grab active:cursor-grabbing focus-ring",
                          draggingId === v.id ? "opacity-40" : ""
                        ].join(" ")}
                      >
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span
                            className={`inline-flex px-1.5 py-0 rounded-pill border text-caption font-medium ${PRIORITY_BADGE[v.priority]}`}
                          >
                            {PRIORITY_LABEL[v.priority]}
                          </span>
                          <span className="text-caption text-neutral-400">
                            {SOURCE_LABEL[v.sourceType]}
                          </span>
                          {v.notifiedAt && (
                            <span className="text-caption text-success-700">✓</span>
                          )}
                        </div>
                        <p className="text-body text-neutral-900 line-clamp-3 whitespace-pre-wrap">
                          {v.excerpt}
                        </p>
                        {co && (
                          <div className="text-caption text-neutral-600 truncate">
                            {co.name}
                          </div>
                        )}
                        <div className="flex items-baseline flex-wrap gap-1">
                          {v.tags.slice(0, 3).map((t) => (
                            <span
                              key={t}
                              className="inline-flex px-1.5 py-0 rounded-pill border border-neutral-200 bg-neutral-50 text-caption text-neutral-600"
                            >
                              {VOC_TAG_LABEL[t as VocTag] ?? t}
                            </span>
                          ))}
                          {v.tags.length > 3 && (
                            <span className="text-caption text-neutral-400">
                              +{v.tags.length - 3}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <span className="text-caption text-neutral-400 tabular-nums">
                            {v.createdAt.slice(0, 10)}
                          </span>
                          <div className="flex items-center gap-2 text-caption text-neutral-500">
                            {v.comments.length > 0 && (
                              <span title="コメント数">💬 {v.comments.length}</span>
                            )}
                            {assignee ? (
                              <span className="inline-flex items-center gap-1 text-caption text-neutral-700">
                                <span
                                  aria-hidden="true"
                                  className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-purple/15 text-brand-purple text-[10px] font-medium"
                                >
                                  {assignee.name.slice(0, 1)}
                                </span>
                                {assignee.name}
                              </span>
                            ) : (
                              <span className="text-caption text-neutral-400">担当未割当</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 新規 VOC 作成モーダル */}
      {createOpen && (
        <CreateVocModal
          companies={companies}
          users={users}
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            await reload();
          }}
        />
      )}

      {/* 詳細ドロワー (Notion ページプレビュー風) */}
      {openItem && (
        <CardDrawer
          item={openItem}
          company={openItem.companyId ? companyById.get(openItem.companyId) ?? null : null}
          users={users}
          userById={userById}
          onClose={() => setOpenCardId(null)}
          onChangeStatus={(s) => changeStatus(openItem.id, s)}
          onChangePriority={(p) => changePriority(openItem.id, p)}
          onChangeAssignee={(u) => changeAssignee(openItem.id, u)}
          onChangeTags={(t) => changeTags(openItem.id, t)}
          onAddComment={(b) => addComment(openItem.id, b)}
        />
      )}
    </div>
  );
}

function CardDrawer({
  item,
  company,
  users,
  userById,
  onClose,
  onChangeStatus,
  onChangePriority,
  onChangeAssignee,
  onChangeTags,
  onAddComment
}: {
  item: VocItemRecord;
  company: { id: string; name: string } | null;
  users: { id: string; name: string }[];
  userById: Map<string, { id: string; name: string }>;
  onClose: () => void;
  onChangeStatus: (s: VocStatus) => void;
  onChangePriority: (p: VocPriority) => void;
  onChangeAssignee: (u: string) => void;
  onChangeTags: (tags: string[]) => void;
  onAddComment: (body: string) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex justify-end"
    >
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="absolute inset-0 bg-neutral-900/30 cursor-default"
      />
      <div
        ref={dialogRef}
        className="relative bg-surface w-[min(640px,96vw)] h-full overflow-auto shadow-cardHover border-l border-neutral-100 px-6 py-5 space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex px-2 py-0.5 rounded-pill border text-caption font-medium ${PRIORITY_BADGE[item.priority]}`}
            >
              優先度 {PRIORITY_LABEL[item.priority]}
            </span>
            <span className="text-caption text-neutral-500">
              {STATUS_LABEL[item.status]}
            </span>
            <span className="text-caption text-neutral-400">
              {SOURCE_LABEL[item.sourceType]}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 rounded-md text-caption text-neutral-500 hover:bg-neutral-100 focus-ring"
          >
            ✕
          </button>
        </div>

        <div className="space-y-1">
          <p className="text-h3 font-semibold text-neutral-900 whitespace-pre-wrap">
            {item.excerpt}
          </p>
          {company && (
            <Link
              href={`/companies/${company.id}`}
              className="text-caption text-info-700 hover:underline focus-ring rounded-sm"
            >
              {company.name} →
            </Link>
          )}
        </div>

        <dl className="grid grid-cols-[120px_1fr] gap-y-2 gap-x-3 text-caption">
          <dt className="text-neutral-500">ステータス</dt>
          <dd>
            <select
              value={item.status}
              onChange={(e) => onChangeStatus(e.target.value as VocStatus)}
              className="px-2 py-1 rounded-md border border-borderc text-caption bg-surface focus-ring"
            >
              {COLUMNS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </dd>
          <dt className="text-neutral-500">優先度</dt>
          <dd>
            <select
              value={item.priority}
              onChange={(e) => onChangePriority(e.target.value as VocPriority)}
              className="px-2 py-1 rounded-md border border-borderc text-caption bg-surface focus-ring"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </dd>
          <dt className="text-neutral-500">担当者</dt>
          <dd>
            <select
              value={item.assignedTo ?? ""}
              onChange={(e) => onChangeAssignee(e.target.value)}
              className="px-2 py-1 rounded-md border border-borderc text-caption bg-surface focus-ring"
            >
              <option value="">未割当</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </dd>
          <dt className="text-neutral-500 self-start pt-1">タグ</dt>
          <dd>
            <TagSelector value={item.tags} onChange={onChangeTags} />
          </dd>
          <dt className="text-neutral-500">作成日</dt>
          <dd className="tabular-nums text-neutral-700">{item.createdAt.slice(0, 10)}</dd>
          <dt className="text-neutral-500">更新日</dt>
          <dd className="tabular-nums text-neutral-700">{item.updatedAt.slice(0, 10)}</dd>
          {item.notifiedAt && (
            <>
              <dt className="text-neutral-500">Slack 通知</dt>
              <dd className="text-success-700">✓ 通知済</dd>
            </>
          )}
        </dl>

        <div className="space-y-2 pt-2 border-t border-neutral-100">
          <h4 className="text-caption font-semibold text-neutral-700">
            コメント ({item.comments.length})
          </h4>
          <ul className="space-y-2">
            {item.comments.map((c) => {
              const author = userById.get(c.authorUserId);
              return (
                <li
                  key={c.id}
                  className="border-l-2 border-neutral-100 pl-3 py-1"
                >
                  <div className="text-caption text-neutral-500">
                    <span className="font-medium text-neutral-700">
                      {author?.name ?? c.authorUserId}
                    </span>
                    <span className="ml-2 tabular-nums">{c.createdAt.slice(0, 10)}</span>
                  </div>
                  <p className="text-body text-neutral-900 whitespace-pre-wrap">
                    {c.body}
                  </p>
                </li>
              );
            })}
          </ul>
          <CommentForm onSubmit={onAddComment} />
        </div>
      </div>
    </div>
  );
}

function CreateVocModal({
  companies,
  users,
  onClose,
  onCreated
}: {
  companies: { id: string; name: string }[];
  users: { id: string; name: string }[];
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [excerpt, setExcerpt] = useState("");
  const [companyId, setCompanyId] = useState<string>("");
  const [companyQuery, setCompanyQuery] = useState<string>("");
  const [companyListOpen, setCompanyListOpen] = useState(false);
  const [sourceType, setSourceType] = useState<VocSourceType>("meeting_log");
  const [priority, setPriority] = useState<VocPriority>("med");
  const [status, setStatus] = useState<VocStatus>("open");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [tagsList, setTagsList] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit() {
    if (!excerpt.trim()) {
      setErr("内容は必須です");
      return;
    }
    if (companyQuery.trim() && !companyId) {
      setErr("企業は候補から選択してください (空欄ならクリアしてください)");
      return;
    }
    setSubmitting(true);
    setErr(null);
    const res = await createVocItemAction({
      sourceType,
      sourceId: `manual-${Date.now()}`,
      companyId: companyId || undefined,
      excerpt: excerpt.trim(),
      tags: tagsList,
      status,
      priority,
      assignedTo: assignedTo || undefined
    });
    if (res.ok) {
      await onCreated();
    } else {
      setErr(res.message);
      setSubmitting(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="absolute inset-0 bg-neutral-900/40 cursor-default"
      />
      <div className="relative bg-surface rounded-xl shadow-cardHover border border-neutral-100 w-[min(560px,94vw)] max-h-[90vh] overflow-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-h4 font-semibold text-neutral-900">新規 VOC を追加</h3>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 rounded-md text-caption text-neutral-500 hover:bg-neutral-100 focus-ring"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-caption text-neutral-700">内容 (顧客の声) *</label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={4}
              placeholder="例: ダッシュボードに前年同月比のグラフが欲しい"
              className="w-full px-3 py-2 rounded-md border border-borderc text-body bg-surface focus-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 relative">
              <label className="text-caption text-neutral-700">企業</label>
              <input
                type="text"
                value={companyQuery}
                onChange={(e) => {
                  setCompanyQuery(e.target.value);
                  setCompanyId("");
                  setCompanyListOpen(true);
                }}
                onFocus={() => setCompanyListOpen(true)}
                onBlur={() => {
                  // クリック処理を優先するため遅延クローズ
                  setTimeout(() => setCompanyListOpen(false), 150);
                }}
                placeholder="企業名で検索 (未指定可)"
                className="w-full px-2 py-1.5 rounded-md border border-borderc text-caption bg-surface focus-ring"
              />
              {companyListOpen && (
                <ul className="absolute z-10 mt-1 left-0 right-0 max-h-56 overflow-auto bg-surface border border-neutral-200 rounded-md shadow-card text-caption">
                  {(() => {
                    const q = companyQuery.trim().toLowerCase();
                    const list = q
                      ? companies.filter((c) => c.name.toLowerCase().includes(q))
                      : companies;
                    if (list.length === 0) {
                      return (
                        <li className="px-3 py-2 text-neutral-400">該当なし</li>
                      );
                    }
                    return list.slice(0, 50).map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setCompanyId(c.id);
                            setCompanyQuery(c.name);
                            setCompanyListOpen(false);
                          }}
                          className={[
                            "w-full text-left px-3 py-1.5 hover:bg-neutral-50 focus-ring",
                            companyId === c.id ? "bg-info-50 text-info-700" : ""
                          ].join(" ")}
                        >
                          {c.name}
                        </button>
                      </li>
                    ));
                  })()}
                </ul>
              )}
              {companyQuery && !companyId && (
                <p className="text-caption text-neutral-400 mt-1">
                  候補から選択してください (空のままでも作成可)
                </p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-caption text-neutral-700">ソース</label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as VocSourceType)}
                className="w-full px-2 py-1.5 rounded-md border border-borderc text-caption bg-surface focus-ring"
              >
                <option value="meeting_log">面談</option>
                <option value="survey_response">サーベイ</option>
                <option value="weekly_review">週次</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-caption text-neutral-700">優先度</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as VocPriority)}
                className="w-full px-2 py-1.5 rounded-md border border-borderc text-caption bg-surface focus-ring"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-caption text-neutral-700">ステータス</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as VocStatus)}
                className="w-full px-2 py-1.5 rounded-md border border-borderc text-caption bg-surface focus-ring"
              >
                {COLUMNS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-caption text-neutral-700">担当者</label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-2 py-1.5 rounded-md border border-borderc text-caption bg-surface focus-ring"
              >
                <option value="">未割当</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-caption text-neutral-700">タグ</label>
              <TagSelector value={tagsList} onChange={setTagsList} />
            </div>
          </div>

          {err && <p className="text-caption text-danger-700">エラー: {err}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-pill bg-surface border border-neutral-300 text-caption text-neutral-700 hover:bg-neutral-50 focus-ring"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !excerpt.trim()}
              className="px-3 py-1.5 rounded-pill bg-neutral-900 text-surface text-caption hover:bg-neutral-700 disabled:opacity-50 focus-ring"
            >
              {submitting ? "作成中..." : "作成する"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 標準 VocTag をドロップダウン候補として提示するマルチセレクト。
// item.tags には標準外の自由タグ (例: 旧データの "教材"/"praise" など) も保存され得るため、
// 既存値はバッジ表示のまま削除可能、追加は標準タグの中から選ぶ運用とする。
function TagSelector({
  value,
  onChange
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const valueSet = useMemo(() => new Set(value), [value]);
  const standardTags = Object.keys(VOC_TAG_LABEL) as VocTag[];

  function toggle(tag: string) {
    if (valueSet.has(tag)) {
      onChange(value.filter((t) => t !== tag));
    } else {
      onChange([...value, tag]);
    }
  }
  function remove(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {value.length === 0 && (
          <span className="text-caption text-neutral-400">タグなし</span>
        )}
        {value.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill border border-neutral-300 bg-neutral-50 text-caption text-neutral-700"
          >
            {VOC_TAG_LABEL[t as VocTag] ?? t}
            <button
              type="button"
              onClick={() => remove(t)}
              aria-label={`${t} を削除`}
              className="text-neutral-400 hover:text-danger-700 focus-ring rounded-sm"
            >
              ×
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="px-2 py-0.5 rounded-pill border border-dashed border-neutral-300 text-caption text-neutral-600 hover:bg-neutral-50 focus-ring"
        >
          + タグ追加
        </button>
      </div>
      {open && (
        <div className="border border-neutral-200 rounded-md bg-surface shadow-card p-2 space-y-1 max-w-xs">
          {standardTags.map((t) => {
            const checked = valueSet.has(t);
            return (
              <label
                key={t}
                className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-neutral-50 cursor-pointer text-caption"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(t)}
                  className="focus-ring"
                />
                <span className="text-neutral-700">{VOC_TAG_LABEL[t]}</span>
                <span className="text-neutral-400 ml-auto">{t}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CommentForm({ onSubmit }: { onSubmit: (body: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div className="mt-2 flex items-stretch gap-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="コメントを追加..."
        className="flex-1 px-3 py-1.5 rounded-md border border-borderc text-caption bg-surface focus-ring"
      />
      <button
        type="button"
        onClick={() => {
          onSubmit(text);
          setText("");
        }}
        className="px-3 py-1.5 rounded-pill bg-surface border border-neutral-300 text-caption text-neutral-700 hover:bg-neutral-50 focus-ring"
      >
        投稿
      </button>
    </div>
  );
}
