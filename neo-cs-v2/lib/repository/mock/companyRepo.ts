import { companies as seedCompanies } from "@/lib/mock/entities";
import { DEFAULT_ORG_ID } from "../types";
import type { Company, CompanyFilter, CompanyRepo } from "../types";

const store: Company[] = seedCompanies.map((c) => ({
  ...c,
  organizationId: DEFAULT_ORG_ID
}));

function genId(): string {
  return `c-mock-${Math.random().toString(36).slice(2, 10)}`;
}

function applyFilter(list: Company[], f?: CompanyFilter): Company[] {
  if (!f) return list;
  return list.filter((c) => {
    if (f.organizationId && c.organizationId !== f.organizationId) return false;
    if (f.ownerUserId && c.ownerName !== f.ownerUserId) return false;
    if (f.industry && c.industry !== f.industry) return false;
    if (f.search) {
      const q = f.search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.kana.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

export const mockCompanyRepo: CompanyRepo = {
  async list(filter) {
    return applyFilter(store, filter).map((c) => ({ ...c }));
  },
  async getById(id) {
    const c = store.find((x) => x.id === id);
    return c ? { ...c } : null;
  },
  async create(input) {
    const created: Company = {
      ...input,
      id: genId(),
      organizationId: input.organizationId ?? DEFAULT_ORG_ID
    };
    store.push(created);
    return { ...created };
  },
  async update(id, patch) {
    const idx = store.findIndex((c) => c.id === id);
    if (idx < 0) throw new Error(`Company not found: ${id}`);
    store[idx] = { ...store[idx], ...patch };
    return { ...store[idx] };
  },
  async delete(id) {
    const idx = store.findIndex((c) => c.id === id);
    if (idx >= 0) store.splice(idx, 1);
  }
};
