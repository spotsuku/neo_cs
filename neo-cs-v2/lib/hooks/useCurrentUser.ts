"use client";

// 現在のセッションユーザを取得するクライアント側フック
//
// 設計:
//   - userRepo.getCurrent() を非同期で呼ぶ (mock: 環境変数 or 古野固定)
//   - キャッシュ(モジュールスコープ)で重複fetchを抑止
//   - SSRでは null を返し、クライアントhydrate後にユーザがセットされる
//   - Supabase Auth 切替時は userRepo.getCurrent() の実装側を差し替えるだけで本フックは無変更
//
// 使い方:
//   const { user, name, ready } = useCurrentUser();
//   const author = name ?? "—";

import { useEffect, useState } from "react";
import { userRepo } from "@/lib/repository";
import type { AppUser } from "@/lib/repository";

let cached: AppUser | null = null;
let pending: Promise<AppUser | null> | null = null;

export function useCurrentUser(): {
  user: AppUser | null;
  name: string | null;
  ready: boolean;
} {
  // useState の初期値で cached を直接読み取るのでキャッシュヒット時は再setState不要
  const [user, setUser] = useState<AppUser | null>(cached);
  const [ready, setReady] = useState<boolean>(cached !== null);

  useEffect(() => {
    if (cached) return;
    if (!pending) {
      pending = userRepo.getCurrent().then((u) => {
        cached = u;
        return u;
      });
    }
    let cancelled = false;
    pending.then((u) => {
      if (cancelled) return;
      setUser(u);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, name: user?.name ?? null, ready };
}
