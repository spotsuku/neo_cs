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
  suggestCompanyForThreadAction
} from "./actions";

export type UnassignedThreadRow = {
  id: string;
  subject: string;
  lastMessageAt?: string;
  direction?: "inbound" | "outbound";
  counterpart?: string; // 直近 message の from (inbound) or to[0] (outbound)
};

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

  const listId = `company-list-${thread.id}`;

  const onSuggest = () => {
    setSuggestError(null);
    setSuggestion(null);
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
            className="flex-1 rounded-md border border-ink-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-blue"
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
            {suggestPending ? "推定中…" : "AI で候補を提案"}
          </button>
        </div>
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
