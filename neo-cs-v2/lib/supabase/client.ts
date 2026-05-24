"use client";

// Browser 側 Supabase クライアント (Realtime / Presence 用)
//
// SSR 用の lib/supabase/server.ts と分離。クライアントバンドルに乗っても
// 安全なように anon key + cookie 経由 session のみ使う。
// シングルトンで管理し、複数 hook が同じ接続を共有する。

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定です"
    );
  }
  const client = createBrowserClient(url, anon, {
    realtime: { params: { eventsPerSecond: 20 } }
  });

  // Realtime の RLS チェックはチャネル接続時の JWT で判定される。
  // cookie 由来の session が読み終わってから realtime.setAuth(access_token)
  // しないと anon 接続のまま subscribe され、authenticated 専用ポリシー
  // (例: weekly_reviews_select) で event がブロックされる。
  void client.auth.getSession().then(({ data }) => {
    if (data.session?.access_token) {
      client.realtime.setAuth(data.session.access_token);
    }
  });
  client.auth.onAuthStateChange((_event, session) => {
    if (session?.access_token) {
      client.realtime.setAuth(session.access_token);
    }
  });

  cached = client;
  return cached;
}

export function isRealtimeAvailable(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
