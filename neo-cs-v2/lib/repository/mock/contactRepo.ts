import { contacts as seed } from "@/lib/mock/entities";
import { DEFAULT_ORG_ID } from "../types";
import type { Contact, ContactRepo } from "../types";

const store: Contact[] = seed.map((c) => ({ ...c, organizationId: DEFAULT_ORG_ID }));

export const mockContactRepo: ContactRepo = {
  async listByCompany(companyId) {
    return store.filter((c) => c.companyId === companyId).map((c) => ({ ...c }));
  }
};
