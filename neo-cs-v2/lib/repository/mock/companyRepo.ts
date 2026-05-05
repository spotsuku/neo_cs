import "@/lib/mock/karute-no-init"; // entities.companies に karuteNo を付与
import { companies as seedCompanies } from "@/lib/mock/entities";
import { allContracts } from "@/lib/mock/onboarding";
import { DEFAULT_ORG_ID } from "../types";
import type {
  Company,
  CompanyFilter,
  CompanyRepo,
  DemoWipeRange,
  DemoWipeResult
} from "../types";
import { filterDemoByRange } from "@/lib/domain/demo-data";

// 既存の seed 企業はすべてデモ扱い (本番開始前のため)。
// 0019_is_demo_flag.sql の方針と一致させる。
const baseStore: Company[] = seedCompanies.map((c) => ({
  ...c,
  organizationId: DEFAULT_ORG_ID,
  isDemo: c.isDemo ?? true,
  createdAt: new Date().toISOString()
}));

// karuteNo を契約順 (= 企業の最初の契約 startDate 昇順) でバックフィル。
// 契約が無い企業は末尾に回す。
function backfillKaruteNo(list: Company[]): Company[] {
  const earliestContractByCompany = new Map<string, string>();
  for (const c of allContracts) {
    const cur = earliestContractByCompany.get(c.companyId);
    if (!cur || c.startDate < cur) {
      earliestContractByCompany.set(c.companyId, c.startDate);
    }
  }
  // 既存 karuteNo が指定されていればそれを尊重。未設定のみ採番。
  const sorted = [...list].sort((a, b) => {
    const ax = earliestContractByCompany.get(a.id);
    const bx = earliestContractByCompany.get(b.id);
    if (ax && bx) return ax.localeCompare(bx);
    if (ax) return -1;
    if (bx) return 1;
    return a.id.localeCompare(b.id);
  });
  let next = 1;
  const used = new Set<number>();
  for (const c of sorted) {
    if (typeof c.karuteNo === "number") used.add(c.karuteNo);
  }
  for (const c of sorted) {
    if (typeof c.karuteNo !== "number") {
      while (used.has(next)) next++;
      c.karuteNo = next;
      used.add(next);
      next++;
    }
  }
  return list;
}

// globalThis 共有 (Server Action / RSC で別 module instance になるため)
const G = globalThis as unknown as { __companyStore?: Company[] };
if (!G.__companyStore) {
  G.__companyStore = backfillKaruteNo(baseStore);
}
const store = G.__companyStore;

function genId(): string {
  return `c-mock-${Math.random().toString(36).slice(2, 10)}`;
}

function applyFilter(list: Company[], f?: CompanyFilter): Company[] {
  if (!f) return list;
  return list.filter((c) => {
    if (f.organizationId && c.organizationId !== f.organizationId) return false;
    if (f.ownerUserId && c.ownerName !== f.ownerUserId) return false;
    if (f.industry && c.industry !== f.industry) return false;
    if (typeof f.isDemo === "boolean") {
      const isDemo = c.isDemo ?? true;
      if (isDemo !== f.isDemo) return false;
    }
    if (f.search) {
      const q = f.search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.kana.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

export const mockCompanyRepo: CompanyRepo = {
  async list(filter) {
    // カルテNo. 昇順 (= 契約順) で返す。No. 未設定は末尾。
    return applyFilter(store, filter)
      .slice()
      .sort((a, b) => {
        const ax = a.karuteNo ?? Number.POSITIVE_INFINITY;
        const bx = b.karuteNo ?? Number.POSITIVE_INFINITY;
        if (ax !== bx) return ax - bx;
        return a.id.localeCompare(b.id);
      })
      .map((c) => ({ ...c }));
  },
  async getById(id) {
    const c = store.find((x) => x.id === id);
    return c ? { ...c } : null;
  },
  async create(input) {
    const orgId = input.organizationId ?? DEFAULT_ORG_ID;
    // karuteNo が指定なし: 同一org内 MAX+1 で自動採番
    let karuteNo = input.karuteNo;
    if (typeof karuteNo !== "number") {
      const used = store
        .filter((c) => c.organizationId === orgId && typeof c.karuteNo === "number")
        .map((c) => c.karuteNo as number);
      karuteNo = used.length > 0 ? Math.max(...used) + 1 : 1;
    } else {
      // 指定された場合は重複チェック
      const dup = store.find(
        (c) => c.organizationId === orgId && c.karuteNo === karuteNo
      );
      if (dup) {
        const err: Error & { code?: string } = new Error(
          `カルテNo. ${karuteNo} は既に使われています (${dup.name})`
        );
        err.code = "KARUTE_NO_CONFLICT";
        throw err;
      }
    }
    const created: Company = {
      ...input,
      id: genId(),
      organizationId: orgId,
      karuteNo,
      isDemo: input.isDemo ?? true,
      createdAt: new Date().toISOString()
    };
    store.push(created);
    return { ...created };
  },
  async setKaruteNo(id, newNo) {
    const idx = store.findIndex((c) => c.id === id);
    if (idx < 0) throw new Error(`Company not found: ${id}`);
    if (!Number.isInteger(newNo) || newNo < 1) {
      const err: Error & { code?: string } = new Error(
        "カルテNo. は 1 以上の整数を指定してください"
      );
      err.code = "KARUTE_NO_INVALID";
      throw err;
    }
    const target = store[idx];
    if (target.karuteNo === newNo) return { ...target };
    const dup = store.find(
      (c) =>
        c.id !== id &&
        c.organizationId === target.organizationId &&
        c.karuteNo === newNo
    );
    if (dup) {
      const err: Error & { code?: string } = new Error(
        `カルテNo. ${newNo} は既に「${dup.name}」で使われています`
      );
      err.code = "KARUTE_NO_CONFLICT";
      throw err;
    }
    store[idx] = { ...target, karuteNo: newNo };
    return { ...store[idx] };
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
  },
  async setDriveFolder(id, drive) {
    const idx = store.findIndex((c) => c.id === id);
    if (idx < 0) throw new Error(`Company not found: ${id}`);
    store[idx] = {
      ...store[idx],
      driveFolderId: drive.folderId,
      driveFolderUrl: drive.folderUrl,
      driveFolderCreatedAt: new Date().toISOString()
    };
  },

  async listDemo(opts) {
    const orgFilter: CompanyFilter = {
      isDemo: true,
      organizationId: opts?.organizationId
    };
    const all = applyFilter(store, orgFilter).map((c) => ({ ...c }));
    const range: DemoWipeRange = opts?.range ?? "all";
    const filtered = filterDemoByRange(
      all.map((c) => ({ id: c.id, createdAt: c.createdAt })),
      range
    );
    const allowed = new Set(filtered.map((x) => x.id));
    return all.filter((c) => allowed.has(c.id));
  },

  async countDemo(opts) {
    return applyFilter(store, {
      isDemo: true,
      organizationId: opts?.organizationId
    }).length;
  },

  async wipeDemoData(opts): Promise<DemoWipeResult> {
    const targets = await this.listDemo({
      organizationId: opts.organizationId,
      range: opts.range
    });
    const ids = targets.map((c) => c.id);
    for (const id of ids) {
      const idx = store.findIndex((c) => c.id === id);
      if (idx >= 0) store.splice(idx, 1);
    }
    return { deletedCompanies: ids.length, deletedIds: ids };
  }
};
