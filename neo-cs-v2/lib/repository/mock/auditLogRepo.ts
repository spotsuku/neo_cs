import type { AuditLog, AuditLogFilter, AuditLogRepo } from "../types";

const store: AuditLog[] = [];

function genId(): string {
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const mockAuditLogRepo: AuditLogRepo = {
  async list(filter?: AuditLogFilter) {
    let rows = store.slice();
    if (filter?.organizationId)
      rows = rows.filter((r) => r.organizationId === filter.organizationId);
    if (filter?.actorUserId) rows = rows.filter((r) => r.actorUserId === filter.actorUserId);
    if (filter?.targetTable) rows = rows.filter((r) => r.targetTable === filter.targetTable);
    if (filter?.targetId) rows = rows.filter((r) => r.targetId === filter.targetId);
    if (filter?.action) rows = rows.filter((r) => r.action === filter.action);
    if (filter?.fromCreatedAt) rows = rows.filter((r) => r.createdAt >= filter.fromCreatedAt!);
    if (filter?.toCreatedAt) rows = rows.filter((r) => r.createdAt <= filter.toCreatedAt!);
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filter?.limit) rows = rows.slice(0, filter.limit);
    return rows.map((r) => ({ ...r }));
  },
  async append(input) {
    store.push({
      ...input,
      id: genId(),
      createdAt: input.createdAt ?? new Date().toISOString()
    });
  }
};
