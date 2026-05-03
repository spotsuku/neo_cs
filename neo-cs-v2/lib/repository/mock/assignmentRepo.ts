import { DEFAULT_ORG_ID } from "../types";
import type {
  Assignment,
  AssignmentFilter,
  AssignmentRepo,
  AssignmentRole
} from "../types";

// 既存 mock データ companies.ownerName から primary 担当を seed
import { companies as seedCompanies } from "@/lib/mock/entities";

const ownerNameToUserId: Record<string, string> = {
  古野: "u-furuno",
  三木: "u-miki",
  松田: "u-matsuda"
};

function genId(): string {
  return `asn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const seed: Assignment[] = seedCompanies
  .map((c) => {
    const userId = ownerNameToUserId[c.ownerName];
    if (!userId) return null;
    return {
      id: `asn-${c.id}-${userId}-primary`,
      organizationId: DEFAULT_ORG_ID,
      companyId: c.id,
      userId,
      role: "primary" as AssignmentRole,
      assignedAt: "2026-01-01T00:00:00Z"
    };
  })
  .filter((x): x is Assignment => x !== null);

const store: Assignment[] = seed.map((a) => ({ ...a }));

function applyFilter(list: Assignment[], f?: AssignmentFilter): Assignment[] {
  if (!f) return list;
  return list.filter((a) => {
    if (f.organizationId && a.organizationId !== f.organizationId) return false;
    if (f.companyId && a.companyId !== f.companyId) return false;
    if (f.userId && a.userId !== f.userId) return false;
    if (f.role && a.role !== f.role) return false;
    if (f.activeOnly && a.unassignedAt) return false;
    return true;
  });
}

export const mockAssignmentRepo: AssignmentRepo = {
  async list(filter) {
    return applyFilter(store, filter).map((a) => ({ ...a }));
  },
  async listByCompany(companyId, opts) {
    return store
      .filter((a) => a.companyId === companyId)
      .filter((a) => (opts?.activeOnly ? !a.unassignedAt : true))
      .map((a) => ({ ...a }));
  },
  async listByUser(userId, opts) {
    return store
      .filter((a) => a.userId === userId)
      .filter((a) => (opts?.activeOnly ? !a.unassignedAt : true))
      .map((a) => ({ ...a }));
  },
  async assign(input) {
    const created: Assignment = {
      id: genId(),
      organizationId: input.organizationId ?? DEFAULT_ORG_ID,
      companyId: input.companyId,
      userId: input.userId,
      role: input.role,
      assignedAt: input.assignedAt ?? new Date().toISOString(),
      assignedBy: input.assignedBy,
      note: input.note
    };
    // primary / sales_owner は 1社1人。既存をunassignedにする
    if (created.role === "primary" || created.role === "sales_owner") {
      store.forEach((a, i) => {
        if (a.companyId === created.companyId && a.role === created.role && !a.unassignedAt) {
          store[i] = { ...a, unassignedAt: created.assignedAt };
        }
      });
    }
    store.push(created);
    return { ...created };
  },
  async update(id, patch) {
    const idx = store.findIndex((a) => a.id === id);
    if (idx < 0) throw new Error(`Assignment not found: ${id}`);
    const current = store[idx];
    // primary / sales_owner 昇格時は同 company の同役割を自動 unassign
    if (
      (patch.role === "primary" || patch.role === "sales_owner") &&
      patch.role !== current.role
    ) {
      const now = new Date().toISOString();
      store.forEach((a, i) => {
        if (
          a.companyId === current.companyId &&
          a.id !== id &&
          a.role === patch.role &&
          !a.unassignedAt
        ) {
          store[i] = { ...a, unassignedAt: now };
        }
      });
    }
    const updated: Assignment = {
      ...current,
      role: patch.role ?? current.role,
      note: patch.note === null ? undefined : patch.note ?? current.note
    };
    store[idx] = updated;
    return { ...updated };
  },

  async unassign(id, opts) {
    const idx = store.findIndex((a) => a.id === id);
    if (idx < 0) return;
    store[idx] = {
      ...store[idx],
      unassignedAt: opts?.unassignedAt ?? new Date().toISOString()
    };
  }
};
