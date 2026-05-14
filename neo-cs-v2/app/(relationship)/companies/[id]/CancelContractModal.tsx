"use client";

// 契約解約モーダル: status を churned に切替 + 理由を audit に残す。
// 既存の ChurnModal は ChurnRecord を別途記録するためのもので、
// 「契約レコード自体の解約」は本モーダル経由で行う。

import { useState, useTransition } from "react";
import { cancelContractAction } from "./contract-actions";

type CancelTarget = {
  id: string;
  product: string;
  cycleNumber: number;
  startDate: string;
  endDate?: string;
};

export function CancelContractModal({
  contract,
  companyId,
  onClose
}: {
  contract: CancelTarget;
  companyId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const labelToType = `${contract.product}-${contract.cycleNumber}`;
  const matched = confirmText.trim() === labelToType;

  const onSubmit = () => {
    setError(null);
    if (!matched) {
      setError(`確認のため「${labelToType}」を入力してください`);
      return;
    }
    start(async () => {
      const r = await cancelContractAction({
        contractId: contract.id,
        companyId,
        reason: reason.trim() || undefined
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-rose-100 bg-rose-50/40">
          <h2 className="text-base font-semibold text-rose-700">契約を解約する</h2>
          <p className="mt-1 text-[11px] text-ink-700">
            ステータスを <code>churned</code> に切替えます。レコード自体は保持され、
            audit_logs に履歴が記録されます。
          </p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="text-xs text-ink-500">
            対象: <span className="text-ink-900 font-medium">{contract.product}</span> · 第
            {contract.cycleNumber}期 ({contract.startDate} 〜 {contract.endDate ?? "—"})
          </div>
          <label className="text-xs text-ink-700 block">
            解約理由 (任意・audit に保存)
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1 w-full border border-ink-200 rounded-md px-2 py-1.5 text-sm"
              placeholder="例: 予算カットによる継続見送り"
            />
          </label>
          <label className="text-xs text-ink-700 block">
            確認のため「<code className="bg-ink-100 px-1 rounded">{labelToType}</code>」と入力
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="mt-1 w-full border border-ink-200 rounded-md px-2 py-1.5 text-sm"
              placeholder={labelToType}
            />
          </label>
          {error && <div className="text-xs text-rose-600">{error}</div>}
        </div>
        <div className="px-5 py-3 border-t border-ink-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="text-xs text-ink-700 px-3 py-1.5 rounded-md border border-ink-200 hover:bg-ink-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={pending || !matched}
            className="text-xs text-white px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
          >
            {pending ? "処理中…" : "解約する"}
          </button>
        </div>
      </div>
    </div>
  );
}
