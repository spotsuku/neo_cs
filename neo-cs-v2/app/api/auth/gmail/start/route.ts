/**
 * /api/auth/gmail/start — Gmail OAuth フロー開始
 *
 * ログイン中のユーザが「Gmail に接続」ボタンを押した時の入口。
 * Google の同意画面に redirect する。state は CSRF 対策の random token を cookie に保存。
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/lib/integrations/gmail-oauth";
import { userRepo } from "@/lib/repository/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const me = await userRepo.getCurrent();
  if (!me?.id) {
    return NextResponse.redirect(new URL("/login", _req.url));
  }
  const state = crypto.randomUUID();
  const url = getAuthorizationUrl(state);
  const res = NextResponse.redirect(url);
  // 5分のみ有効
  res.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/"
  });
  return res;
}
