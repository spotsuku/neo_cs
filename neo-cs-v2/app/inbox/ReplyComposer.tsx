"use client";

import { useState, useTransition } from "react";
import { sendReplyAction } from "./reply-actions";

type Props = {
  inReplyToMessageId: string;
  defaultSubject?: string;
  /** false の時はボタンを disabled にして案内 (gmail.send scope 未付与) */
  canReply: boolean;
};

export function ReplyComposer({
  inReplyToMessageId,
  defaultSubject,
  canReply
}: Props) {
  const [body, setBody] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handle = () => {
    setResult(null);
    startTransition(async () => {
      const r = await sendReplyAction({
        inReplyToMessageId,
        body,
        subject: defaultSubject
      });
      if (r.ok) {
        setResult("送信しました");
        setBody("");
      } else {
        setResult(`送信失敗: ${r.reason ?? "unknown"}`);
      }
    });
  };

  if (!canReply) {
    return (
      <div className="liquid-surface p-4 text-sm text-ink-500">
        返信機能には Gmail の送信権限が必要です。
        <a
          href="/api/auth/gmail/start"
          className="ml-2 text-ink-900 underline hover:opacity-80"
        >
          再認証して権限を追加
        </a>
      </div>
    );
  }

  return (
    <div className="liquid-surface p-4 space-y-3">
      <div className="text-sm font-semibold text-ink-900">返信を作成</div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={6}
        placeholder="返信内容を入力…"
        className="w-full px-3 py-2 rounded-xl border border-ink-100 text-sm resize-y"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-500">
          {result ?? `${body.length} 文字`}
        </span>
        <button
          type="button"
          onClick={handle}
          disabled={pending || body.trim().length === 0}
          className="px-5 py-2 rounded-full bg-ink-900 text-white text-sm hover:opacity-90 disabled:opacity-40"
        >
          {pending ? "送信中…" : "送信"}
        </button>
      </div>
    </div>
  );
}
