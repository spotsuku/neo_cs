// 外部ユーザー招待 API
//
// 用途:
//   - admin が外部ユーザーを招待。Supabase Auth の admin invite を起動し、
//     完了後 app_users にレコードを作成、user_company_access を付与する。
//
// セキュリティ:
//   - admin のみ呼び出し可（getPermissionContext() / canManageUsers でガード）
//   - service_role キーで Supabase に直接アクセス
//   - external 以外のロール用には呼ばれてはいけない（role 固定で 'external'）
//
// フロー:
//   1) リクエスト: { email, name, companyIds }
//   2) admin チェック
//   3) supabase.auth.admin.inviteUserByEmail(email)
//      → 招待メール送信、リンクから本人がパスワード設定
//   4) 戻ってきた auth user の id を auth_user_id とする app_users 行を upsert
//   5) user_company_access を一括 grant
//
// テスト方針: dev では Supabase 接続が無いため SUPABASE_SERVICE_ROLE_KEY 未設定時は
// 503 を返す。本番投入時のみ動作する。

import { NextResponse } from "next/server";
import { getPermissionContext } from "@/lib/auth/server";
import { canManageUsers } from "@/lib/auth/permissions";
import { getServiceClient } from "@/lib/supabase/server";
import { withActorFromHeaders } from "@/lib/security/actor-from-headers";
import { userCompanyAccessRepo, contractRepo } from "@/lib/repository";
import { DEFAULT_ORG_ID } from "@/lib/repository/types";

type Body = {
  email: string;
  name: string;
  /** 企業別招待: 直接指定された企業 ID */
  companyIds?: string[];
  /** 事業別招待: 指定 productCode の active 契約に紐づく企業を自動付与 */
  productCodes?: string[];
};

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(req: Request) {
  // 認可
  const ctx = await getPermissionContext();
  if (!canManageUsers(ctx)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim();
  const directCompanyIds = Array.isArray(body.companyIds) ? body.companyIds : [];
  const productCodes = Array.isArray(body.productCodes) ? body.productCodes : [];

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }

  // 事業別招待: 指定 productCode の active 契約から company_id を解決
  const resolvedFromProducts = new Set<string>();
  if (productCodes.length > 0) {
    const allActive = await contractRepo.list({ activeOnly: true });
    for (const c of allActive) {
      if (productCodes.includes(c.product as string)) {
        resolvedFromProducts.add(c.companyId);
      }
    }
  }

  const companyIds = Array.from(
    new Set([...directCompanyIds, ...resolvedFromProducts])
  );

  if (companyIds.length === 0) {
    return NextResponse.json(
      { error: "company_ids_required", message: "企業別または事業別で1社以上の指定が必要です" },
      { status: 400 }
    );
  }

  // service_role キーが無い環境では明示的に 503
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "service_role_unavailable", message: "本番 Supabase 接続後に有効になります" },
      { status: 503 }
    );
  }

  const sb = getServiceClient();
  const orgId = ctx.actor?.organizationId ?? DEFAULT_ORG_ID;

  // 1) Supabase Auth の admin invite
  const { data: invited, error: inviteErr } = await sb.auth.admin.inviteUserByEmail(email, {
    data: { name, role: "external" }
  });
  if (inviteErr || !invited?.user) {
    return NextResponse.json(
      { error: "invite_failed", message: inviteErr?.message ?? "unknown" },
      { status: 502 }
    );
  }

  const authUserId = invited.user.id;

  // 2) app_users に upsert（既に同 email がある場合は更新）
  const { data: existing } = await sb
    .from("app_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  let appUserId: string;
  if (existing?.id) {
    appUserId = existing.id as string;
    const { error: updErr } = await sb
      .from("app_users")
      .update({
        auth_user_id: authUserId,
        name,
        role: "external",
        is_active: true,
        disabled_at: null
      })
      .eq("id", appUserId);
    if (updErr) {
      return NextResponse.json(
        { error: "app_users_update_failed", message: updErr.message },
        { status: 500 }
      );
    }
  } else {
    const { data: created, error: insErr } = await sb
      .from("app_users")
      .insert({
        organization_id: orgId,
        auth_user_id: authUserId,
        email,
        name,
        role: "external",
        is_active: true
      })
      .select("id")
      .single();
    if (insErr || !created) {
      return NextResponse.json(
        { error: "app_users_insert_failed", message: insErr?.message ?? "unknown" },
        { status: 500 }
      );
    }
    appUserId = created.id as string;
  }

  // 3) user_company_access を grant（audit に流れる）
  await withActorFromHeaders(async () => {
    for (const cid of companyIds) {
      await userCompanyAccessRepo.grant({
        userId: appUserId,
        organizationId: orgId,
        companyId: cid,
        grantedBy: ctx.actor?.id
      });
    }
  });

  return NextResponse.json({
    ok: true,
    userId: appUserId,
    authUserId,
    grantedCompanyCount: companyIds.length
  });
}
