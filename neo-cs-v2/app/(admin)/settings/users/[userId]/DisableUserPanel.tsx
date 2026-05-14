"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { setUserActiveAction } from "./actions";

interface Props {
  userId: string;
  userName: string;
  userEmail: string;
  isActive: boolean;
  isSelf: boolean;
  canManage: boolean; // caller が admin か
}

export function DisableUserPanel({ userId, userName, userEmail, isActive, isSelf, canManage }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [active, setActive] = useState(isActive);

  if (!canManage) {
    return (
      <div className="text-caption text-neutral-500">
        無効化操作は admin ロールのみ実行できます。
      </div>
    );
  }

  function submit(next: boolean) {
    setMessage(null);
    start(async () => {
      const res = await setUserActiveAction(userId, next, reason.trim() || undefined);
      setMessage({ ok: res.ok, text: res.message });
      if (res.ok) setActive(next);
      setOpen(false);
      setReason("");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-body font-medium text-neutral-900">
            アカウント状態:{" "}
            <span
              className={
                active
                  ? "text-success-700 bg-success-50 border border-success-100 rounded-pill px-2 py-0.5 text-caption ml-1"
                  : "text-danger-700 bg-danger-50 border border-danger-100 rounded-pill px-2 py-0.5 text-caption ml-1"
              }
            >
              {active ? "有効" : "無効"}
            </span>
          </div>
          <div className="text-caption text-neutral-500 mt-1">
            無効化すると {userName} ({userEmail}) は全ての画面・APIに即時アクセス不可になります。
          </div>
        </div>
        {active ? (
          <button
            type="button"
            disabled={pending || isSelf}
            onClick={() => setOpen(true)}
            className="px-4 py-2 rounded-lg text-body font-medium border border-danger-200 text-danger-700 bg-danger-50 hover:bg-danger-100 disabled:opacity-50 focus-ring"
          >
            無効化する
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => submit(true)}
            className="px-4 py-2 rounded-lg text-body font-medium border border-info-200 text-info-700 bg-info-50 hover:bg-info-100 disabled:opacity-50 focus-ring"
          >
            再有効化
          </button>
        )}
      </div>

      {isSelf && active && (
        <div className="text-caption text-warning-700 bg-warning-50 border border-warning-100 rounded-md px-3 py-2">
          自分自身を無効化することはできません (誤操作で全アクセス断を防ぐため)。
        </div>
      )}

      {message && (
        <div
          role="status"
          className={`text-caption rounded-md px-3 py-2 ${
            message.ok
              ? "bg-success-50 text-success-700 border border-success-100"
              : "bg-danger-50 text-danger-700 border border-danger-100"
          }`}
        >
          {message.text}
        </div>
      )}

      <ConfirmDialog
        open={open}
        title={`${userName} を無効化しますか?`}
        description="無効化後は本人がログインできず、全リソースのアクセスを失います。担当顧客の引継ぎが完了していることを必ず確認してください。"
        confirmLabel="無効化する"
        cancelLabel="キャンセル"
        tone="danger"
        onCancel={() => setOpen(false)}
        onConfirm={() => submit(false)}
      />

      <div>
        <label className="text-caption text-neutral-500 block mb-1" htmlFor={`reason-${userId}`}>
          理由 (audit_logs に記録、推奨)
        </label>
        <input
          id={`reason-${userId}`}
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="例: 退職 (2026-05-31)"
          className="w-full rounded-md border border-neutral-200 px-3 py-2 text-body focus:border-info-300 focus-ring"
        />
      </div>
    </div>
  );
}
