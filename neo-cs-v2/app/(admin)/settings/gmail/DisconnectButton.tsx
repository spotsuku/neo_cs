"use client";

import { useTransition } from "react";
import { disconnectGmailAction } from "./actions";

export function DisconnectButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Gmail との接続を切断しますか？")) return;
        startTransition(() => {
          void disconnectGmailAction();
        });
      }}
      className="px-4 py-2 rounded-full border border-rose-200 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50"
    >
      {pending ? "切断中…" : "切断"}
    </button>
  );
}
