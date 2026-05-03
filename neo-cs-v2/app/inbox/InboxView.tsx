"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  EmailThread,
  EmailMessage,
  AiExtraction,
  AiExtractionType,
  EmailThreadStatus,
  mockGenerateReplyDraft
} from "@/lib/mock/email";
import type { Company } from "@/lib/mock/entities";
import type { Contract } from "@/lib/mock/contracts";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { useActiveMembers } from "@/lib/hooks/useActiveMembers";

const TODAY = "2026-04-24";
const FALLBACK_USER = "古野";
const STATUS_LABEL: Record<EmailThreadStatus, string> = {
  new: "未対応",
  in_progress: "対応中",
  replied: "返信済",
  waiting: "返信待ち",
  closed: "クローズ"
};
const STATUS_BG: Record<EmailThreadStatus, string> = {
  new: "bg-rose-50 text-rose-600 border-rose-100",
  in_progress: "bg-amber-50 text-amber-700 border-amber-100",
  replied: "bg-sky-50 text-sky-700 border-sky-100",
  waiting: "bg-violet-50 text-violet-700 border-violet-100",
  closed: "bg-ink-50 text-ink-500 border-ink-100"
};
const TYPE_LABEL: Record<AiExtractionType, string> = {
  onboarding_task_done: "オンボ完了",
  stakeholder_change: "関係者変更",
  negative_signal: "ネガティブ",
  next_action: "次アクション",
  renewal_signal: "更新シグナル"
};
const TYPE_COLOR: Record<AiExtractionType, string> = {
  onboarding_task_done: "#10B981",
  stakeholder_change: "#8B5CF6",
  negative_signal: "#EF4444",
  next_action: "#3D9EFF",
  renewal_signal: "#F59E0B"
};

type Filter = "open" | "mine" | "all";

function isOverdue(slaDeadline?: string): boolean {
  if (!slaDeadline) return false;
  return new Date(slaDeadline) < new Date(TODAY);
}

export function InboxView({
  threads: initialThreads,
  messages,
  extractions: initialExtractions,
  companies,
  contracts
}: {
  threads: EmailThread[];
  messages: EmailMessage[];
  extractions: AiExtraction[];
  companies: Company[];
  contracts: Contract[];
}) {
  const params = useSearchParams();
  const queryThreadId = params?.get("threadId") ?? null;
  const { name: currentUserName } = useCurrentUser();
  const currentUser = currentUserName ?? FALLBACK_USER;
  const { names: assigneeOptions } = useActiveMembers();
  const [threads, setThreads] = useState(initialThreads);
  const [extractions, setExtractions] = useState(initialExtractions);
  const [filter, setFilter] = useState<Filter>("open");
  const initialSelected =
    queryThreadId && initialThreads.some((t) => t.id === queryThreadId)
      ? queryThreadId
      : initialThreads[0]?.id ?? "";
  const [selectedId, setSelectedId] = useState<string>(initialSelected);
  const [replyDraft, setReplyDraft] = useState<string | null>(null);

  const companyById = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies]
  );
  const contractById = useMemo(
    () => new Map(contracts.map((c) => [c.id, c])),
    [contracts]
  );

  const filtered = useMemo(() => {
    let arr = [...threads];
    if (filter === "open") {
      arr = arr.filter((t) => t.status === "new" || t.status === "in_progress");
    } else if (filter === "mine") {
      arr = arr.filter((t) => t.assignee === currentUser);
    }
    return arr.sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1));
  }, [threads, filter]);

  const selected = threads.find((t) => t.id === selectedId);
  const selectedMessages = selected
    ? messages
        .filter((m) => m.threadId === selected.id)
        .sort((a, b) => (a.sentAt < b.sentAt ? -1 : 1))
    : [];
  const selectedExtractions = selected
    ? extractions.filter((e) => e.threadId === selected.id)
    : [];
  const selectedCompany = selected ? companyById.get(selected.companyId) : null;
  const selectedContract = selected?.contractId
    ? contractById.get(selected.contractId)
    : null;

  const overdueCount = threads.filter(
    (t) =>
      isOverdue(t.slaDeadline) && (t.status === "new" || t.status === "in_progress")
  ).length;
  const pendingCount = extractions.filter((e) => e.status === "pending").length;

  const updateThread = (id: string, patch: Partial<EmailThread>) => {
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const handleExtraction = (id: string, status: "approved" | "rejected") => {
    setExtractions((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status } : e))
    );
  };

  const generateReply = () => {
    if (!selected) return;
    const last = selectedMessages[selectedMessages.length - 1];
    if (!last) return;
    setReplyDraft(mockGenerateReplyDraft(selected, last));
  };

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6 space-y-4">
      {/* ヘッダ */}
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">受信箱</h1>
          <p className="text-xs text-ink-500 mt-0.5">
            メール×AIで進捗を自動抽出。CS運用の中核
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/inbox/extractions"
            className="px-3 py-1.5 rounded-full bg-ink-900 text-white hover:opacity-90"
          >
            🤖 AI抽出 承認待ち {pendingCount}
          </Link>
        </div>
      </header>

      {/* フィルタタブ */}
      <div className="flex items-center gap-1 border-b border-ink-100">
        {([
          { key: "open" as Filter, label: `未対応 (${threads.filter((t) => t.status === "new" || t.status === "in_progress").length})` },
          { key: "mine" as Filter, label: `自分の担当 (${threads.filter((t) => t.assignee === currentUser).length})` },
          { key: "all" as Filter, label: `すべて (${threads.length})` }
        ]).map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={[
                "px-4 py-2.5 text-sm transition relative -mb-px",
                active
                  ? "text-ink-900 font-semibold border-b-2 border-ink-900"
                  : "text-ink-500 hover:text-ink-700"
              ].join(" ")}
            >
              {f.label}
            </button>
          );
        })}
        {overdueCount > 0 && (
          <span className="ml-auto text-[11px] text-rose-600 font-medium">
            🔴 SLA超過 {overdueCount} 件
          </span>
        )}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* 左ペイン: スレッド一覧 */}
        <aside className="col-span-3 liquid-surface p-2 max-h-[calc(100vh-220px)] overflow-y-auto">
          <ul className="space-y-1">
            {filtered.length === 0 && (
              <li className="text-xs text-ink-500 p-3">該当スレッドなし</li>
            )}
            {filtered.map((t) => {
              const co = companyById.get(t.companyId);
              const overdue = isOverdue(t.slaDeadline) && (t.status === "new" || t.status === "in_progress");
              const active = t.id === selectedId;
              return (
                <li key={t.id}>
                  <button
                    onClick={() => {
                      setSelectedId(t.id);
                      setReplyDraft(null);
                    }}
                    className={[
                      "w-full text-left rounded-xl px-3 py-2.5 transition border",
                      active ? "bg-ink-900 text-white border-ink-900" : "bg-white border-ink-100 hover:bg-ink-50"
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span
                        className={[
                          "px-1.5 py-0.5 rounded-full border",
                          active ? "bg-white/10 border-white/20 text-white" : STATUS_BG[t.status]
                        ].join(" ")}
                      >
                        {STATUS_LABEL[t.status]}
                      </span>
                      {overdue && (
                        <span className={["px-1.5 py-0.5 rounded-full font-medium", active ? "bg-rose-500 text-white" : "bg-rose-100 text-rose-600"].join(" ")}>
                          SLA超過
                        </span>
                      )}
                      <span className={["ml-auto", active ? "text-white/70" : "text-ink-500"].join(" ")}>
                        {t.lastMessageAt.slice(5)}
                      </span>
                    </div>
                    <div className={["mt-1 text-xs font-semibold truncate", active ? "text-white" : "text-ink-900"].join(" ")}>
                      {co?.name ?? t.companyId}
                    </div>
                    <div className={["text-xs truncate", active ? "text-white/80" : "text-ink-700"].join(" ")}>
                      {t.subject}
                    </div>
                    <div className={["text-[10px] mt-0.5", active ? "text-white/60" : "text-ink-500"].join(" ")}>
                      担当: {t.assignee}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* 中央ペイン: メッセージ履歴 */}
        <section className="col-span-6 liquid-surface p-5 max-h-[calc(100vh-220px)] overflow-y-auto">
          {!selected && (
            <div className="text-sm text-ink-500 py-12 text-center">
              スレッドを選択してください
            </div>
          )}
          {selected && (
            <>
              <div className="border-b border-ink-100 pb-3 mb-4">
                <div className="flex items-center gap-2 text-xs text-ink-500">
                  <Link href={`/companies/${selected.companyId}`} className="hover:text-ink-700 underline">
                    {selectedCompany?.name ?? selected.companyId}
                  </Link>
                  {selected.contractId && (
                    <span className="text-ink-400">/ {selected.contractId}</span>
                  )}
                </div>
                <h2 className="text-base font-bold text-ink-900 mt-1">
                  {selected.subject}
                </h2>
                <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
                  <label className="flex items-center gap-1">
                    <span className="text-ink-500">ステータス</span>
                    <select
                      value={selected.status}
                      onChange={(e) =>
                        updateThread(selected.id, {
                          status: e.target.value as EmailThreadStatus
                        })
                      }
                      className="border border-ink-100 rounded-md px-2 py-1 text-xs"
                    >
                      {(Object.keys(STATUS_LABEL) as EmailThreadStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1">
                    <span className="text-ink-500">担当</span>
                    <select
                      value={selected.assignee}
                      onChange={(e) =>
                        updateThread(selected.id, { assignee: e.target.value })
                      }
                      className="border border-ink-100 rounded-md px-2 py-1 text-xs"
                    >
                      {assigneeOptions.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selected.slaDeadline && (
                    <span
                      className={[
                        "px-2 py-0.5 rounded-full text-[11px]",
                        isOverdue(selected.slaDeadline)
                          ? "bg-rose-100 text-rose-600"
                          : "bg-ink-50 text-ink-700"
                      ].join(" ")}
                    >
                      SLA: {selected.slaDeadline}
                    </span>
                  )}
                </div>
              </div>

              <ul className="space-y-3">
                {selectedMessages.map((m) => (
                  <li
                    key={m.id}
                    className={[
                      "rounded-xl p-4 border",
                      m.direction === "inbound"
                        ? "bg-white border-ink-100"
                        : "bg-sky-50 border-sky-100 ml-8"
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-ink-500">
                      <span className="font-medium text-ink-700">{m.from}</span>
                      <span>{new Date(m.sentAt).toLocaleString("ja-JP")}</span>
                    </div>
                    <div className="text-[11px] text-ink-500">
                      To: {m.to.join(", ")}
                      {m.cc.length > 0 && <span className="ml-2">Cc: {m.cc.join(", ")}</span>}
                    </div>
                    <pre className="mt-2 text-sm text-ink-900 whitespace-pre-wrap font-sans leading-relaxed">
                      {m.body}
                    </pre>
                  </li>
                ))}
              </ul>

              <div className="mt-4">
                {!replyDraft && (
                  <button
                    onClick={generateReply}
                    className="px-4 py-2 rounded-full bg-ink-900 text-white text-sm hover:opacity-90"
                  >
                    🤖 AI返信下書きを作成
                  </button>
                )}
                {replyDraft !== null && (
                  <div className="rounded-xl border border-ink-200 p-3 bg-white">
                    <div className="text-[11px] text-ink-500 mb-2">
                      AI下書き（モック）— 編集して送信できます
                    </div>
                    <textarea
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      rows={8}
                      className="w-full text-sm border border-ink-100 rounded-md p-2 leading-relaxed"
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        className="px-3 py-1.5 rounded-full bg-ink-900 text-white text-xs hover:opacity-90"
                        onClick={() => {
                          updateThread(selected.id, { status: "replied" });
                          setReplyDraft(null);
                        }}
                      >
                        送信（モック）
                      </button>
                      <button
                        className="px-3 py-1.5 rounded-full bg-white border border-ink-100 text-xs text-ink-700 hover:bg-ink-50"
                        onClick={() => setReplyDraft(null)}
                      >
                        破棄
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* 右ペイン: AI抽出 + 関連企業情報 */}
        <aside className="col-span-3 space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto">
          {selected && (
            <>
              <div className="liquid-surface p-4">
                <div className="text-sm font-semibold text-ink-700 mb-2">
                  🤖 AI抽出 ({selectedExtractions.length})
                </div>
                {selectedExtractions.length === 0 && (
                  <div className="text-xs text-ink-500">抽出なし</div>
                )}
                <ul className="space-y-2">
                  {selectedExtractions.map((ex) => (
                    <li
                      key={ex.id}
                      className="rounded-lg border border-ink-100 p-2.5 bg-white"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{
                            color: TYPE_COLOR[ex.type],
                            background: `${TYPE_COLOR[ex.type]}14`
                          }}
                        >
                          {TYPE_LABEL[ex.type]}
                        </span>
                        <span className="text-[10px] text-ink-500">
                          確信度 {Math.round(ex.confidence * 100)}%
                        </span>
                      </div>
                      <div className="text-xs text-ink-900">{ex.suggestion}</div>
                      {ex.status === "pending" ? (
                        <div className="mt-2 flex items-center gap-1.5">
                          <button
                            onClick={() => handleExtraction(ex.id, "approved")}
                            className="flex-1 px-2 py-1 rounded-md bg-emerald-500 text-white text-[11px] hover:opacity-90"
                          >
                            承認
                          </button>
                          <button
                            onClick={() => handleExtraction(ex.id, "rejected")}
                            className="flex-1 px-2 py-1 rounded-md bg-white border border-ink-100 text-[11px] text-ink-700 hover:bg-ink-50"
                          >
                            却下
                          </button>
                        </div>
                      ) : (
                        <div className="mt-2 text-[11px] text-ink-500">
                          {ex.status === "approved" ? "✓ 承認済み" : "✗ 却下"}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {selectedCompany && (
                <div className="liquid-surface p-4">
                  <div className="text-sm font-semibold text-ink-700 mb-2">
                    関連企業
                  </div>
                  <div className="text-xs text-ink-900 font-medium">
                    {selectedCompany.name}
                  </div>
                  <div className="text-[11px] text-ink-500 mt-0.5">
                    {selectedCompany.industry} / 主担当: {selectedCompany.ownerName}
                  </div>
                  {selectedCompany.memo && (
                    <div className="mt-2 rounded-md bg-ink-50 p-2 text-[11px] text-ink-700">
                      {selectedCompany.memo}
                    </div>
                  )}
                  <Link
                    href={`/companies/${selectedCompany.id}`}
                    className="mt-2 inline-block text-[11px] text-ink-700 underline hover:text-ink-900"
                  >
                    企業カルテを見る →
                  </Link>
                  {selectedContract && (
                    <div className="mt-3 pt-3 border-t border-ink-100 text-[11px] text-ink-500">
                      <div>契約: {selectedContract.product}</div>
                      <div>開始: {selectedContract.startDate}</div>
                      <div>担当: {selectedContract.ownerName}</div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
