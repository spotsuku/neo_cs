"use client";

// ブラウザ側 Supabase Auth セッションから「本当のユーザー」を取得する hook
//
// useCurrentUser は @/lib/repository (常に mock) 経由なので、本番では
// 環境変数の固定ユーザーを返す = 2 ブラウザで同じ ID になり presence が
// 機能しない。presence や Realtime の actor 識別はこちらを使う。

import { useEffect, useState } from "react";
import { getBrowserSupabase, isRealtimeAvailable } from "@/lib/supabase/client";

export type AuthUser = {
  id: string; // auth.users.id (uuid)
  email: string;
  name: string;
  avatarUrl?: string;
};

let cachedUser: AuthUser | null = null;
let pendingPromise: Promise<AuthUser | null> | null = null;

function deriveName(meta: Record<string, unknown> | undefined, email: string): string {
  const fullName = (meta?.full_name as string | undefined)?.trim();
  if (fullName) return fullName;
  const name = (meta?.name as string | undefined)?.trim();
  if (name) return name;
  // email の @ 前を fallback
  return email.split("@")[0] ?? "ゲスト";
}

export function useAuthUser(): {
  user: AuthUser | null;
  ready: boolean;
} {
  const [user, setUser] = useState<AuthUser | null>(cachedUser);
  const [ready, setReady] = useState<boolean>(cachedUser !== null);

  useEffect(() => {
    if (cachedUser) return;
    if (typeof window === "undefined") return;
    if (!isRealtimeAvailable()) {
      setReady(true);
      return;
    }

    if (!pendingPromise) {
      const sb = getBrowserSupabase();
      pendingPromise = sb.auth.getUser().then(({ data }) => {
        if (!data.user) return null;
        const u: AuthUser = {
          id: data.user.id,
          email: data.user.email ?? "",
          name: deriveName(
            data.user.user_metadata as Record<string, unknown> | undefined,
            data.user.email ?? ""
          ),
          avatarUrl:
            ((data.user.user_metadata as Record<string, unknown> | undefined)
              ?.avatar_url as string | undefined) ??
            ((data.user.user_metadata as Record<string, unknown> | undefined)
              ?.picture as string | undefined)
        };
        cachedUser = u;
        return u;
      });
    }

    let cancelled = false;
    pendingPromise.then((u) => {
      if (cancelled) return;
      setUser(u);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, ready };
}
