"use client";

import { useState, useTransition } from "react";
import {
  sendReplyAction,
  getReplyPreviewAction,
  type ReplyPreview
} from "./reply-actions";

type Props = {
  inReplyToMessageId: string;
  defaultSubject?: string;
  /** false の時はボタンを disabled にして案内 (gmail.send scope 未付与) */
  canReply: boolean;
};

type PendingConfirm = {
  preview: ReplyPreview;
  bodyAtConfirm: string;
};

export function ReplyComposer({
  inReplyToMessageId,
  defaultSubject,
  canReply
}: Props) {
  const [body, setBody] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmState, setConfirmState] = useState<PendingConfirm | null>(null);

  // 「送信」クリック時: まず宛先を取得して確認ダイアログを開く
  const openConfirm = () => {
    setResult(null);
    if (body.trim().length === 0) return;
    startTransition(async () => {
      const preview = await getReplyPreviewAction(inReplyToMessageId);
      if (!preview.ok) {
        setResult(`プレビュー失敗: ${preview.reason ?? "unknown"}`);
        return;
      }
      setConfirmState({ preview, bodyAtConfirm: body });
    });
  };

  // 確認ダイアログで OK
  const confirmSend = () => {
    if (!confirmState) return;
    const bodyToSend = confirmState.bodyAtConfirm;
    startTransition(async () => {
      const r = await sendReplyAction({
        inReplyToMessageId,
        body: bodyToSend,
        subject: defaultSubject,
        confirmed: true
      });
      setConfirmState(null);
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
    <>
      <div className="liquid-surface p-4 space-y-3">
        <div className="text-sm font-semibold text-ink-900">返信を作成</div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder="返信内容を入力…"
          className="w-full px-3 py-2 rounded-xl border border-ink-100 text-sm resize-y"
          disabled={pending || confirmState !== null}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-500">
            {result ?? `${body.length} 文字`}
          </span>
          <button
            type="button"
            onClick={openConfirm}
            disabled={
              pending || confirmState !== null || body.trim().length === 0
            }
            className="px-5 py-2 rounded-full bg-ink-900 text-white text-sm hover:opacity-90 disabled:opacity-40"
          >
            {pending && !confirmState ? "確認中…" : "送信"}
          </button>
        </div>
      </div>

      {confirmState && (
        <ConfirmDialog
          preview={confirmState.preview}
          body={confirmState.bodyAtConfirm}
          pending={pending}
          onCancel={() => {
            setConfirmState(null);
            setResult(null);
          }}
          onConfirm={confirmSend}
        />
      )}
    </>
  );
}

function ConfirmDialog({
  preview,
  body,
  pending,
  onCancel,
  onConfirm
}: {
  preview: ReplyPreview;
  body: string;
  pending: boolean;
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
            <dd className="text-ink-900 break-all">
              {(preview.to ?? []).join(", ")}
            </dd>
          </div>
          {preview.cc && preview.cc.length > 0 && (
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-ink-500">Cc</dt>
              <dd className="text-ink-900 break-all">{preview.cc.join(", ")}</dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-ink-500">件名</dt>
            <dd className="text-ink-900 break-all">{preview.subject}</dd>
          </div>
          <div>
            <dt className="text-ink-500 mb-1">本文プレビュー</dt>
            <dd className="text-ink-700 text-xs whitespace-pre-wrap max-h-40 overflow-y-auto bg-ink-50 rounded-lg p-2">
              {body}
            </dd>
          </div>
        </dl>

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
