import { accountJourneys as seed } from "@/lib/mock/cycles";
import type { AccountJourney, AccountJourneyRepo } from "../types";

// AccountJourney は organization 持たない (mock型のまま)。RLS は親 companies で担保。
const store: AccountJourney[] = seed.map((j) => ({
  ...j,
  history: j.history.map((h) => ({ ...h }))
}));

export const mockAccountJourneyRepo: AccountJourneyRepo = {
  async listByCompany(companyId) {
    return store
      .filter((j) => j.companyId === companyId)
      .map((j) => ({ ...j, history: j.history.map((h) => ({ ...h })) }));
  }
};
