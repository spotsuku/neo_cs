import { successPlans as seed } from "@/lib/mock/cycles";
import type { SuccessPlan, SuccessPlanRepo } from "../types";

const store: SuccessPlan[] = seed.map((p) => ({
  ...p,
  goals: p.goals.map((g) => ({ ...g }))
}));

export const mockSuccessPlanRepo: SuccessPlanRepo = {
  async listByContractIds(contractIds) {
    if (contractIds.length === 0) return [];
    const set = new Set(contractIds);
    return store
      .filter((p) => set.has(p.contractId))
      .map((p) => ({ ...p, goals: p.goals.map((g) => ({ ...g })) }));
  }
};
