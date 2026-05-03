import { contractOnboardingItems as seed } from "@/lib/mock/onboarding";
import { DEFAULT_ORG_ID } from "../types";
import type { ContractOnboardingItem, OnboardingItemRepo } from "../types";

const store: ContractOnboardingItem[] = seed.map((i) => ({
  ...i,
  organizationId: DEFAULT_ORG_ID
}));

export const mockOnboardingItemRepo: OnboardingItemRepo = {
  async listByContractIds(contractIds) {
    if (contractIds.length === 0) return [];
    const set = new Set(contractIds);
    return store.filter((i) => set.has(i.contractId)).map((i) => ({ ...i }));
  }
};
