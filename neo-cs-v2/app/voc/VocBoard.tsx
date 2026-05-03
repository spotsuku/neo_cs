"use client";

// VOC 一覧 + トリアージ UI (Client Component)
// - ステータスタブ (new / triaged / backlog / shipped / wontfix / all)
// - タグフィルタ
// - 各カードでステータス変更・優先度変更・コメント追加
// - CSV エクスポート (Notion / Linear 取り込み用)

import { useMemo, useState } from "react";
import Link from "next/link";
import { vocItemRepo, userRepo } from "@/lib/repository";
import type { VocItemRecord, VocStatus, VocPriority } from "@/lib/repository";
import { VOC_TAG_LABEL, type VocTag } from "@/lib/domain/voc";

const STATUSES: { key: VocStatus; label: string }[] = [
  { key: "new", label: "新規" },
  { key: "triaged", label: "トリアージ済" },
  { key: "backlog", label: "バックログ" },
  { key: "shipped", label: "リリース済" },
  { key: "wontfix", label: "対応せず" }
];

const PRIORITIES: VocPriority[] = ["high", "med", "low"];

const PRIORITY_BADGE: Record<VocPriority, string> = {
  high: "bg-danger-50 text-danger-700 border-danger-100",
  med: "bg-warning-50 text-warning-700 border-warning-100",
  low: "bg-info-50 text-info-700 border-info-100"
};

const STATUS_BADGE: Record<VocStatus, string> = {
  new: "bg-info-50 text-info-700 border-info-100",
  triaged: "bg-warning-50 text-warning-700 border-warning-100",
  backlog: "bg-brand-purple/10 text-brand-purple border-brand-purple/20",
  shipped: "bg-success-50 text-success-700 border-success-100",
  wontfix: "bg-neutral-100 text-neutral-700 border-neutral-300"
};

const SOURCE_LABEL: Record<VocItemRecord["sourceType"], string> = {
  survey_response: "サーベイ",
  meeting_log: "面談",
  weekly_review: "週次"
};

type Filter = VocStatus | "all";

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
  const [filter, setFilter] = useState<Filter>("new");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const companyById = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies]
  );
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const filtered = useMemo(() => {
    return items.filter((v) => {
      if (filter !== "all" && v.status !== filter) return false;
      if (tagFilter && !v.tags.includes(tagFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        const co = v.companyId ? companyById.get(v.companyId)?.name ?? "" : "";
        const hay = [v.excerpt, v.id, co].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, filter, tagFilter, search, companyById]);

  const statusCounts = useMemo(() => {
    const c: Record<Filter, number> = {
      new: 0,
      triaged: 0,
      backlog: 0,
      shipped: 0,
      wontfix: 0,
      all: items.length
    };
    for (const v of items) c[v.status]++;
    return c;
  }, [items]);

  async function reload() {
    const list = await vocItemRepo.list();
    setItems(list);
  }
  async function changeStatus(id: string, status: VocStatus) {
    const me = await userRepo.getCurrent();
    await vocItemRepo.setStatus(id, { status, actorUserId: me?.id });
    reload();
  }
  async function changePriority(id: string, priority: VocPriority) {
    await vocItemRepo.setPriority(id, priority);
    reload();
  }
  async function changeAssignee(id: string, userId: string) {
    await vocItemRepo.setAssignedTo(id, userId || undefined);
    reload();
  }
  async function addComment(id: string, body: string) {
    if (!body.trim()) return;
    const me = await userRepo.getCurrent();
    if (!me) return;
    await vocItemRepo.appendComment(id, { authorUserId: me.id, body: body.trim() });
    reload();
  }

  return (
    <div className="space-y-4">
      {/* フィルタタブ + 検索 + エクスポート */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "new", "triaged", "backlog", "shipped", "wontfix"] as Filter[]).map((s) => {
          const active = filter === s;
          const count = s === "all" ? items.length : statusCounts[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={[
                "px-3 py-1.5 rounded-pill text-caption transition focus-ring",
                active
                  ? "bg-neutral-900 text-surface"
                  : "bg-surface border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
              ].join(" ")}
            >
              {s === "all" ? "すべて" : STATUSES.find((x) => x.key === s)?.label}{" "}
              <span className="tabular-nums">{count}</span>
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
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
          <button
            type="button"
            onClick={() => exportCsv(filtered)}
            className="px-3 py-1.5 rounded-pill bg-surface border border-neutral-300 text-caption text-neutral-700 hover:bg-neutral-50 focus-ring"
          >
            CSV エクスポート ({filtered.length})
          </button>
        </div>
      </div>

      {/* リスト */}
      {filtered.length === 0 ? (
        <div className="surface p-6 text-center text-body text-neutral-500">
          該当する VOC はありません
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((v) => {
            const co = v.companyId ? companyById.get(v.companyId) : null;
            return (
              <li
                key={v.id}
                id={v.id}
                className="surface p-4 space-y-2"
              >
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-pill border text-caption font-medium ${PRIORITY_BADGE[v.priority]}`}
                    >
                      {v.priority.toUpperCase()}
                    </span>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-pill border text-caption ${STATUS_BADGE[v.status]}`}
                    >
                      {STATUSES.find((s) => s.key === v.status)?.label ?? v.status}
                    </span>
                    {co && (
                      <Link
                        href={`/companies/${co.id}`}
                        className="text-body font-medium text-neutral-900 hover:underline focus-ring rounded-sm"
                      >
                        {co.name}
                      </Link>
                    )}
                    <span className="text-caption text-neutral-500">
                      {SOURCE_LABEL[v.sourceType]}
                    </span>
                  </div>
                  <span className="text-caption text-neutral-500 tabular-nums">
                    {v.createdAt.slice(0, 10)}
                    {v.notifiedAt && (
                      <span className="ml-2 text-success-700">✓ Slack通知済</span>
                    )}
                  </span>
                </div>

                <p className="text-body text-neutral-900 whitespace-pre-wrap">
                  {v.excerpt}
                </p>

                <div className="flex items-baseline flex-wrap gap-1.5">
                  {v.tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex px-2 py-0.5 rounded-pill border border-neutral-300 bg-neutral-50 text-caption text-neutral-700"
                    >
                      {VOC_TAG_LABEL[t as VocTag] ?? t}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <select
                    value={v.status}
                    onChange={(e) => changeStatus(v.id, e.target.value as VocStatus)}
                    className="px-2 py-1 rounded-md border border-borderc text-caption bg-surface focus-ring"
                    aria-label="ステータス変更"
                  >
                    {STATUSES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={v.priority}
                    onChange={(e) => changePriority(v.id, e.target.value as VocPriority)}
                    className="px-2 py-1 rounded-md border border-borderc text-caption bg-surface focus-ring"
                    aria-label="優先度変更"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        priority: {p}
                      </option>
                    ))}
                  </select>
                  <select
                    value={v.assignedTo ?? ""}
                    onChange={(e) => changeAssignee(v.id, e.target.value)}
                    className="px-2 py-1 rounded-md border border-borderc text-caption bg-surface focus-ring"
                    aria-label="担当者変更"
                  >
                    <option value="">担当: 未割当</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        担当: {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* コメント */}
                <details className="pt-1">
                  <summary className="text-caption text-neutral-500 cursor-pointer focus-ring rounded-sm">
                    コメント ({v.comments.length})
                  </summary>
                  <ul className="mt-2 space-y-1.5">
                    {v.comments.map((c) => {
                      const author = userById.get(c.authorUserId);
                      return (
                        <li key={c.id} className="text-caption text-neutral-700 border-l-2 border-neutral-100 pl-2">
                          <span className="font-medium">{author?.name ?? c.authorUserId}</span>
                          <span className="text-neutral-400 ml-2">
                            {c.createdAt.slice(0, 10)}
                          </span>
                          <div className="text-body text-neutral-900 whitespace-pre-wrap">
                            {c.body}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <CommentForm onSubmit={(body) => addComment(v.id, body)} />
                </details>
              </li>
            );
          })}
        </ul>
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
