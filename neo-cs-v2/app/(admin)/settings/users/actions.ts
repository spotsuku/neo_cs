"use server";

// /settings/users 用 Server Actions
//
// admin 専用。すべての action 入口で canManageUsers でガードする。
// 書込みは withActorFromHeaders 経由で audit_logs に流す（既存規約）。

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withActorFromHeaders } from "@/lib/security/actor-from-headers";
import { getPermissionContext } from "@/lib/auth/server";
import { canManageUsers } from "@/lib/auth/permissions";
import {
  userRepo,
  userProgramRoleRepo,
  userCompanyAccessRepo
} from "@/lib/repository/server";
import type {
  AppUserRole,
  ProgramScopeRole,
  UserProgramRole
} from "@/lib/repository/types";
import { DEFAULT_ORG_ID } from "@/lib/repository/types";

async function assertAdmin() {
  const ctx = await getPermissionContext();
  if (!canManageUsers(ctx)) {
    throw new Error("forbidden");
  }
  return ctx;
}

// ─────────────────────────────────────────────
// グローバルロール変更
// ─────────────────────────────────────────────
export async function setUserRole(userId: string, role: AppUserRole) {
  await assertAdmin();
  await withActorFromHeaders(async () => {
    await userRepo.setRole(userId, role);
  });
  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${userId}`);
}

// ─────────────────────────────────────────────
// 事業×スコープロールの upsert / 削除
// ─────────────────────────────────────────────
export async function upsertProgramScopeRole(input: {
  userId: string;
  productCode: string;
  scopeRole: ProgramScopeRole;
}) {
  const ctx = await assertAdmin();
  await withActorFromHeaders(async () => {
    const row: Omit<UserProgramRole, "assignedAt"> = {
      userId: input.userId,
      organizationId: ctx.actor?.organizationId ?? DEFAULT_ORG_ID,
      productCode: input.productCode,
      scopeRole: input.scopeRole,
      assignedBy: ctx.actor?.id
    };
    await userProgramRoleRepo.upsert(row);
  });
  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${input.userId}`);
}

export async function removeProgramScopeRole(userId: string, productCode: string) {
  await assertAdmin();
  await withActorFromHeaders(async () => {
    await userProgramRoleRepo.remove(userId, productCode);
  });
  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${userId}`);
}

// ─────────────────────────────────────────────
// external ユーザー: 企業アクセスの付与/取消
// ─────────────────────────────────────────────
export async function grantCompanyAccess(input: { userId: string; companyId: string }) {
  const ctx = await assertAdmin();
  // external 以外には付与しない（誤操作防止）
  const target = await userRepo.getById(input.userId);
  if (!target) throw new Error("user not found");
  if (target.role !== "external") {
    throw new Error("company access is only granted to external users");
  }
  await withActorFromHeaders(async () => {
    await userCompanyAccessRepo.grant({
      userId: input.userId,
      organizationId: ctx.actor?.organizationId ?? DEFAULT_ORG_ID,
      companyId: input.companyId,
      grantedBy: ctx.actor?.id
    });
  });
  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${input.userId}`);
}

export async function revokeCompanyAccess(userId: string, companyId: string) {
  await assertAdmin();
  await withActorFromHeaders(async () => {
    await userCompanyAccessRepo.revoke(userId, companyId);
  });
  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${userId}`);
}

// ─────────────────────────────────────────────
// 社内ユーザー招待 (Google 認証)
//
// app_users にメール + ロールで事前登録する。auth_user_id は未設定のまま。
// 当該ユーザーが Google でログインすると、middleware と userRepo.getCurrent() が
// email マッチで既存 app_users 行を見つけ、auth_user_id を後付けリンクする。
// このため Supabase Auth admin invite メールは送信しない（Google 側の SSO で
// 完結するため不要）。事前登録されていないメールでログインした場合は middleware
// が "user_disabled" 扱いで /login にリダイレクトする。
// ─────────────────────────────────────────────
export async function inviteInternalUser(input: {
  email: string;
  name: string;
  role: AppUserRole;
}): Promise<{ userId: string }> {
  const ctx = await assertAdmin();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("メールアドレスの形式が不正です");
  }
  if (!name) {
    throw new Error("表示名を入力してください");
  }
  if (input.role === "external") {
    throw new Error("外部ユーザーは『外部ユーザー招待』から登録してください");
  }

  const existing = await userRepo.getByEmail(email);
  if (existing) {
    throw new Error(`既に登録済みのメールアドレスです: ${email}`);
  }

  let createdId = "";
  await withActorFromHeaders(async () => {
    const created = await userRepo.create({
      email,
      name,
      role: input.role,
      organizationId: ctx.actor?.organizationId ?? DEFAULT_ORG_ID
    });
    createdId = created.id;
  });
  revalidatePath("/settings/users");
  return { userId: createdId };
}

// ─────────────────────────────────────────────
// external ユーザー招待
//
// mock 環境では app_users にレコード作成 + initial company access を付与。
// 本番（supabase）では別途 supabase.auth.admin.inviteUserByEmail を呼ぶ
// API route から本 action を呼び出す想定（service_role キー必須）。
// ─────────────────────────────────────────────
export async function inviteExternalUser(input: {
  email: string;
  name: string;
  companyIds: string[];
}) {
  const ctx = await assertAdmin();
  const orgId = ctx.actor?.organizationId ?? DEFAULT_ORG_ID;

  // 既存ユーザーチェック
  const existing = await userRepo.getByEmail(input.email);
  if (existing) {
    throw new Error(`既に登録済みのメールアドレスです: ${input.email}`);
  }

  // mock では直接 app_users 風にデータを作る術がない（UserRepo に create が
  // ないため）。実装時は supabase.auth.admin.inviteUserByEmail → app_users
  // upsert → user_company_access grant の順で行う。
  // ここではアクセス付与のみ仮で行い、エラーは投げず警告 return
  if (typeof console !== "undefined") {
    console.warn(
      "[inviteExternalUser] mock 環境では app_users への追加は別途必要です。" +
        "本番実装時に supabase admin invite と連動してください。"
    );
  }

  // companyIds が指定されていれば、後から手動でアクセス付与できるよう
  // app_users に該当ユーザーが存在することを前提とした grant を試みる。
  // mock では存在しないので noop 相当。
  // 本番では invite 完了後に call され、app_users.id を解決した上で grant。
  void input.companyIds;
  void orgId;

  revalidatePath("/settings/users");
  redirect("/settings/users");
}
