// ユーザー × 事業（productCode）スコープロールの mock 実装
// 設計: lib/auth/permissions.ts と一対で機能。admin はこのテーブルにレコードを持たなくてよい

import { DEFAULT_ORG_ID } from "../types";
import type { UserProgramRole, UserProgramRoleRepo } from "../types";

const NOW = "2026-04-24T09:00:00Z";

const seed: UserProgramRole[] = [
  // 三木（manager）: アカデミア + AI研 を担当
  {
    userId: "u-miki",
    organizationId: DEFAULT_ORG_ID,
    productCode: "academia",
    scopeRole: "template_editor",
    assignedAt: NOW
  },
  {
    userId: "u-miki",
    organizationId: DEFAULT_ORG_ID,
    productCode: "aiken",
    scopeRole: "editor",
    assignedAt: NOW
  },
  // 松田（member）: アカデミアのみ。進捗編集まで
  {
    userId: "u-matsuda",
    organizationId: DEFAULT_ORG_ID,
    productCode: "academia",
    scopeRole: "editor",
    assignedAt: NOW
  }
];

const store: UserProgramRole[] = seed.map((r) => ({ ...r }));

export const mockUserProgramRoleRepo: UserProgramRoleRepo = {
  async listByUser(userId) {
    return store.filter((r) => r.userId === userId).map((r) => ({ ...r }));
  },
  async listByProduct(productCode, opts) {
    return store
      .filter((r) => r.productCode === productCode)
      .filter((r) => (opts?.organizationId ? r.organizationId === opts.organizationId : true))
      .map((r) => ({ ...r }));
  },
  async list(opts) {
    return store
      .filter((r) => (opts?.organizationId ? r.organizationId === opts.organizationId : true))
      .map((r) => ({ ...r }));
  },
  async upsert(input) {
    const idx = store.findIndex(
      (r) => r.userId === input.userId && r.productCode === input.productCode
    );
    const row: UserProgramRole = {
      userId: input.userId,
      organizationId: input.organizationId,
      productCode: input.productCode,
      scopeRole: input.scopeRole,
      assignedAt: input.assignedAt ?? new Date().toISOString(),
      assignedBy: input.assignedBy
    };
    if (idx >= 0) store[idx] = row;
    else store.push(row);
    return { ...row };
  },
  async remove(userId, productCode) {
    const idx = store.findIndex((r) => r.userId === userId && r.productCode === productCode);
    if (idx >= 0) store.splice(idx, 1);
  }
};
