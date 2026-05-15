// F4: Drive テンプレート送付履歴 (mock 実装)
//
// 実運用上の送付実例がまだ無いため、デフォルト seed は空配列。
// in-memory ストアは _global-store 経由で Server Action / RSC 間で共有する。

import { DEFAULT_ORG_ID } from "../types";
import type {
  DriveSendLog,
  DriveSendLogCreateInput,
  DriveSendLogListFilter,
  DriveSendLogRepo
} from "../types";
import { useGlobalStore } from "./_global-store";
import { mockMutate } from "./_mockMutate";

const store = useGlobalStore<DriveSendLog[]>("__driveSendLogStore", () => []);

function genId(): string {
  return `dsl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clone(v: DriveSendLog): DriveSendLog {
  return { ...v };
}

function applyFilter(list: DriveSendLog[], f?: DriveSendLogListFilter): DriveSendLog[] {
  if (!f) return list;
  return list.filter((v) => {
    if (f.companyId && v.companyId !== f.companyId) return false;
    if (f.contractId && v.contractId !== f.contractId) return false;
    if (f.productCode && v.productCode !== f.productCode) return false;
    if (f.sentByUserId && v.sentByUserId !== f.sentByUserId) return false;
    if (f.sentAtFrom && v.sentAt < f.sentAtFrom) return false;
    if (f.sentAtTo && v.sentAt > f.sentAtTo) return false;
    return true;
  });
}

function sortRows(rows: DriveSendLog[], sort?: string): DriveSendLog[] {
  // 現状サポートは "sent_at desc" / "sent_at asc" のみ。デフォルトは desc。
  const key = (sort ?? "sent_at desc").trim().toLowerCase();
  const asc = key.endsWith("asc");
  return [...rows].sort((a, b) =>
    asc ? a.sentAt.localeCompare(b.sentAt) : b.sentAt.localeCompare(a.sentAt)
  );
}

export const mockDriveSendLogRepo: DriveSendLogRepo = {
  async list(filter) {
    const filtered = applyFilter(store, filter);
    const sorted = sortRows(filtered, filter?.sort);
    const limited = filter?.limit != null ? sorted.slice(0, filter.limit) : sorted;
    return limited.map(clone);
  },

  async listByCompany(companyId, opts) {
    const filtered = applyFilter(store, { companyId });
    const sorted = sortRows(filtered);
    const limited = opts?.limit != null ? sorted.slice(0, opts.limit) : sorted;
    return limited.map(clone);
  },

  async create(input: DriveSendLogCreateInput) {
    const now = new Date().toISOString();
    const sentAt = input.sentAt ?? now;
    // supabase 側の 0047 unique 制約と同等の dedup
    // (driveFileId, companyId, sentToEmail, sentAt)
    const existing = store.find(
      (r) =>
        r.driveFileId === input.driveFileId &&
        r.companyId === input.companyId &&
        r.sentToEmail === input.sentToEmail &&
        r.sentAt === sentAt
    );
    if (existing) return clone(existing);
    const created: DriveSendLog = {
      id: genId(),
      organizationId: input.organizationId ?? DEFAULT_ORG_ID,
      companyId: input.companyId,
      contractId: input.contractId ?? null,
      productCode: input.productCode ?? null,
      driveFileId: input.driveFileId,
      driveFileName: input.driveFileName,
      driveFileVersionLabel: input.driveFileVersionLabel ?? null,
      sentToEmail: input.sentToEmail,
      sentToContactId: input.sentToContactId ?? null,
      sentByUserId: input.sentByUserId,
      sentVia: input.sentVia,
      note: input.note ?? null,
      sentAt,
      createdAt: now
    };
    store.push(created);
    await mockMutate({
      entityType: "drive_send_logs",
      entityId: created.id,
      action: "create",
      before: undefined,
      after: created,
      organizationId: created.organizationId
    });
    return clone(created);
  }
};
