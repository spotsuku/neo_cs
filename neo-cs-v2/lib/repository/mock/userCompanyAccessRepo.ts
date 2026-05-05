// external ユーザー × 企業 の閲覧/編集アクセス mock 実装
// 通常ロール（admin/manager/member/viewer）では参照されない

import { DEFAULT_ORG_ID } from "../types";
import type { UserCompanyAccess, UserCompanyAccessRepo } from "../types";

const store: UserCompanyAccess[] = [];

export const mockUserCompanyAccessRepo: UserCompanyAccessRepo = {
  async listByUser(userId) {
    return store.filter((r) => r.userId === userId).map((r) => ({ ...r }));
  },
  async listByCompany(companyId) {
    return store.filter((r) => r.companyId === companyId).map((r) => ({ ...r }));
  },
  async grant(input) {
    const idx = store.findIndex(
      (r) => r.userId === input.userId && r.companyId === input.companyId
    );
    const row: UserCompanyAccess = {
      userId: input.userId,
      organizationId: input.organizationId ?? DEFAULT_ORG_ID,
      companyId: input.companyId,
      grantedAt: input.grantedAt ?? new Date().toISOString(),
      grantedBy: input.grantedBy
    };
    if (idx >= 0) store[idx] = row;
    else store.push(row);
    return { ...row };
  },
  async revoke(userId, companyId) {
    const idx = store.findIndex((r) => r.userId === userId && r.companyId === companyId);
    if (idx >= 0) store.splice(idx, 1);
  }
};
