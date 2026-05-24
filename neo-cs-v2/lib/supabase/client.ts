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
  cached = createBrowserClient(url, anon, {
    realtime: { params: { eventsPerSecond: 20 } }
  });
  return cached;
}

export function isRealtimeAvailable(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
