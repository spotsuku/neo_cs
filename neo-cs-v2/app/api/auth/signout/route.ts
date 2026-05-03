// /api/auth/signout — セッションを破棄して /login へリダイレクト
//
// 用途:
//   - TopNav の「サインアウト」リンクから POST で叩く
//   - Server Action からサインアウトしたい場合は redirect 先を変更可能

import { NextResponse, type NextRequest } from "next/server";
import { getMiddlewareSupabaseClient } from "@/lib/supabase/middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: NextRequest) {
  const dest = req.nextUrl.clone();
  dest.pathname = "/login";
  dest.search = "";
  dest.searchParams.set("reason", "signed_out");
  const res = NextResponse.redirect(dest, { status: 303 });

  try {
    const supabase = getMiddlewareSupabaseClient(req, res);
    await supabase.auth.signOut();
  } catch {
    // 設定不備等で signOut に失敗してもリダイレクトは実施する
  }

  // セッションメタも削除
  res.cookies.delete("neo-cs-session-meta");
  return res;
}

export const GET = handle;
export const POST = handle;
