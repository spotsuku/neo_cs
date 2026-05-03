import { DEFAULT_ORG_ID } from "../types";
import type { OneOnOneLog, OneOnOneFilter, OneOnOneLogRepo } from "../types";

const store: OneOnOneLog[] = [];

function genId(): string {
  return `oo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function applyFilter(list: OneOnOneLog[], f?: OneOnOneFilter): OneOnOneLog[] {
  if (!f) return list;
  return list.filter((l) => {
    if (f.organizationId && l.organizationId !== f.organizationId) return false;
    if (f.managerUserId && l.managerUserId !== f.managerUserId) return false;
    if (f.memberUserId && l.memberUserId !== f.memberUserId) return false;
    if (f.fromOccurredAt && l.occurredAt < f.fromOccurredAt) return false;
    if (f.toOccurredAt && l.occurredAt > f.toOccurredAt) return false;
    return true;
  });
}

export const mockOneOnOneLogRepo: OneOnOneLogRepo = {
  async list(filter) {
    return applyFilter(store, filter)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .map((l) => ({ ...l }));
  },
  async getById(id) {
    const l = store.find((x) => x.id === id);
    return l ? { ...l } : null;
  },
  async create(input) {
    const now = new Date().toISOString();
    const created: OneOnOneLog = {
      ...input,
      organizationId: input.organizationId ?? DEFAULT_ORG_ID,
      id: genId(),
      createdAt: now,
      updatedAt: now
    };
    store.push(created);
    return { ...created };
  },
  async update(id, patch) {
    const idx = store.findIndex((l) => l.id === id);
    if (idx < 0) throw new Error(`OneOnOneLog not found: ${id}`);
    store[idx] = { ...store[idx], ...patch, updatedAt: new Date().toISOString() };
    return { ...store[idx] };
  },
  async delete(id) {
    const idx = store.findIndex((l) => l.id === id);
    if (idx >= 0) store.splice(idx, 1);
  }
};
