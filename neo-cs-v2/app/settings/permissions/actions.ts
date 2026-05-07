"use server";

// /settings/permissions の min_role 更新 Server Action
// admin 専用 (middleware で gate 済 + canManageUsers でも二重チェック)。

import { revalidatePath } from "next/cache";
import { rolePermissionRepo } from "@/lib/repository/server";
import { getPermissionContext } from "@/lib/auth/server";
import { canManageUsers } from "@/lib/auth/permissions";
import type { AppUserRole, PermissionKey } from "@/lib/repository/types";

const VALID_KEYS: PermissionKey[] = ["contract_manage", "program_term_manage"];
const VALID_ROLES: AppUserRole[] = ["admin", "manager", "member", "viewer"];

export async function updateRolePermissionAction(input: {
  permissionKey: PermissionKey;
  minRole: AppUserRole;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const ctx = await getPermissionContext();
  if (!canManageUsers(ctx)) {
    return { ok: false, message: "管理者のみが権限設定を変更できます" };
  }
  if (!VALID_KEYS.includes(input.permissionKey)) {
    return { ok: false, message: "未知の permission_key です" };
  }
  if (!VALID_ROLES.includes(input.minRole)) {
    return { ok: false, message: "min_role に external は指定できません" };
  }
  try {
    await rolePermissionRepo.upsert({
      permissionKey: input.permissionKey,
      minRole: input.minRole,
      updatedBy: ctx.actor?.id ?? null
    });
    revalidatePath("/settings/permissions");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
