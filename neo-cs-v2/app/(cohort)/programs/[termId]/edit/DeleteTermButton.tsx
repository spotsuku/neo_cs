"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProgramTerm } from "../../termActions";

export function DeleteTermButton({
  termId,
  termLabel
}: {
  termId: string;
  termLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteProgramTerm(termId);
        router.refresh();
        router.push("/programs");
      } catch (e) {
        console.error(e);
      }
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs px-3 py-1.5 rounded-full bg-rose-600 text-white hover:bg-rose-700"
      >
        この期を削除する
      </button>
    );
  }

  const matched = confirmText.trim() === termLabel.trim();
  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-700">
        本当に削除しますか? 確認のため、期のラベル「
        <span className="font-semibold">{termLabel}</span>
        」を入力してください
      </p>
      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={termLabel}
        className="w-full px-2 py-1.5 text-sm rounded-lg border border-ink-200"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setConfirmText("");
          }}
          disabled={pending}
          className="text-xs px-3 py-1.5 rounded-full text-ink-700 border border-ink-200 hover:bg-ink-50 disabled:opacity-50"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={!matched || pending}
          className="text-xs px-3 py-1.5 rounded-full bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "削除中…" : "削除を実行"}
        </button>
      </div>
    </div>
  );
}
