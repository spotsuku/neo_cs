// インパーソン中バナー
// admin が「他のユーザーとして表示」中であることを画面上部に常時表示し、解除可能にする

"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { setImpersonation } from "@/lib/auth/actions";

export function ImpersonationBanner({
  realActorName,
  effectiveActorName
}: {
  realActorName: string;
  effectiveActorName: string;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [pending, startTransition] = useTransition();

  const stop = () => {
    startTransition(async () => {
      await setImpersonation(null, pathname);
      router.refresh();
    });
  };

  return (
    <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between text-xs sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <span className="font-bold">⚠ インパーソン中</span>
        <span>
          {realActorName} → <strong>{effectiveActorName}</strong> として表示
        </span>
      </div>
      <button
        type="button"
        onClick={stop}
        disabled={pending}
        className="px-3 py-0.5 rounded-full bg-white/20 hover:bg-white/30 text-white"
      >
        {pending ? "解除中..." : "解除"}
      </button>
    </div>
  );
}
