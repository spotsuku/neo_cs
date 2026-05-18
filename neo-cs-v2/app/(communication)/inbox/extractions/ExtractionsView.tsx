"use client";

// page.tsx (Server Component) で repo データを adapter 変換 → 本コンポーネントへ props で渡す。
// 承認/却下ボタンは reviewExtractionAction を呼び ai_extractions.reviewed を true に更新する。
// 現フェーズでは承認と却下を区別しない (両方とも reviewed フラグを立てるだけ)。
// 区別とジャーニー/Todo 反映は次フェーズで `review_decision` カラム追加とともに実装。
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { AiExtractionType } from "@/lib/repository/types";
import type { Company } from "@/lib/mock/entities";
import { reviewExtractionAction } from "./actions";

// adapter 後の shape
export type AdaptedExtraction = {
  id: string;
  threadId: string;
  messageId: string;
  type: AiExtractionType;
  suggestion: string;
  confidence: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

export type AdaptedThread = {
  id: string;
  companyId: string;
  subject: string;
  status: string;
  assignee: string;
  lastMessageAt: string;
};

export type AdaptedMessage = {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  cc: string[];
  sentAt: string;
  body: string;
  direction: "inbound" | "outbound";
};

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

type TypeFilter = "all" | AiExtractionType;

export function ExtractionsView({
  extractions: initial,
  threads,
  messages,
  companies
}: {
  extractions: AdaptedExtraction[];
  threads: AdaptedThread[];
  messages: AdaptedMessage[];
  companies: Company[];
}) {
  const [extractions, setExtractions] = useState(initial);
  const [filter, setFilter] = useState<TypeFilter>("all");
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const threadById = useMemo(
    () => new Map(threads.map((t) => [t.id, t])),
    [threads]
  );
  const messageById = useMemo(
    () => new Map(messages.map((m) => [m.id, m])),
    [messages]
  );
  const companyById = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies]
  );

  const pending = extractions.filter((e) => e.status === "pending");
  const filtered = useMemo(() => {
    return pending.filter((e) => filter === "all" || e.type === filter);
  }, [pending, filter]);

  // 承認: markReviewed + 企業カルテ ToDo 作成 (companyId あり時)
  // 却下: markReviewed のみ。副作用なし
  const handle = (id: string, status: "approved" | "rejected") => {
    if (pendingIds.has(id)) return;
    setErrorMsg(null);
    setInfoMsg(null);
    const prevSnapshot = extractions;
    // optimistic: 即座にカードのステータスを更新 → pending から外れて一覧から消える
    setExtractions((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status } : e))
    );
    setPendingIds((s) => new Set(s).add(id));
    startTransition(async () => {
      const res = await reviewExtractionAction(id, status);
      setPendingIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
      if (!res.ok) {
        setExtractions(prevSnapshot);
        setErrorMsg(res.message);
        return;
      }
      if (res.decision === "approved") {
        setInfoMsg(
          res.taskCreated
            ? "承認しました。企業カルテに ToDo を 1 件作成しました"
            : "承認しました (対象企業未確定のため ToDo は作成されません)"
        );
      } else {
        setInfoMsg("却下しました");
      }
    });
  };

  const bulkApproveHigh = () => {
    const targets = extractions.filter(
      (e) => e.status === "pending" && e.confidence >= 0.9
    );
    if (targets.length === 0) return;
    setErrorMsg(null);
    setInfoMsg(null);
    const prevSnapshot = extractions;
    setExtractions((prev) =>
      prev.map((e) =>
        e.status === "pending" && e.confidence >= 0.9
          ? { ...e, status: "approved" }
          : e
      )
    );
    setPendingIds((s) => {
      const next = new Set(s);
      targets.forEach((t) => next.add(t.id));
      return next;
    });
    startTransition(async () => {
      const results = await Promise.all(
        targets.map((t) => reviewExtractionAction(t.id, "approved"))
      );
      setPendingIds((s) => {
        const next = new Set(s);
        targets.forEach((t) => next.delete(t.id));
        return next;
      });
      const firstError = results.find((r) => !r.ok);
      if (firstError && !firstError.ok) {
        setExtractions(prevSnapshot);
        setErrorMsg(firstError.message);
        return;
      }
      const taskCount = results.filter((r) => r.ok && r.taskCreated).length;
      setInfoMsg(
        `${targets.length} 件を承認しました (ToDo 作成: ${taskCount} 件)`
      );
    });
  };

  const counts: Record<AiExtractionType, number> = {
    progress_signal: 0,
    risk_signal: 0,
    churn_signal: 0,
    expansion_signal: 0,
    meeting_request: 0,
    company_suggestion: 0
  };
  pending.forEach((p) => {
    counts[p.type]++;
  });

  const highConfidenceCount = pending.filter((e) => e.confidence >= 0.9).length;

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-8 space-y-5">
      <div className="text-xs text-ink-500">
        <Link href="/inbox" className="hover:text-ink-700">
          受信箱
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink-700">AI抽出</span>
      </div>

      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink-900">
            🤖 AI抽出 承認待ち
          </h1>
          <p className="text-xs text-ink-500 mt-0.5">
            メールから抽出した進捗候補を承認してCS情報に反映します（実反映はモック）
          </p>
        </div>
        <button
          onClick={bulkApproveHigh}
          disabled={highConfidenceCount === 0}
          className="px-4 py-2 rounded-full bg-emerald-500 text-white text-sm hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          確信度0.9以上を一括承認 ({highConfidenceCount})
        </button>
      </header>

      <div className="flex items-center gap-1 border-b border-ink-100">
        {(
          [
            { key: "all" as TypeFilter, label: `すべて (${pending.length})` },
            ...(Object.keys(TYPE_LABEL) as AiExtractionType[]).map((t) => ({
              key: t,
              label: `${TYPE_LABEL[t]} (${counts[t]})`
            }))
          ]
        ).map((f) => {
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
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          {errorMsg}
        </div>
      )}
      {infoMsg && !errorMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-700">
          {infoMsg}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="liquid-surface p-12 text-center text-sm text-ink-500">
          承認待ちの抽出はありません
        </div>
      )}

      <ul className="space-y-3">
        {filtered.map((ex) => {
          const t = threadById.get(ex.threadId);
          const m = messageById.get(ex.messageId);
          const co = t ? companyById.get(t.companyId) : null;
          return (
            <li key={ex.id} className="liquid-surface p-5">
              <div className="flex items-start gap-4">
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5"
                  style={{
                    color: TYPE_COLOR[ex.type],
                    background: `${TYPE_COLOR[ex.type]}14`,
                    border: `1px solid ${TYPE_COLOR[ex.type]}33`
                  }}
                >
                  {TYPE_LABEL[ex.type]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-ink-500">
                    {co && (
                      <Link
                        href={`/companies/${co.id}`}
                        className="font-medium text-ink-900 hover:underline"
                      >
                        {co.name}
                      </Link>
                    )}
                    {t && (
                      <span className="text-ink-500">/ {t.subject}</span>
                    )}
                    <span className="ml-auto text-[10px]">
                      {new Date(ex.createdAt).toLocaleString("ja-JP")}
                    </span>
                  </div>

                  <div className="mt-2 text-sm font-medium text-ink-900">
                    {ex.suggestion}
                  </div>

                  {m && (
                    <div className="mt-2 rounded-lg bg-ink-50 border border-ink-100 p-2.5 text-[11px] text-ink-700 leading-relaxed line-clamp-3">
                      <span className="text-ink-500 mr-2">元メール:</span>
                      {m.body.slice(0, 200)}
                      {m.body.length > 200 && "…"}
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-ink-500">
                      確信度{" "}
                      <span
                        className={[
                          "font-semibold",
                          ex.confidence >= 0.9
                            ? "text-emerald-600"
                            : ex.confidence >= 0.75
                            ? "text-ink-900"
                            : "text-amber-600"
                        ].join(" ")}
                      >
                        {Math.round(ex.confidence * 100)}%
                      </span>
                    </span>
                    <button
                      onClick={() => handle(ex.id, "approved")}
                      disabled={pendingIds.has(ex.id)}
                      className="ml-auto px-3 py-1.5 rounded-full bg-emerald-500 text-white text-xs hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      承認
                    </button>
                    <button
                      onClick={() => handle(ex.id, "rejected")}
                      disabled={pendingIds.has(ex.id)}
                      className="px-3 py-1.5 rounded-full bg-white border border-ink-100 text-xs text-ink-700 hover:bg-ink-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      却下
                    </button>
                    {t && (
                      <Link
                        href={`/inbox?threadId=${t.id}`}
                        className="px-3 py-1.5 rounded-full bg-white border border-ink-100 text-xs text-ink-700 hover:bg-ink-50"
                      >
                        メールを見る →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
