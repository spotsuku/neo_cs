// 現在のユーザーと表示モードを返す軽量エンドポイント
// クライアントコンポーネント（TopNav 等）から fetch して使う

import { NextResponse } from "next/server";
import { getPermissionContext } from "@/lib/auth/server";
import { effectiveRole } from "@/lib/auth/permissions";

export async function GET() {
  const ctx = await getPermissionContext();
  const body = {
    user: ctx.actor
      ? { id: ctx.actor.id, name: ctx.actor.name, email: ctx.actor.email, role: ctx.actor.role }
      : null,
    viewModeOverride: ctx.viewModeOverride ?? null,
    effectiveRole: effectiveRole(ctx),
    assignedProductCodes: ctx.programs.map((p) => p.productCode)
  };
  return NextResponse.json(body, {
    headers: {
      // private: ユーザー固有なので共有キャッシュ不可
      // max-age=30: 同一ユーザーの連続フェッチをブラウザでまとめる
      // stale-while-revalidate=60: 切替時の体感速度を維持
      "Cache-Control": "private, max-age=30, stale-while-revalidate=60"
    }
  });
}
