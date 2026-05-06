// sessions (Mock 実装)
// データソース: lib/mock/participants.ts

import { sessions as seed } from "@/lib/mock/participants";
import { DEFAULT_ORG_ID } from "../types";
import type { Session, SessionRepo } from "../types";

const store: Session[] = seed.map((s) => ({
  ...s,
  organizationId: DEFAULT_ORG_ID
}));

export const mockSessionRepo: SessionRepo = {
  async listByContract(contractId) {
    return store
      .filter((s) => s.contractId === contractId)
      .map((s) => ({ ...s, expectedParticipantIds: [...s.expectedParticipantIds] }));
  }
};
