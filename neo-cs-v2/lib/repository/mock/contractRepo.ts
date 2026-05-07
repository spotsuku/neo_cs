import { allContracts, activeContracts } from "@/lib/mock/onboarding";
import { DEFAULT_ORG_ID } from "../types";
import type {
  Contract,
  ContractFilter,
  ContractRepo,
  ContractStatus
} from "../types";
import { useGlobalStore } from "./_global-store";
import { mockMutate } from "./_mockMutate";

const store = useGlobalStore<Contract[]>("__contractStore", () =>
  allContracts.map((c) => ({ ...c, organizationId: DEFAULT_ORG_ID }))
);
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
    // 評議会バンドルの重複防止:
    //  - academia と hyogikai を同一会社で同時 active にしない
    //  - 同一 (companyId, product) で active 契約を二重に作らない
    const ACTIVE = new Set<ContractStatus>([
      "handoff",
      "onboarding",
      "active",
      "renewal_window"
    ]);
    if (ACTIVE.has(input.status)) {
      const sibling = store.find(
        (c) => c.companyId === input.companyId && ACTIVE.has(c.status)
      );
      if (input.product === "hyogikai") {
        const academia = store.find(
          (c) =>
            c.companyId === input.companyId &&
            c.product === "academia" &&
            ACTIVE.has(c.status)
        );
        if (academia) {
          const err: Error & { code?: string } = new Error(
            "アカデミア契約に評議会参加権が付帯しているため、評議会単独契約は作成できません"
          );
          err.code = "HYOGIKAI_REDUNDANT_WITH_ACADEMIA";
          throw err;
        }
      }
      if (input.product === "academia") {
        const hyogikai = store.find(
          (c) =>
            c.companyId === input.companyId &&
            c.product === "hyogikai" &&
            ACTIVE.has(c.status)
        );
        if (hyogikai) {
          const err: Error & { code?: string } = new Error(
            "評議会単独契約が active のため、アカデミア契約を作成する場合は先に評議会を切替・解約してください"
          );
          err.code = "ACADEMIA_OVERLAPS_HYOGIKAI";
          throw err;
        }
      }
      // 同一 product の二重 active は原則禁止。
      // ただし next-cycle 作成（previousContractId 指定）の場合は許可する。
      // これは「内諾後に次期契約を起票し、現行サイクルが終了 → 自動 renewed
      // 切替」というフローで一時的に2世代並走するため。
      const dupSameProduct = store.find(
        (c) =>
          c.companyId === input.companyId &&
          c.product === input.product &&
          ACTIVE.has(c.status)
      );
      if (dupSameProduct && input.previousContractId !== dupSameProduct.id) {
        const err: Error & { code?: string } = new Error(
          `${input.product} の active 契約が既に存在します (${dupSameProduct.id})`
        );
        err.code = "DUPLICATE_ACTIVE_PRODUCT";
        throw err;
      }
      void sibling;
    }
    const created: Contract = {
      ...input,
      id: genId(),
      organizationId: input.organizationId ?? DEFAULT_ORG_ID
    };
    store.push(created);
    await mockMutate({
      entityType: "contracts",
      entityId: created.id,
      action: "create",
      after: created,
      organizationId: created.organizationId
    });
    return { ...created };
  },
  async update(id, patch) {
    const idx = store.findIndex((c) => c.id === id);
    if (idx < 0) throw new Error(`Contract not found: ${id}`);
    const before = { ...store[idx] };
    store[idx] = { ...store[idx], ...patch };
    await mockMutate({
      entityType: "contracts",
      entityId: id,
      action: "update",
      before,
      after: store[idx],
      organizationId: store[idx].organizationId
    });
    return { ...store[idx] };
  }
};
