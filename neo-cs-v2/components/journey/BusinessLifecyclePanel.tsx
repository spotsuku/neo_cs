"use client";

// 事業ジャーニー lifecycleState 操作（コンパクトボタン版）
//   active / at_risk / churned / re_approach の切替
//   churned 遷移時に契約ライフサイクルスナップショットを凍結
//
// UI: ボタン1つ（現状態バッジ + ▾）→ クリックでポップオーバー展開

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BusinessLifecycleState } from "@/lib/repository/types";
import { LIFECYCLE_STATE_LABEL } from "@/lib/mock/journeys";
import { setBusinessLifecycleStateAction } from "@/app/(relationship)/companies/[id]/journey-actions";

const STATE_TONE: Record<BusinessLifecycleState, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  at_risk: "bg-amber-50 text-amber-700 border-amber-200",
  churned: "bg-rose-50 text-rose-700 border-rose-200",
  re_approach: "bg-violet-50 text-violet-700 border-violet-200"
};

const TRANSITIONS: Record<BusinessLifecycleState, BusinessLifecycleState[]> = {
  active: ["at_risk", "churned"],
  at_risk: ["active", "churned"],
  // churned からも active 復帰を許可（誤操作リカバリ）
  churned: ["active", "re_approach"],
  re_approach: ["active", "churned"]
};

export function BusinessLifecyclePanel({
  contractId,
  companyId,
  currentState
}: {
  contractId: string;
  companyId: string;
  currentState: BusinessLifecycleState;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [pickerFor, setPickerFor] = useState<BusinessLifecycleState | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 外側クリックで閉じる
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setPickerFor(null);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const apply = () => {
    if (!pickerFor) return;
    if ((pickerFor === "churned" || pickerFor === "at_risk") && !reason.trim()) {
      setError("理由を入力してください");
      return;
    }
    startTransition(async () => {
      const r = await setBusinessLifecycleStateAction({
        contractId,
        companyId,
        toState: pickerFor,
        reason: reason.trim() || undefined
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setPickerFor(null);
      setOpen(false);
      setReason("");
      router.refresh();
    });
  };

  const allowed = TRANSITIONS[currentState];

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          "inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border font-semibold hover:opacity-80 shadow-xs",
          STATE_TONE[currentState]
        ].join(" ")}
        title="契約状態を変更"
      >
        <span>契約状態:</span>
        <span>{LIFECYCLE_STATE_LABEL[currentState]}</span>
        <span className="ml-0.5 opacity-60">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-64 rounded-lg border border-ink-200 bg-white shadow-lg p-2">
          {!pickerFor ? (
            <>
              <div className="text-[10px] text-ink-500 px-1 mb-1">
                状態を変更
              </div>
              <div className="space-y-1">
                {allowed.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setPickerFor(s);
                      setReason("");
                      setError(null);
                    }}
                    className={[
                      "w-full text-left text-[11px] px-2 py-1.5 rounded border font-medium",
                      STATE_TONE[s],
                      "hover:opacity-80"
                    ].join(" ")}
                  >
                    → {LIFECYCLE_STATE_LABEL[s]}
                  </button>
                ))}
                {allowed.length === 0 && (
                  <div className="text-[11px] text-ink-500 px-1 py-2">
                    遷移可能な状態はありません
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="text-[11px] text-ink-700">
                <span className="font-semibold">
                  {LIFECYCLE_STATE_LABEL[currentState]}
                </span>{" "}
                →{" "}
                <span className="font-semibold">
                  {LIFECYCLE_STATE_LABEL[pickerFor]}
                </span>
              </div>
              {pickerFor === "churned" && (
                <div className="text-[10px] text-rose-600 bg-rose-50 border border-rose-100 rounded px-1.5 py-1">
                  ⚠ 解約決定により履歴が凍結されます
                </div>
              )}
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  pickerFor === "churned"
                    ? "解約理由 (必須)"
                    : pickerFor === "at_risk"
                    ? "解約検討に至った背景 (必須)"
                    : "理由 (任意)"
                }
                className="w-full text-[11px] rounded border border-ink-200 px-2 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-blue-300"
                rows={3}
              />
              {error && (
                <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded px-2 py-1">
                  {error}
                </div>
              )}
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setPickerFor(null)}
                  className="text-[11px] px-2 py-1 rounded border border-ink-200 text-ink-700 hover:bg-ink-50"
                >
                  戻る
                </button>
                <button
                  type="button"
                  onClick={apply}
                  disabled={pending}
                  className="text-[11px] px-2 py-1 rounded bg-ink-900 text-white hover:bg-ink-800 disabled:opacity-40"
                >
                  {pending ? "実行中..." : "確定"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
