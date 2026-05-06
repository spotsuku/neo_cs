// participants (Mock 実装)
// データソース: lib/mock/participants.ts

import { participants as seed } from "@/lib/mock/participants";
import { allContracts } from "@/lib/mock/onboarding";
import { DEFAULT_ORG_ID } from "../types";
import type { Participant, ParticipantRepo } from "../types";

const store: Participant[] = seed.map((p) => ({
  ...p,
  organizationId: DEFAULT_ORG_ID
}));

export const mockParticipantRepo: ParticipantRepo = {
  async listByContract(contractId) {
    return store.filter((p) => p.contractId === contractId).map((p) => ({ ...p }));
  },
  async list(opts) {
    let out = store.slice();
    if (opts?.productCode) {
      const ids = new Set(
        allContracts.filter((c) => c.product === opts.productCode).map((c) => c.id)
      );
      out = out.filter((p) => ids.has(p.contractId));
    }
    return out.map((p) => ({ ...p }));
  }
};
