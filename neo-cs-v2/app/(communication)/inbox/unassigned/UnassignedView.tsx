"use client";

// 未割当スレッド一覧 (F3) クライアント描画
//
// 各行に「企業選択 (datalist) + 保存」ボタン。保存時に Server Action 呼び出し
// → router.refresh() で再フェッチ。
// 既存パターン (companies/[id]/AddDriveSendLogModal.tsx) に倣って軽量実装。

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  assignThreadCompanyAction,
  suggestCompanyForThreadAction,
  reviewCompanySuggestionAction
} from "./actions";

export type PrecomputedSuggestion = {
  extractionId: string;
  companyId: string;
  companyName: string;
  confidence: number;
  reasoning: string;
  createdAt: string;
};

export type UnassignedThreadRow = {
  id: string;
  subject: string;
  lastMessageAt?: string;
  direction?: "inbound" | "outbound";
  counterpart?: string; // 直近 message の from (inbound) or to[0] (outbound)
  /** cron が事前計算した AI 企業候補 (候補企業がアーカイブ済みなら undefined) */
  precomputedSuggestion?: PrecomputedSuggestion;
};

// 「2時間前」「3日前」表記の軽い relative time
function relativeTime(iso: string, nowMs: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diffMin = Math.max(0, Math.floor((nowMs - t) / 60000));
  if (diffMin < 1) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}時間前`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}日前`;
}

const STALE_HOURS = 72; // これ以上経過した事前候補は「古い」として再提案を推す

export function UnassignedView({
  threads,
  companies
}: {
  threads: UnassignedThreadRow[];
  companies: Array<{ id: string; name: string }>;
}) {
  if (threads.length === 0) {
    return (
      <div className="rounded-xl border border-ink-100 bg-white p-8 text-center text-sm text-ink-500">
        未割当のスレッドはありません。
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-ink-100 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-ink-50 text-left text-xs text-ink-600">
          <tr>
            <th className="px-3 py-2 font-medium">件名</th>
            <th className="px-3 py-2 font-medium">最終活動</th>
            <th className="px-3 py-2 font-medium">向き</th>
            <th className="px-3 py-2 font-medium">相手</th>
            <th className="px-3 py-2 font-medium w-[340px]">企業をアサイン</th>
          </tr>
        </thead>
        <tbody>
          {threads.map((t) => (
            <ThreadRow key={t.id} thread={t} companies={companies} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ThreadRow({
  thread,
  companies
}: {
  thread: UnassignedThreadRow;
  companies: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [suggestPending, startSuggestTransition] = useTransition();
  const [suggestion, setSuggestion] = useState<
    | null
    | {
        companyId: string | null;
        companyName?: string;
        confidence: number;
        reasoning: string;
      }
  >(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  // 事前計算済み候補の処理状態
  const [precomputed, setPrecomputed] = useState<PrecomputedSuggestion | undefined>(
    thread.precomputedSuggestion
  );
  const [precomputedPending, startPrecomputedTransition] = useTransition();
  const [precomputedError, setPrecomputedError] = useState<string | null>(null);

  const listId = `company-list-${thread.id}`;

  const onReviewPrecomputed = (decision: "approved" | "rejected") => {
    if (!precomputed) return;
    setPrecomputedError(null);
    startPrecomputedTransition(async () => {
      const res = await reviewCompanySuggestionAction(
        precomputed.extractionId,
        decision
      );
      if (!res.ok) {
        setPrecomputedError(res.message);
        return;
      }
      if (res.decision === "approved") {
        // 採用 → スレッドが unassigned 一覧から消える
        router.refresh();
      } else {
        // 却下 → バナーだけ非表示にして on-demand などの他経路で進められる状態に
        setPrecomputed(undefined);
      }
    });
  };

  const onSuggest = () => {
    setSuggestError(null);
    setSuggestion(null);
    // on-demand 候補を出すときは事前候補を隠して重複表示を避ける
    setPrecomputed(undefined);
    startSuggestTransition(async () => {
      const res = await suggestCompanyForThreadAction(thread.id);
      if (res.ok) {
        setSuggestion(res.suggestion);
      } else {
        setSuggestError(res.message);
      }
    });
  };

  const onAdoptSuggestion = (companyId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await assignThreadCompanyAction(thread.id, companyId);
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.message);
      }
    });
  };

  const onSave = () => {
    setError(null);
    // datalist は name → id 解決が必要 (input 値は表示名)
    const match = companies.find((c) => c.name === selected || c.id === selected);
    if (!match) {
      setError("企業を選んでください");
      return;
    }
    startTransition(async () => {
      const res = await assignThreadCompanyAction(thread.id, match.id);
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.message);
      }
    });
  };

  return (
    <tr className="border-t border-ink-100 align-top">
      <td className="px-3 py-2">
        <Link
          href={`/inbox?threadId=${encodeURIComponent(thread.id)}`}
          className="text-ink-900 hover:underline"
        >
          {thread.subject || "(件名なし)"}
        </Link>
      </td>
      <td className="px-3 py-2 text-xs text-ink-500 whitespace-nowrap">
        {thread.lastMessageAt
          ? new Date(thread.lastMessageAt).toLocaleString("ja-JP")
          : "—"}
      </td>
      <td className="px-3 py-2 text-xs">
        {thread.direction === "inbound" ? (
          <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5">
            受信
          </span>
        ) : thread.direction === "outbound" ? (
          <span className="rounded-full bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5">
            送信
          </span>
        ) : (
          <span className="text-ink-400">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-ink-700 font-mono break-all">
        {thread.counterpart ?? "—"}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <input
            list={listId}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            placeholder="企業名で検索…"
            className="flex-1 rounded-md border border-ink-200 px-2 py-1 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-blue"
            disabled={pending}
          />
          <datalist id={listId}>
            {companies.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={onSave}
            disabled={pending || !selected}
            className="rounded-md bg-ink-900 px-3 py-1 text-xs text-white hover:opacity-90 disabled:opacity-40"
          >
            {pending ? "保存中…" : "保存"}
          </button>
          <button
            type="button"
            onClick={onSuggest}
            disabled={suggestPending || pending}
            className="rounded-md border border-ink-300 px-2 py-1 text-xs text-ink-700 hover:bg-ink-50 disabled:opacity-40 whitespace-nowrap"
            title="件名・本文から AI が企業を推定します"
          >
            {suggestPending
              ? "推定中…"
              : precomputed
              ? "別候補を提案"
              : "AI で候補を提案"}
          </button>
        </div>
        {precomputed && (
          <PrecomputedSuggestionBanner
            sg={precomputed}
            pending={precomputedPending || pending}
            error={precomputedError}
            onApprove={() => onReviewPrecomputed("approved")}
            onReject={() => onReviewPrecomputed("rejected")}
          />
        )}
        {error && (
          <p className="mt-1 text-xs text-rose-600">{error}</p>
        )}
        {suggestError && (
          <p className="mt-1 text-xs text-rose-600">AI エラー: {suggestError}</p>
        )}
        {suggestion && (
          <div className="mt-1 text-xs text-ink-700">
            {suggestion.companyId ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span>
                  AI 候補:{" "}
                  <span className="font-medium text-ink-900">
                    {suggestion.companyName ?? suggestion.companyId}
                  </span>{" "}
                  <span className="text-ink-500">
                    (信頼度 {suggestion.confidence.toFixed(2)})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onAdoptSuggestion(suggestion.companyId!)}
                  disabled={pending}
                  className="rounded-md bg-brand-blue px-2 py-0.5 text-xs text-white hover:opacity-90 disabled:opacity-40"
                >
                  {pending ? "適用中…" : "採用"}
                </button>
                {suggestion.reasoning && (
                  <span className="text-ink-500">— {suggestion.reasoning}</span>
                )}
              </div>
            ) : (
              <span className="text-ink-500">
                候補が見つかりませんでした ({suggestion.reasoning})
              </span>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

function PrecomputedSuggestionBanner({
  sg,
  pending,
  error,
  onApprove,
  onReject
}: {
  sg: PrecomputedSuggestion;
  pending: boolean;
  error: string | null;
  onApprove: () => void;
  onReject: () => void;
}) {
  const ageHours = Math.floor(
    (Date.now() - new Date(sg.createdAt).getTime()) / 3600000
  );
  const stale = ageHours >= STALE_HOURS;
  return (
    <div className="mt-1.5 rounded-md border border-amber-200 bg-amber-50/50 px-2.5 py-1.5 text-xs">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-amber-700">🤖 AI 事前候補:</span>
        <span className="font-medium text-ink-900">{sg.companyName}</span>
        <span className="text-ink-500">
          (信頼度 {sg.confidence.toFixed(2)} ・ {relativeTime(sg.createdAt)})
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onApprove}
            disabled={pending}
            className="rounded-md bg-emerald-600 px-2 py-0.5 text-xs text-white hover:opacity-90 disabled:opacity-40"
          >
            {pending ? "処理中…" : "採用"}
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={pending}
            className="rounded-md border border-ink-200 px-2 py-0.5 text-xs text-ink-700 hover:bg-ink-50 disabled:opacity-40"
          >
            却下
          </button>
        </div>
      </div>
      {sg.reasoning && (
        <div className="mt-1 text-[11px] text-ink-600">— {sg.reasoning}</div>
      )}
      {stale && (
        <div className="mt-1 text-[11px] text-amber-700">
          生成から {ageHours} 時間経過しています。最新の状態と異なる可能性があるため
          「別候補を提案」も検討してください。
        </div>
      )}
      {error && <div className="mt-1 text-[11px] text-rose-600">{error}</div>}
    </div>
  );
}
