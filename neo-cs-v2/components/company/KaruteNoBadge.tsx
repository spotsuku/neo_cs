"use client";

// カルテNo. 表示 + インライン編集コンポーネント
// クリック → 入力モード → Enter or 保存ボタンで確定 → 重複時はエラー表示

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCompanyKaruteNoAction } from "@/app/(relationship)/companies/[id]/karute-no-actions";

export function KaruteNoBadge({
  companyId,
  karuteNo,
  editable = true
}: {
  companyId: string;
  karuteNo: number | undefined;
  editable?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(
    typeof karuteNo === "number" ? String(karuteNo) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const display =
    typeof karuteNo === "number"
      ? `カルテ No.${String(karuteNo).padStart(3, "0")}`
      : "カルテ No.未設定";

  const save = () => {
    setError(null);
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) {
      setError("1 以上の整数を入力してください");
      return;
    }
    startTransition(async () => {
      const r = await setCompanyKaruteNoAction({
        companyId,
        newNo: n
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  const cancel = () => {
    setError(null);
    setEditing(false);
    setValue(typeof karuteNo === "number" ? String(karuteNo) : "");
  };

  if (!editable) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-ink-50 text-ink-700 border border-ink-100">
        {display}
      </span>
    );
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1.5 align-middle">
        <span className="text-[11px] text-ink-500">カルテ No.</span>
        <input
          type="number"
          min={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") cancel();
          }}
          autoFocus
          disabled={pending}
          className="w-20 rounded border border-ink-200 px-1.5 py-0.5 text-[12px] focus:outline-hidden focus:ring-2 focus:ring-blue-200"
        />
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="px-2 py-0.5 text-[11px] rounded bg-ink-900 text-white disabled:opacity-50"
        >
          {pending ? "..." : "保存"}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="px-2 py-0.5 text-[11px] rounded border border-ink-200"
        >
          キャンセル
        </button>
        {error && (
          <span className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
            {error}
          </span>
        )}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="クリックして編集"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-ink-50 text-ink-700 border border-ink-100 hover:bg-ink-100 cursor-pointer"
    >
      {display}
      <span className="text-ink-400">✎</span>
    </button>
  );
}
