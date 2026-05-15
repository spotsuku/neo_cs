import { contractOnboardingItems as seed } from "@/lib/mock/onboarding";
import { DEFAULT_ORG_ID } from "../types";
import type { ContractOnboardingItem, OnboardingItemRepo } from "../types";
import { getOrInitGlobalStore } from "./_global-store";

// Server Action と Server Component で同じ参照を共有するため globalThis 経由
const store = getOrInitGlobalStore<ContractOnboardingItem[]>(
  "__onboardingItemsStore",
  () =>
    seed.map((i) => ({
      ...i,
      organizationId: DEFAULT_ORG_ID
    }))
);

export const mockOnboardingItemRepo: OnboardingItemRepo = {
  async listByContractIds(contractIds) {
    if (contractIds.length === 0) return [];
    const set = new Set(contractIds);
    return store.filter((i) => set.has(i.contractId)).map((i) => ({ ...i }));
  },
  async update(id, patch) {
    const i = store.findIndex((x) => x.id === id);
    if (i < 0) throw new Error(`OnboardingItem not found: ${id}`);
    const now = new Date().toISOString();
    const next = { ...store[i] } as ContractOnboardingItem;
    if (patch.status !== undefined) {
      next.status = patch.status;
      if (patch.status === "done" && !next.completedAt) {
        next.completedAt = now;
      }
      if (patch.status !== "done") {
        next.completedAt = undefined;
      }
    }
    if (patch.dueDate !== undefined) {
      next.dueDate = patch.dueDate ?? "";
    }
    if (patch.assignee !== undefined) {
      next.assignee = patch.assignee ?? "";
    }
    if (patch.note !== undefined) {
      next.note = patch.note ?? undefined;
    }
    store[i] = next;
    return { ...next };
  },
  async createBatch(items) {
    const created = items.map((it) => ({
      ...it,
      organizationId: it.organizationId ?? DEFAULT_ORG_ID
    }));
    store.push(...created);
    return created.map((c) => ({ ...c }));
  }
};
