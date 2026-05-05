import { DEFAULT_ORG_ID } from "../types";
import type { Draft, DraftRepo } from "../types";
import { useGlobalStore } from "./_global-store";

const store = useGlobalStore<Draft[]>("__draftStore", () => []);

function genId(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const mockDraftRepo: DraftRepo = {
  async get(ownerUserId, entityType, entityId) {
    const d = store.find(
      (x) =>
        x.ownerUserId === ownerUserId &&
        x.entityType === entityType &&
        x.entityId === entityId
    );
    return d ? { ...d, payload: { ...d.payload } } : null;
  },
  async upsert(input) {
    const idx = store.findIndex(
      (x) =>
        x.ownerUserId === input.ownerUserId &&
        x.entityType === input.entityType &&
        x.entityId === input.entityId
    );
    const now = new Date().toISOString();
    const merged: Draft = {
      id: input.id ?? (idx >= 0 ? store[idx].id : genId()),
      organizationId: input.organizationId ?? DEFAULT_ORG_ID,
      ownerUserId: input.ownerUserId,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: { ...input.payload },
      updatedAt: now
    };
    if (idx >= 0) store[idx] = merged;
    else store.push(merged);
    return { ...merged, payload: { ...merged.payload } };
  },
  async delete(ownerUserId, entityType, entityId) {
    const idx = store.findIndex(
      (x) =>
        x.ownerUserId === ownerUserId &&
        x.entityType === entityType &&
        x.entityId === entityId
    );
    if (idx >= 0) store.splice(idx, 1);
  },
  async listByOwner(ownerUserId) {
    return store
      .filter((d) => d.ownerUserId === ownerUserId)
      .map((d) => ({ ...d, payload: { ...d.payload } }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
};
