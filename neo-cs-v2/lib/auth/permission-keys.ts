// 権限マトリクス用の表示ラベル (client / server 両用)
//
// lib/auth/role-permissions.ts は server-only なため、UI で使う定数だけを
// 本ファイルに切り出している。

import type { AppUserRole, PermissionKey } from "@/lib/repository/types";

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  contract_manage: "契約の追加・編集・解約",
  program_term_manage: "研修の期 (第◯期 / 第◯回) の作成・編集・削除"
};

export const ROLE_LABEL: Record<AppUserRole, string> = {
  admin: "管理者 (admin)",
  manager: "マネージャー (manager)",
  member: "メンバー (member)",
  viewer: "閲覧者 (viewer)",
  external: "外部 (external)"
};
