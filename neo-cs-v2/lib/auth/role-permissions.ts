// ロール権限マトリクス → canPerform(ctx, key) ヘルパ
//
// 設計:
//   - role_permissions テーブル (mig 0035) の (permission_key → min_role) を読み、
//     actor.role が min_role 以上かを判定する。
//   - 1 リクエスト中の重複読み込みを避けるため React.cache で memoize する。
//   - DB 不在 (mock 駆動 / supabase 未設定) ではフォールバック既定値を使う。
//
// 安全方針:
//   - 真のセキュリティ境界は Server Action / RLS。本ヘルパは Server Action の
//     先頭で呼び出して early return する用途と、UI の出し分け両方で使う。
//   - DB 読込み失敗時は **fail-closed** (admin のみ許可) にする。乗っ取り対策。

import "server-only";
import { cache } from "react";
import { rolePermissionRepo } from "@/lib/repository/server";
import type {
  AppUserRole,
  PermissionKey,
  RolePermission
} from "@/lib/repository/types";
import { effectiveRole, type PermissionContext } from "./permissions";

// UI 表示用ラベルは client/server 両用ファイルに切り出し済
export { PERMISSION_LABELS, ROLE_LABEL } from "./permission-keys";

const ROLE_ORDER: Record<AppUserRole, number> = {
  external: -1,
  viewer: 0,
  member: 1,
  manager: 2,
  admin: 3
};

/** 既定値: DB 読込みに失敗した場合の fallback (manager 以上のみ許可) */
const FALLBACK: Record<PermissionKey, AppUserRole> = {
  contract_manage: "manager",
  program_term_manage: "manager"
};

/** 1 リクエスト中で同じ DB 読込みを再発行しない */
export const loadPermissionMatrix = cache(async (): Promise<Record<PermissionKey, AppUserRole>> => {
  try {
    const rows: RolePermission[] = await rolePermissionRepo.list();
    const matrix: Record<string, AppUserRole> = { ...FALLBACK };
    for (const r of rows) {
      matrix[r.permissionKey] = r.minRole;
    }
    return matrix as Record<PermissionKey, AppUserRole>;
  } catch (e) {
    // 読込み失敗時は fail-closed: 全機能を admin 限定にして警告ログ
    process.stderr.write(
      JSON.stringify({
        at: new Date().toISOString(),
        kind: "role_permissions_load_failed",
        message: e instanceof Error ? e.message : String(e),
        fallback: "admin_only"
      }) + "\n"
    );
    return {
      contract_manage: "admin",
      program_term_manage: "admin"
    };
  }
});

/** actor の effectiveRole が permissionKey の最低ロール以上か */
export async function canPerform(
  ctx: PermissionContext,
  key: PermissionKey
): Promise<boolean> {
  const role = effectiveRole(ctx);
  // external は常に対象外
  if (role === "external") return false;
  const matrix = await loadPermissionMatrix();
  const min = matrix[key];
  return ROLE_ORDER[role] >= ROLE_ORDER[min];
}

/** Server Action の先頭で呼び、未許可なら throw */
export async function requirePermission(
  ctx: PermissionContext,
  key: PermissionKey
): Promise<void> {
  const ok = await canPerform(ctx, key);
  if (!ok) {
    throw new Error(`forbidden: ${key}`);
  }
}
