"use client";

import { useState, useTransition } from "react";
import { syncGmailNowAction } from "./actions";

export function SyncNowButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  const handle = () => {
    setResult(null);
    startTransition(async () => {
      const r = await syncGmailNowAction();
      if (r.ok) {
        setResult(
          `同期完了: ${r.inserted ?? 0} 件取り込み / ${r.skipped ?? 0} 件スキップ (既存)${r.errors && r.errors > 0 ? ` / ${r.errors} 件エラー` : ""}`
        );
      } else {
        setResult(`同期失敗: ${r.message ?? "unknown"}`);
      }
    });
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handle}
        disabled={pending}
        className="px-4 py-2 rounded-full border border-ink-100 text-sm text-ink-700 hover:bg-ink-50 disabled:opacity-50"
      >
        {pending ? "同期中…" : "今すぐ同期"}
      </button>
      {result && (
        <span className="text-xs text-ink-600 wrap-break-word">{result}</span>
      )}
    </div>
  );
}
