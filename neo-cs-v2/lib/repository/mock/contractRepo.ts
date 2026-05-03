import { allContracts, activeContracts } from "@/lib/mock/onboarding";
import { DEFAULT_ORG_ID } from "../types";
import type {
  Contract,
  ContractFilter,
  ContractRepo,
  ContractStatus
} from "../types";

const store: Contract[] = allContracts.map((c) => ({
  ...c,
  organizationId: DEFAULT_ORG_ID
}));
const activeIds = new Set(activeContracts.map((c) => c.id));

function genId(): string {
  return `k-mock-${Math.random().toString(36).slice(2, 10)}`;
}

function matchesStatus(c: Contract, s?: ContractStatus | ContractStatus[]): boolean {
  if (!s) return true;
  return Array.isArray(s) ? s.includes(c.status) : c.status === s;
}

function applyFilter(list: Contract[], f?: ContractFilter): Contract[] {
  if (!f) return list;
  return list.filter((c) => {
    if (f.organizationId && c.organizationId !== f.organizationId) return false;
    if (f.companyId && c.companyId !== f.companyId) return false;
    if (f.product && c.product !== f.product) return false;
    if (!matchesStatus(c, f.status)) return false;
    if (f.ownerUserId && c.ownerName !== f.ownerUserId) return false;
    if (f.activeOnly && !activeIds.has(c.id)) return false;
    return true;
  });
}

export const mockContractRepo: ContractRepo = {
  async list(filter) {
    return applyFilter(store, filter).map((c) => ({ ...c }));
  },
  async getById(id) {
    const c = store.find((x) => x.id === id);
    return c ? { ...c } : null;
  },
  async listByCompany(companyId, opts) {
    return store
      .filter((c) => c.companyId === companyId)
      .filter((c) => (opts?.activeOnly ? activeIds.has(c.id) : true))
      .map((c) => ({ ...c }));
  },
  async create(input) {
    const created: Contract = {
      ...input,
      id: genId(),
      organizationId: input.organizationId ?? DEFAULT_ORG_ID
    };
    store.push(created);
    return { ...created };
  },
  async update(id, patch) {
    const idx = store.findIndex((c) => c.id === id);
    if (idx < 0) throw new Error(`Contract not found: ${id}`);
    store[idx] = { ...store[idx], ...patch };
    return { ...store[idx] };
  }
};
