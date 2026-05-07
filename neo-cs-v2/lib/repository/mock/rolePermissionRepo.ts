// ロール権限マトリクス (mock 実装)
//
// 実 DB (supabase 駆動) では migration 0035 で seed される値を返すが、
// mock では本ファイル冒頭の defaults をスタートライン値として使う。
// 「admin が UI で min_role を変更」する操作は in-memory に反映する。

import type {
  AppUserRole,
  PermissionKey,
  RolePermission,
  RolePermissionRepo
} from "../types";
import { useGlobalStore } from "./_global-store";
import { mockMutate } from "./_mockMutate";

const DEFAULTS: RolePermission[] = [
  {
    permissionKey: "contract_manage",
    minRole: "manager",
    description: "企業ページで契約 (Contract) の追加・編集・解約・削除を行う",
    updatedAt: new Date("2026-05-07").toISOString()
  },
  {
    permissionKey: "program_term_manage",
    minRole: "manager",
    description: "研修ごとの期 (Term / 第◯期 / 第◯回) の作成・編集・削除を行う",
    updatedAt: new Date("2026-05-07").toISOString()
  }
];

const store = useGlobalStore<RolePermission[]>(
  "__rolePermissionStore",
  () => DEFAULTS.map((d) => ({ ...d }))
);

export const mockRolePermissionRepo: RolePermissionRepo = {
  async list() {
    return store.map((r) => ({ ...r }));
  },
  async getByKey(key: PermissionKey) {
    const r = store.find((x) => x.permissionKey === key);
    return r ? { ...r } : null;
  },
  async upsert(input) {
    const idx = store.findIndex((x) => x.permissionKey === input.permissionKey);
    const now = new Date().toISOString();
    let before: RolePermission | undefined;
    let after: RolePermission;
    if (idx < 0) {
      after = {
        permissionKey: input.permissionKey,
        minRole: input.minRole,
        updatedBy: input.updatedBy ?? null,
        updatedAt: now
      };
      store.push(after);
    } else {
      before = { ...store[idx] };
      store[idx] = {
        ...store[idx],
        minRole: input.minRole,
        updatedBy: input.updatedBy ?? null,
        updatedAt: now
      };
      after = store[idx];
    }
    await mockMutate({
      entityType: "role_permissions",
      entityId: input.permissionKey,
      action: idx < 0 ? "create" : "update",
      before,
      after,
      organizationId: null
    });
    return { ...after };
  }
};

void DEFAULTS; // tree-shaking 抑止
void ({} as AppUserRole);
