import { companies as seedCompanies } from "@/lib/mock/entities";
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
const store: Company[] = seedCompanies.map((c) => ({
  ...c,
  organizationId: DEFAULT_ORG_ID,
  isDemo: c.isDemo ?? true,
  createdAt: new Date().toISOString()
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
      organizationId: input.organizationId ?? DEFAULT_ORG_ID,
      isDemo: input.isDemo ?? true,
      createdAt: new Date().toISOString()
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
