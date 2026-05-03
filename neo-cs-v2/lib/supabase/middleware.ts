// Supabase SSR クライアント (middleware / Server Component 共通)
//
// @supabase/ssr の createServerClient を Cookie 越しに駆動する。
// middleware.ts と Server Component の双方で同じ session 文脈を引き回せる。

import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

/**
 * middleware 用クライアント。
 * NextRequest と NextResponse を渡すと、cookie の get/set がそれらに同期される。
 */
export function getMiddlewareSupabaseClient(req: NextRequest, res: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Supabase URL / ANON KEY が未設定。middleware は REPO_DRIVER=supabase + " +
        "NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY が必要"
    );
  }

  const cookies: CookieMethodsServer = {
    getAll() {
      return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
    },
    setAll(items) {
      for (const { name, value, options } of items) {
        // request 側の cookies に反映 (downstream Server Components 用)
        req.cookies.set({ name, value, ...options });
        res.cookies.set({ name, value, ...options });
      }
    }
  };

  return createServerClient(url, anon, { cookies });
}
