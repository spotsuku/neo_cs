"use client";

// 削除・破棄など破壊的操作の確認ダイアログ
//
// 使い方:
//   const [open, setOpen] = useState(false);
//   <ConfirmDialog
//     open={open}
//     title="この項目を削除しますか?"
//     description="操作は取り消せません"
//     confirmLabel="削除"
//     tone="danger"
//     onConfirm={() => { /* delete */; setOpen(false); }}
//     onCancel={() => setOpen(false)}
//   />

import { useEffect, useRef } from "react";

export type ConfirmTone = "danger" | "warning" | "neutral";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "OK",
  cancelLabel = "キャンセル",
  tone = "neutral",
  onConfirm,
  onCancel
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // ESC キーでキャンセル
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  // open時に確認ボタンへフォーカス (誤タップ抑止のため強調側に飛ばさない選択肢もあるが、
  // a11y的には初期フォーカス必須)
  useEffect(() => {
    if (open) confirmBtnRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const confirmCls =
    tone === "danger"
      ? "bg-rose-600 hover:bg-rose-700 text-white"
      : tone === "warning"
      ? "bg-amber-600 hover:bg-amber-700 text-white"
      : "bg-ink-900 hover:bg-ink-700 text-white";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <button
        type="button"
        aria-label="ダイアログを閉じる"
        onClick={onCancel}
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm cursor-default"
      />
      <div
        ref={dialogRef}
        className="relative bg-white rounded-2xl shadow-xl border border-ink-100 w-[min(420px,92vw)] p-6 space-y-4"
      >
        <h2 id="confirm-dialog-title" className="text-base font-semibold text-ink-900">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-ink-500 whitespace-pre-wrap">
            {description}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-full text-sm text-ink-700 border border-ink-100 hover:bg-ink-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-full text-sm font-medium ${confirmCls}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
