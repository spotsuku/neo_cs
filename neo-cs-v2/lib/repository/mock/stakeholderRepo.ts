import { stakeholders as seed } from "@/lib/mock/cycles";
import { DEFAULT_ORG_ID } from "../types";
import type { Stakeholder, StakeholderRepo } from "../types";

const store: Stakeholder[] = seed.map((s) => ({ ...s, organizationId: DEFAULT_ORG_ID }));

export const mockStakeholderRepo: StakeholderRepo = {
  async listByCompany(companyId) {
    return store.filter((s) => s.companyId === companyId).map((s) => ({ ...s }));
  }
};
