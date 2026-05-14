"use client";

// 各ユーザー行に表示する「このユーザーで表示」ボタン
// admin のみが見える前提（page.tsx 側でガード）。external は disabled。

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setImpersonation } from "@/lib/auth/actions";

export function ImpersonateButton({
  userId,
  userRole,
  userName
}: {
  userId: string;
  userRole: string;
  userName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handle = () => {
    if (userRole === "external") return;
    if (!confirm(`${userName} として表示しますか？\n（インパーソン中は監査ログに記録されます）`)) return;
    startTransition(async () => {
      await setImpersonation(userId, "/");
      router.push("/");
      router.refresh();
    });
  };

  if (userRole === "external") {
    return (
      <span
        title="external ユーザーへのインパーソンは無効化されています"
        className="text-[11px] text-ink-400"
      >
        —
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={pending}
      className="text-[11px] text-amber-700 hover:text-amber-900 disabled:text-ink-400"
    >
      {pending ? "..." : "視点で表示"}
    </button>
  );
}
