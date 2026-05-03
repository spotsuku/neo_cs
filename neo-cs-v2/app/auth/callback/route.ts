// /auth/callback — Supabase Auth (Google OAuth) のコールバック処理
//
// PKCE フロー: Supabase は ?code=... を返す。これを exchangeCodeForSession に
// 渡すと httpOnly cookie にセッションが書き込まれ、以降 middleware.ts が
// 認識する。完了したら ?redirect で指定された Page にリダイレクト。

import { NextResponse, type NextRequest } from "next/server";
import { getMiddlewareSupabaseClient } from "@/lib/supabase/middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.clone();
  const code = url.searchParams.get("code");
  const redirect = url.searchParams.get("redirect") ?? "/";

  if (!code) {
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("reason", "missing_code");
    return NextResponse.redirect(url);
  }

  const safeRedirect = redirect.startsWith("/") ? redirect : "/";
  const dest = req.nextUrl.clone();
  dest.pathname = safeRedirect;
  dest.search = "";

  const res = NextResponse.redirect(dest);
  const supabase = getMiddlewareSupabaseClient(req, res);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const back = req.nextUrl.clone();
    back.pathname = "/login";
    back.search = "";
    back.searchParams.set("reason", "exchange_failed");
    return NextResponse.redirect(back);
  }

  return res;
}
