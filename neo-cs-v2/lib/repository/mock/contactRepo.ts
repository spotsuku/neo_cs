import { contacts as seed } from "@/lib/mock/entities";
import { DEFAULT_ORG_ID } from "../types";
import type { Contact, ContactRepo } from "../types";

const store: Contact[] = seed.map((c) => ({ ...c, organizationId: DEFAULT_ORG_ID }));

function genId(): string {
  return `p-${Math.random().toString(36).slice(2, 10)}`;
}

export const mockContactRepo: ContactRepo = {
  async listByCompany(companyId) {
    return store.filter((c) => c.companyId === companyId).map((c) => ({ ...c }));
  },
  async create(input) {
    const created: Contact = {
      ...input,
      id: genId(),
      organizationId: input.organizationId ?? DEFAULT_ORG_ID
    };
    store.push(created);
    return { ...created };
  }
};
