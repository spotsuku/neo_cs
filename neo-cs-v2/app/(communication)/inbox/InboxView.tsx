"use client";

// page.tsx (Server Component) で repo から取得 → 旧 mock 互換 shape へ adapter 変換 → 本コンポーネントに props で渡す。
// 本番 supabase は空 DB のため実質「データ無し」表示で動く。
import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type {
  EmailThreadStatus,
  EmailAssigneeReason,
  AiExtractionType
} from "@/lib/repository/types";
import type { Company, Contact, ContactCommunityTier } from "@/lib/mock/entities";
import type { Contract } from "@/lib/mock/contracts";
import type { ProgramTerm } from "@/lib/repository";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { useActiveMembers } from "@/lib/hooks/useActiveMembers";
import { resolveSenderEmail } from "@/lib/domain/email/email-routing";
import { addContactFromEmailAction } from "./actions";
import { ReplyEditor, type ReplySubmit } from "./ReplyEditor";
import { sendReplyAction } from "./reply-actions";

/** rich text editor から渡る HTML を簡易プレーンテキスト化 */
function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type PendingSend = {
  threadId: string;
  inReplyToMessageId: string;
  to: string[];
  cc: string[];
  subject: string;
  bodyPlain: string;
};

const TODAY = new Date().toISOString().slice(0, 10);
const FALLBACK_USER = "古野";

// adapter 後の email thread / message / extraction の shape
export type AdaptedEmailThread = {
  id: string;
  companyId: string;
  contractId?: string;
  programTermId?: string;
  subject: string;
  status: EmailThreadStatus;
  assignee: string;
  assigneeReason?: EmailAssigneeReason;
  receivedBy?: string;
  slaDeadline?: string;
  lastMessageAt: string;
  messageIds: string[];
  statusHistory: never[];
};

export type AdaptedEmailMessage = {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  cc: string[];
  sentAt: string;
  body: string;
  direction: "inbound" | "outbound";
};

export type AdaptedAiExtraction = {
  id: string;
  threadId: string;
  messageId: string;
  type: AiExtractionType;
  targetId?: string;
  suggestion: string;
  confidence: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

export type AdaptedInternalThreadComment = {
  id: string;
  threadId: string;
  authorName: string;
  body: string;
  mentions: string[];
  createdAt: string;
};

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
// 新 enum (repo) 5 種
const TYPE_LABEL: Record<AiExtractionType, string> = {
  progress_signal: "進捗シグナル",
  risk_signal: "リスク",
  churn_signal: "解約シグナル",
  expansion_signal: "拡張シグナル",
  meeting_request: "ミーティング",
  company_suggestion: "企業候補"
};
const TYPE_COLOR: Record<AiExtractionType, string> = {
  progress_signal: "#10B981",
  risk_signal: "#EF4444",
  churn_signal: "#F59E0B",
  expansion_signal: "#3D9EFF",
  meeting_request: "#8B5CF6",
  company_suggestion: "#64748B"
};

type Filter = "received" | "assigned" | "program" | "all";

const ASSIGNEE_REASON_LABEL: Record<EmailAssigneeReason, string> = {
  received: "受信者ベース",
  program: "事業ラベル経由",
  manual: "手動アサイン"
};
const ASSIGNEE_REASON_COLOR: Record<EmailAssigneeReason, string> = {
  received: "bg-emerald-50 text-emerald-700 border-emerald-200",
  program: "bg-violet-50 text-violet-700 border-violet-200",
  manual: "bg-ink-100 text-ink-700 border-ink-200"
};

function isOverdue(slaDeadline?: string): boolean {
  if (!slaDeadline) return false;
  return new Date(slaDeadline) < new Date(TODAY);
}

export function InboxView({
  threads: initialThreads,
  messages,
  extractions: initialExtractions,
  companies,
  contacts,
  contracts,
  programs,
  internalComments: initialComments,
  unassignedCount = 0
}: {
  threads: AdaptedEmailThread[];
  messages: AdaptedEmailMessage[];
  extractions: AdaptedAiExtraction[];
  companies: Company[];
  contacts: Contact[];
  contracts: Contract[];
  programs: ProgramTerm[];
  internalComments: AdaptedInternalThreadComment[];
  unassignedCount?: number;
}) {
  const params = useSearchParams();
  const queryThreadId = params?.get("threadId") ?? null;
  const { name: currentUserName } = useCurrentUser();
  const currentUser = currentUserName ?? FALLBACK_USER;
  const { names: assigneeOptions } = useActiveMembers();
  const [threads, setThreads] = useState<AdaptedEmailThread[]>(initialThreads);
  const [extractions, setExtractions] = useState<AdaptedAiExtraction[]>(initialExtractions);
  const [filter, setFilter] = useState<Filter>("received");
  const [programFilter, setProgramFilter] = useState<string>("");
  const [openOnly, setOpenOnly] = useState<boolean>(true);

  const programById = useMemo(
    () => new Map(programs.map((p) => [p.id, p])),
    [programs]
  );
  const initialSelected =
    queryThreadId && initialThreads.some((t) => t.id === queryThreadId)
      ? queryThreadId
      : initialThreads[0]?.id ?? "";
  const [selectedId, setSelectedId] = useState<string>(initialSelected);
  const [replyDraft, setReplyDraft] = useState<string | null>(null);
  // 「送信」ボタン → 確認ダイアログ用 state。null = ダイアログ非表示
  const [pendingSend, setPendingSend] = useState<PendingSend | null>(null);
  const [sending, setSending] = useState<boolean>(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [comments, setComments] = useState<AdaptedInternalThreadComment[]>(initialComments);
  const [chatInput, setChatInput] = useState<string>("");

  const companyById = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies]
  );
  const contractById = useMemo(
    () => new Map(contracts.map((c) => [c.id, c])),
    [contracts]
  );
  // メールアドレス → コンタクトの逆引き（小文字キー）
  const contactByEmail = useMemo(() => {
    const m = new Map<string, Contact>();
    for (const c of contacts) m.set(c.email.toLowerCase(), c);
    return m;
  }, [contacts]);
  const contactQuery = params?.get("contact")?.toLowerCase() ?? null;

  // threadId -> 出現する from メールの集合（コンタクト絞り込み用）
  const fromsByThread = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const m of messages) {
      const set = map.get(m.threadId) ?? new Set<string>();
      set.add(m.from.toLowerCase());
      map.set(m.threadId, set);
    }
    return map;
  }, [messages]);

  const filtered = useMemo(() => {
    let arr = [...threads];
    if (filter === "received") {
      arr = arr.filter((t) => t.receivedBy === currentUser);
    } else if (filter === "assigned") {
      arr = arr.filter((t) => t.assignee === currentUser);
    } else if (filter === "program") {
      if (programFilter === "__none__") {
        arr = arr.filter((t) => !t.programTermId);
      } else if (programFilter) {
        arr = arr.filter((t) => t.programTermId === programFilter);
      }
    }
    if (openOnly) {
      arr = arr.filter((t) => t.status === "new" || t.status === "in_progress");
    }
    if (contactQuery) {
      arr = arr.filter((t) => fromsByThread.get(t.id)?.has(contactQuery));
    }
    return arr.sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1));
  }, [threads, filter, programFilter, openOnly, contactQuery, fromsByThread, currentUser]);

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

  // タブごとのカウント（未対応のみフィルタは無視して総数を見せる方が判断しやすい）
  const counts = useMemo(() => {
    return {
      received: threads.filter((t) => t.receivedBy === currentUser).length,
      assigned: threads.filter((t) => t.assignee === currentUser).length,
      all: threads.length
    };
  }, [threads, currentUser]);

  // 自分が返信担当の未対応件数（通知バッジ相当）
  const myOpenAssigned = threads.filter(
    (t) =>
      t.assignee === currentUser &&
      (t.status === "new" || t.status === "in_progress")
  ).length;

  const updateThread = (id: string, patch: Partial<AdaptedEmailThread>) => {
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  // 状態自動遷移: 送信→waiting / 受信→in_progress 等の単純ルール
  const applyEvent = (id: string, event: "inbound" | "send" | "close") => {
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        let next: EmailThreadStatus | null = null;
        if (event === "send" && t.status !== "waiting") next = "waiting";
        else if (
          event === "inbound" &&
          t.status !== "new" &&
          t.status !== "in_progress"
        )
          next = "in_progress";
        else if (event === "close" && t.status !== "closed") next = "closed";
        if (!next) return t;
        return { ...t, status: next };
      })
    );
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
    // 簡易テンプレ (実装時は Claude API 経由の下書き生成に差し替え)
    setReplyDraft(
      [
        "お世話になっております。",
        "",
        `「${selected.subject}」の件、ご連絡ありがとうございます。`,
        "内容を確認のうえ、改めてご連絡いたします。",
        "",
        "引き続きどうぞよろしくお願いいたします。"
      ].join("\n")
    );
  };

  // 社内チャット: @メンションを単純パース（半角/全角@ + 既存メンバー名）
  const parseMentions = (body: string): string[] => {
    const found = new Set<string>();
    for (const name of assigneeOptions) {
      const re = new RegExp(`[@＠]${name}`, "g");
      if (re.test(body)) found.add(name);
    }
    return Array.from(found);
  };

  const postComment = () => {
    if (!selected) return;
    const body = chatInput.trim();
    if (!body) return;
    const c: AdaptedInternalThreadComment = {
      id: `ic-mock-${Date.now()}`,
      threadId: selected.id,
      authorName: currentUser,
      body,
      mentions: parseMentions(body),
      createdAt: new Date().toISOString()
    };
    setComments((prev) => [...prev, c]);
    setChatInput("");
  };

  const selectedComments = selected
    ? comments
        .filter((c) => c.threadId === selected.id)
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    : [];

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6 space-y-4">
      {/* ヘッダ */}
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink-900">受信箱</h1>
          <p className="text-xs text-ink-500 mt-0.5">
            メール×AIで進捗を自動抽出。CS運用の中核
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {unassignedCount > 0 && (
            <Link
              href="/inbox/unassigned"
              className="px-3 py-1.5 rounded-full border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
            >
              未割当 {unassignedCount} 件
            </Link>
          )}
          <Link
            href="/inbox/extractions"
            className="px-3 py-1.5 rounded-full bg-ink-900 text-white hover:opacity-90"
          >
            🤖 AI抽出 承認待ち {pendingCount}
          </Link>
        </div>
      </header>

      {/* コンタクト絞り込みバナー */}
      {contactQuery && (() => {
        const c = contactByEmail.get(contactQuery);
        const co = c ? companyById.get(c.companyId) : undefined;
        return (
          <div className="rounded-xl border border-brand-blue/30 bg-brand-blue/5 px-3 py-2 text-xs text-ink-700 flex items-center gap-2">
            <span>担当者で絞り込み中:</span>
            {c ? (
              <>
                <span className="font-semibold">{c.name}</span>
                {co && <span className="text-ink-500">/ {co.name}</span>}
                <span className="text-ink-400">&lt;{c.email}&gt;</span>
              </>
            ) : (
              <span className="font-mono">{contactQuery}</span>
            )}
            <Link href="/inbox" className="ml-auto text-brand-blue hover:underline">
              絞り込み解除
            </Link>
          </div>
        );
      })()}

      {/* フィルタタブ */}
      <div className="flex items-center gap-1 border-b border-ink-100 flex-wrap">
        {([
          { key: "received" as Filter, label: `自分宛 (${counts.received})` },
          { key: "assigned" as Filter, label: `自分が返信担当 (${counts.assigned})` },
          { key: "program" as Filter, label: "事業別" },
          { key: "all" as Filter, label: `すべて (${counts.all})` }
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
        <div className="ml-auto flex items-center gap-3 text-[11px]">
          {myOpenAssigned > 0 && (
            <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
              🔔 自分の未対応 {myOpenAssigned} 件
            </span>
          )}
          {overdueCount > 0 && (
            <span className="text-rose-600 font-medium">
              🔴 SLA超過 {overdueCount} 件
            </span>
          )}
          <label className="flex items-center gap-1 text-ink-500">
            <input
              type="checkbox"
              checked={openOnly}
              onChange={(e) => setOpenOnly(e.target.checked)}
            />
            未対応のみ
          </label>
        </div>
      </div>

      {/* 事業別タブ選択時のサブセレクタ */}
      {filter === "program" && (
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <button
            onClick={() => setProgramFilter("")}
            className={[
              "px-2.5 py-1 rounded-full border",
              programFilter === ""
                ? "bg-ink-900 text-white border-ink-900"
                : "bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
            ].join(" ")}
          >
            すべての事業
          </button>
          {programs.map((p) => {
            const active = programFilter === p.id;
            const count = threads.filter((t) => t.programTermId === p.id).length;
            return (
              <button
                key={p.id}
                onClick={() => setProgramFilter(p.id)}
                className={[
                  "px-2.5 py-1 rounded-full border",
                  active
                    ? "bg-ink-900 text-white border-ink-900"
                    : "bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
                ].join(" ")}
              >
                {p.label} <span className="opacity-70">({count})</span>
              </button>
            );
          })}
          <button
            onClick={() => setProgramFilter("__none__")}
            className={[
              "px-2.5 py-1 rounded-full border",
              programFilter === "__none__"
                ? "bg-ink-900 text-white border-ink-900"
                : "bg-white text-ink-500 border-dashed border-ink-200 hover:bg-ink-50"
            ].join(" ")}
          >
            未分類 ({threads.filter((t) => !t.programTermId).length})
          </button>
        </div>
      )}

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
                    <div className={["text-[10px] mt-0.5 flex items-center gap-1.5 flex-wrap", active ? "text-white/60" : "text-ink-500"].join(" ")}>
                      <span>返信担当: {t.assignee}</span>
                      {t.programTermId && (
                        <span
                          className={[
                            "px-1.5 py-0.5 rounded-full",
                            active
                              ? "bg-white/15 text-white"
                              : "bg-violet-50 text-violet-700 border border-violet-100"
                          ].join(" ")}
                        >
                          {programById.get(t.programTermId)?.label ?? t.programTermId}
                        </span>
                      )}
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
                      onChange={(e) => {
                        const to = e.target.value as EmailThreadStatus;
                        updateThread(selected.id, { status: to });
                      }}
                      className="border border-ink-100 rounded-md px-2 py-1 text-xs"
                    >
                      {(Object.keys(STATUS_LABEL) as EmailThreadStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                    <span
                      className="text-[10px] text-ink-400 cursor-help"
                      title={[
                        "自動遷移ルール:",
                        "・送信 → 返信待ち",
                        "・受信(既存) → 対応中",
                        "・新規受信 → 未対応"
                      ].join("\n")}
                    >
                      ⓘ
                    </span>
                  </label>
                  <label className="flex items-center gap-1">
                    <span className="text-ink-500">返信担当</span>
                    <select
                      value={selected.assignee}
                      onChange={(e) =>
                        updateThread(selected.id, {
                          assignee: e.target.value,
                          assigneeReason: "manual"
                        })
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
                  {selected.assigneeReason && (
                    <span
                      className={[
                        "px-1.5 py-0.5 rounded-full text-[10px] border",
                        ASSIGNEE_REASON_COLOR[selected.assigneeReason]
                      ].join(" ")}
                      title={
                        selected.receivedBy
                          ? `受信者: ${selected.receivedBy}`
                          : undefined
                      }
                    >
                      {ASSIGNEE_REASON_LABEL[selected.assigneeReason]}
                    </span>
                  )}
                  <label className="flex items-center gap-1">
                    <span className="text-ink-500">事業</span>
                    <select
                      value={selected.programTermId ?? ""}
                      onChange={(e) =>
                        updateThread(selected.id, {
                          programTermId: e.target.value || undefined
                        })
                      }
                      className="border border-ink-100 rounded-md px-2 py-1 text-xs"
                    >
                      <option value="">未分類</option>
                      {programs.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
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
                {/* statusHistory は本番には未実装のため非表示 */}
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
                      <FromLine
                        email={m.from}
                        companies={companies}
                        contacts={contacts}
                      />
                      <span>{new Date(m.sentAt).toLocaleString("ja-JP")}</span>
                    </div>
                    <div className="text-[11px] text-ink-500">
                      To: {m.to.join(", ")}
                      {m.cc.length > 0 && <span className="ml-2">Cc: {m.cc.join(", ")}</span>}
                    </div>
                    {m.direction === "inbound" && (
                      <UnregisteredSenderSuggestion
                        email={m.from}
                        companies={companies}
                        contacts={contacts}
                      />
                    )}
                    <pre className="mt-2 text-sm text-ink-900 whitespace-pre-wrap font-sans leading-relaxed">
                      {m.body}
                    </pre>
                  </li>
                ))}
              </ul>

              <div className="mt-4 space-y-2">
                {selected.assignee !== currentUser && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                    このスレッドの返信担当は <b>{selected.assignee}</b> さんです。
                    あなた（{currentUser}）も返信下書きを作成できます。
                    作成後は担当者へ共有 / 引き継ぎが可能です。
                  </div>
                )}
                {!replyDraft && (
                  <button
                    onClick={generateReply}
                    className="px-4 py-2 rounded-full bg-ink-900 text-white text-sm hover:opacity-90"
                  >
                    🤖 AI返信下書きを作成
                  </button>
                )}
                {replyDraft !== null && (() => {
                  const lastInbound = [...selectedMessages]
                    .reverse()
                    .find((m) => m.direction === "inbound");
                  const replyTo = lastInbound ? [lastInbound.from] : [];
                  // 全員返信（Reply-All）デフォルト: 元 To から自分（社内アドレス）を除外し、元 Cc とマージ
                  // 社内アドレスは @neo.example.com 固定（実装時はログインユーザーのメールで除外）
                  const SELF_PATTERN = /@neo\.example\.com$/i;
                  const replyCc = lastInbound
                    ? Array.from(
                        new Set([
                          ...lastInbound.to.filter((e) => !SELF_PATTERN.test(e)),
                          ...lastInbound.cc
                        ])
                      )
                    : [];
                  const recipientContact = lastInbound
                    ? contactByEmail.get(lastInbound.from.toLowerCase())
                    : undefined;
                  // Cc 候補: 同社の他コンタクト + 過去スレッドの cc
                  const sameCompanyContacts = selected
                    ? contacts
                        .filter((c) => c.companyId === selected.companyId)
                        .filter(
                          (c) => c.email.toLowerCase() !== lastInbound?.from.toLowerCase()
                        )
                    : [];
                  const ccSuggestions = sameCompanyContacts.map((c) => ({
                    email: c.email,
                    label: `${c.name}（${c.title ?? ""}）`
                  }));
                  const handleSubmit = (draft: ReplySubmit) => {
                    // 「送信」ボタンクリック時はまず確認ダイアログを開く
                    // (実送信は確認ダイアログの OK で呼ばれる)
                    if (!lastInbound) {
                      setSendResult("返信先のメッセージが見つかりません");
                      return;
                    }
                    const baseSubject = selected?.subject ?? "";
                    const subject = baseSubject.startsWith("Re:")
                      ? baseSubject
                      : `Re: ${baseSubject}`;
                    setSendResult(null);
                    setPendingSend({
                      threadId: selected.id,
                      inReplyToMessageId: lastInbound.id,
                      to: draft.to,
                      cc: draft.cc,
                      subject,
                      bodyPlain: htmlToPlain(draft.bodyHtml)
                    });
                  };
                  return (
                    <ReplyEditor
                      initialBody={replyDraft}
                      to={replyTo}
                      initialCc={replyCc}
                      ccSuggestions={ccSuggestions}
                      recipientDisplayName={recipientContact?.name}
                      authorName={currentUser}
                      onSubmit={handleSubmit}
                      onCancel={() => setReplyDraft(null)}
                    />
                  );
                })()}
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

              {/* 社内チャット（メールスレッド単位の社内相談） */}
              <div className="liquid-surface p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-ink-700">
                    💬 社内チャット
                  </div>
                  <span className="text-[10px] text-ink-400">
                    社内のみ・メール本文には含まれません
                  </span>
                </div>
                <ul className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {selectedComments.length === 0 && (
                    <li className="text-xs text-ink-500">
                      まだコメントがありません。@メンションで担当者に相談・引き継ぎができます。
                    </li>
                  )}
                  {selectedComments.map((c) => {
                    const mine = c.authorName === currentUser;
                    return (
                      <li
                        key={c.id}
                        className={[
                          "rounded-lg p-2 border text-xs",
                          mine
                            ? "bg-sky-50 border-sky-100"
                            : "bg-white border-ink-100"
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between text-[10px] text-ink-500 mb-1">
                          <span className="font-semibold text-ink-700">
                            {c.authorName}
                          </span>
                          <span>
                            {new Date(c.createdAt).toLocaleString("ja-JP", {
                              month: "numeric",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </span>
                        </div>
                        <div className="text-ink-900 whitespace-pre-wrap leading-relaxed">
                          {renderCommentBody(c.body, assigneeOptions)}
                        </div>
                        {c.mentions.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {c.mentions.map((m) => (
                              <span
                                key={m}
                                className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100"
                              >
                                🔔 {m} 宛
                              </span>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-2">
                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="社内メモ・@メンションで相談（例: @古野 引き継ぎお願いします）"
                    rows={2}
                    className="w-full text-xs border border-ink-100 rounded-md p-2 leading-relaxed"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        postComment();
                      }
                    }}
                  />
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[10px] text-ink-400">
                      ⌘/Ctrl + Enter で送信
                    </span>
                    <button
                      onClick={postComment}
                      disabled={!chatInput.trim()}
                      className="px-3 py-1 rounded-full bg-ink-900 text-white text-[11px] hover:opacity-90 disabled:opacity-40"
                    >
                      投稿
                    </button>
                  </div>
                </div>
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

      {pendingSend && (
        <SendConfirmDialog
          payload={pendingSend}
          pending={sending}
          errorMessage={sendResult}
          onCancel={() => {
            setPendingSend(null);
            setSendResult(null);
          }}
          onConfirm={async () => {
            setSending(true);
            setSendResult(null);
            const r = await sendReplyAction({
              inReplyToMessageId: pendingSend.inReplyToMessageId,
              body: pendingSend.bodyPlain,
              subject: pendingSend.subject,
              confirmed: true
            });
            setSending(false);
            if (r.ok) {
              applyEvent(pendingSend.threadId, "send");
              setReplyDraft(null);
              setPendingSend(null);
              setSendResult(null);
            } else {
              setSendResult(`送信失敗: ${r.reason ?? "unknown"}`);
            }
          }}
        />
      )}
    </main>
  );
}

// ─────────────────────────────────────────────
// 送信前の確認ダイアログ
//   - 「送信」ボタン押下 → 宛先・件名・本文プレビュー → OK で実送信
//   - cron / AI から呼ばれることはない (server action 側で session 必須)
// ─────────────────────────────────────────────
function SendConfirmDialog({
  payload,
  pending,
  errorMessage,
  onCancel,
  onConfirm
}: {
  payload: PendingSend;
  pending: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
        <div>
          <div className="text-base font-semibold text-ink-900">
            本当に送信しますか？
          </div>
          <div className="mt-1 text-xs text-ink-500">
            送信ボタンを押すと、あなたの Gmail から実際にメールが送信されます。
          </div>
        </div>
        <dl className="space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-ink-500">宛先</dt>
            <dd className="text-ink-900 break-all">{payload.to.join(", ")}</dd>
          </div>
          {payload.cc.length > 0 && (
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-ink-500">Cc</dt>
              <dd className="text-ink-900 break-all">{payload.cc.join(", ")}</dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-ink-500">件名</dt>
            <dd className="text-ink-900 break-all">{payload.subject}</dd>
          </div>
          <div>
            <dt className="text-ink-500 mb-1">本文プレビュー</dt>
            <dd className="text-ink-700 text-xs whitespace-pre-wrap max-h-40 overflow-y-auto bg-ink-50 rounded-lg p-2">
              {payload.bodyPlain || "(本文なし)"}
            </dd>
          </div>
        </dl>
        {errorMessage && (
          <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2">
            {errorMessage}
          </div>
        )}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="px-4 py-2 rounded-full border border-ink-100 text-sm text-ink-700 hover:bg-ink-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="px-5 py-2 rounded-full bg-ink-900 text-white text-sm hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "送信中…" : "OK・送信する"}
          </button>
        </div>
      </div>
    </div>
  );
}

// 社内チャット本文中の @メンションをハイライト表示
function renderCommentBody(body: string, members: string[]): React.ReactNode {
  if (members.length === 0) return body;
  // 名前を長い順にソートして部分一致の取りこぼしを防ぐ
  const sorted = [...members].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`[@＠](${sorted.map(escapeRegex).join("|")})`, "g");
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = pattern.exec(body)) !== null) {
    if (m.index > lastIndex) parts.push(body.slice(lastIndex, m.index));
    parts.push(
      <span
        key={key++}
        className="px-1 rounded bg-amber-100 text-amber-800 font-medium"
      >
        {m[0]}
      </span>
    );
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < body.length) parts.push(body.slice(lastIndex));
  return parts;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// メール送信元の行: コンタクトと突合できれば「会社名 / 名前 / 関与度」を表示
const COMMUNITY_TONE: Record<ContactCommunityTier, string> = {
  core:    "bg-amber-100 text-amber-900 border-amber-300",
  active:  "bg-sky-100 text-sky-800 border-sky-200",
  casual:  "bg-emerald-100 text-emerald-800 border-emerald-200",
  at_risk: "bg-rose-100 text-rose-800 border-rose-200"
};
const COMMUNITY_LABEL: Record<ContactCommunityTier, string> = {
  core: "コア",
  active: "アクティブ",
  casual: "カジュアル",
  at_risk: "離脱危機"
};

function FromLine({
  email,
  companies,
  contacts
}: {
  email: string;
  companies: Company[];
  contacts: Contact[];
}) {
  const resolution = resolveSenderEmail(email, companies, contacts);

  if (resolution.kind === "known_contact") {
    const { contact, company } = resolution;
    return (
      <span className="flex items-center gap-1.5 flex-wrap">
        {company && (
          <Link
            href={`/companies/${company.id}`}
            className="text-[10px] px-1.5 py-0.5 rounded-full bg-ink-100 text-ink-700 hover:bg-ink-200"
          >
            {company.name}
          </Link>
        )}
        <span className="font-semibold text-ink-900">{contact.name}</span>
        <span className="text-ink-500">{contact.title}</span>
        {contact.community && (
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full border ${COMMUNITY_TONE[contact.community]}`}
          >
            {COMMUNITY_LABEL[contact.community]}
          </span>
        )}
        <span className="text-[10px] text-ink-400">&lt;{email}&gt;</span>
      </span>
    );
  }

  if (resolution.kind === "domain_match") {
    // ドメインのみ一致 — 同社の未登録の送信元として表示
    return (
      <span className="flex items-center gap-1.5 flex-wrap">
        <Link
          href={`/companies/${resolution.company.id}`}
          className="text-[10px] px-1.5 py-0.5 rounded-full bg-ink-100 text-ink-700 hover:bg-ink-200"
        >
          {resolution.company.name}
        </Link>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700">
          未登録の送信元
        </span>
        <span className="font-medium text-ink-700">{email}</span>
      </span>
    );
  }

  // unknown / 社内アドレス等
  return <span className="font-medium text-ink-700">{email}</span>;
}

/**
 * 受信メールの送信元が「企業ドメインに一致するが contacts 未登録」の場合に
 * 担当者として追加するかどうかを提案するインライン UI。
 */
function UnregisteredSenderSuggestion({
  email,
  companies,
  contacts
}: {
  email: string;
  companies: Company[];
  contacts: Contact[];
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const resolution = resolveSenderEmail(email, companies, contacts);
  if (resolution.kind !== "domain_match") return null;

  const handleAdd = async () => {
    setPending(true);
    setError(null);
    const result = await addContactFromEmailAction({
      companyId: resolution.company.id,
      email
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="mt-2 rounded-md border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-700">
        ✓ {resolution.company.name} の担当者として追加しました（次回読み込みで反映）
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-amber-100 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
      <span>
        この送信元は <b>{resolution.company.name}</b> のドメイン（
        <code className="font-mono">{resolution.domain}</code>
        ）と一致しますが、担当者として未登録です。
      </span>
      <button
        type="button"
        onClick={handleAdd}
        disabled={pending}
        className="px-2 py-0.5 rounded-full bg-ink-900 text-white text-[10px] hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "追加中…" : "担当者として追加"}
      </button>
      {error && <span className="text-rose-600">{error}</span>}
    </div>
  );
}
