"use client";

// F4: Drive テンプレ資料送付履歴 手動追加モーダル
//
// 自動記録できないケース (口頭で Drive 共有リンクを案内したとき等) を
// 後から記録するためのフォーム。AddLogModal のスタイルを踏襲。

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addDriveSendLogAction,
  type AddDriveSendLogInput
} from "./drive-send-log-actions";
import type { DriveSendChannel } from "@/lib/repository/types";

const CHANNEL_OPTIONS: { value: DriveSendChannel; label: string; hint: string }[] = [
  { value: "gmail", label: "Gmail 添付", hint: "メール本文に資料を添付して送付" },
  { value: "drive_share", label: "Drive 共有リンク", hint: "Drive 共有設定でリンク共有" },
  { value: "other", label: "その他", hint: "Slack DM 等" }
];

export function AddDriveSendLogModal({
  open,
  onClose,
  companyId
}: {
  open: boolean;
  onClose: () => void;
  companyId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [driveFileName, setDriveFileName] = useState("");
  const [driveFileId, setDriveFileId] = useState("");
  const [sentToEmail, setSentToEmail] = useState("");
  const [sentVia, setSentVia] = useState<DriveSendChannel>("gmail");
  const [sentAt, setSentAt] = useState(today);
  const [note, setNote] = useState("");

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const input: AddDriveSendLogInput = {
      companyId,
      driveFileName,
      driveFileId: driveFileId || undefined,
      sentToEmail,
      sentVia,
      sentAt: sentAt || undefined,
      note: note || undefined
    };

    startTransition(async () => {
      const r = await addDriveSendLogAction(input);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setDriveFileName("");
      setDriveFileId("");
      setSentToEmail("");
      setSentVia("gmail");
      setSentAt(today);
      setNote("");
      onClose();
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/30 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-liquid-lg w-full max-w-xl p-6 space-y-4 max-h-[92vh] overflow-y-auto"
      >
        <div>
          <h2 className="text-lg font-bold text-ink-900">資料送付を記録</h2>
          <p className="text-xs text-ink-500 mt-1">
            Drive テンプレ資料を送付した履歴を残します
          </p>
        </div>

        <label className="block">
          <span className="text-[11px] text-ink-500 font-medium">
            資料名 <span className="text-rose-500">*</span>
          </span>
          <input
            type="text"
            value={driveFileName}
            onChange={(e) => setDriveFileName(e.target.value)}
            placeholder="例: 2026年度 新人研修 提案書 v2"
            className="mt-1 w-full px-2 py-1.5 text-sm rounded-lg border border-ink-200"
            autoFocus
          />
        </label>

        <label className="block">
          <span className="text-[11px] text-ink-500 font-medium">Drive file ID (任意)</span>
          <input
            type="text"
            value={driveFileId}
            onChange={(e) => setDriveFileId(e.target.value)}
            placeholder="例: 1AbCdEf... (空欄なら手動記録扱い)"
            className="mt-1 w-full px-2 py-1.5 text-sm rounded-lg border border-ink-200"
          />
        </label>

        <label className="block">
          <span className="text-[11px] text-ink-500 font-medium">
            送信先メール <span className="text-rose-500">*</span>
          </span>
          <input
            type="email"
            value={sentToEmail}
            onChange={(e) => setSentToEmail(e.target.value)}
            placeholder="example@company.co.jp"
            className="mt-1 w-full px-2 py-1.5 text-sm rounded-lg border border-ink-200"
          />
        </label>

        <div>
          <span className="text-[11px] text-ink-500 font-medium">チャネル</span>
          <div className="mt-1 flex gap-2">
            {CHANNEL_OPTIONS.map((o) => (
              <label
                key={o.value}
                className={[
                  "flex-1 cursor-pointer text-left px-3 py-2 rounded-lg border transition",
                  sentVia === o.value
                    ? "border-ink-900 bg-ink-50/60 ring-1 ring-ink-900"
                    : "border-ink-200 hover:bg-ink-50/40"
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="sent_via"
                  value={o.value}
                  checked={sentVia === o.value}
                  onChange={() => setSentVia(o.value)}
                  className="sr-only"
                />
                <div className="text-sm font-medium text-ink-900">{o.label}</div>
                <div className="text-[10px] text-ink-500 mt-0.5">{o.hint}</div>
              </label>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="text-[11px] text-ink-500 font-medium">送付日</span>
          <input
            type="date"
            value={sentAt}
            onChange={(e) => setSentAt(e.target.value)}
            className="mt-1 w-full px-2 py-1.5 text-sm rounded-lg border border-ink-200"
          />
        </label>

        <label className="block">
          <span className="text-[11px] text-ink-500 font-medium">メモ</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="補足 (どの版 / どんな依頼で送ったか 等)"
            className="mt-1 w-full px-2 py-1.5 text-sm rounded-lg border border-ink-200 leading-relaxed"
          />
        </label>

        {error && (
          <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="px-4 py-2 rounded-full text-sm text-ink-700 border border-ink-200 hover:bg-ink-50 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={pending}
            className="px-4 py-2 rounded-full text-sm bg-ink-900 text-white hover:bg-ink-800 disabled:opacity-50"
          >
            {pending ? "記録中…" : "記録する"}
          </button>
        </div>
      </form>
    </div>
  );
}
