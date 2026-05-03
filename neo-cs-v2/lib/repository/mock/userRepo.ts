import { DEFAULT_ORG_ID } from "../types";
import type { AppUser, AppUserRole, UserRepo } from "../types";

const seed: AppUser[] = [
  {
    id: "u-furuno",
    organizationId: DEFAULT_ORG_ID,
    email: "k_furuno@neoacademia.jp",
    name: "古野",
    role: "admin",
    isActive: true,
    createdAt: "2024-04-01T00:00:00Z"
  },
  {
    id: "u-miki",
    organizationId: DEFAULT_ORG_ID,
    email: "miki@neoacademia.jp",
    name: "三木",
    role: "manager",
    isActive: true,
    createdAt: "2024-04-01T00:00:00Z"
  },
  {
    id: "u-matsuda",
    organizationId: DEFAULT_ORG_ID,
    email: "matsuda@neoacademia.jp",
    name: "松田",
    role: "member",
    isActive: true,
    createdAt: "2024-04-01T00:00:00Z"
  }
];

const store: AppUser[] = seed.map((u) => ({ ...u }));

export const mockUserRepo: UserRepo = {
  async list(opts) {
    return store
      .filter((u) => (opts?.organizationId ? u.organizationId === opts.organizationId : true))
      .filter((u) => (opts?.activeOnly ? u.isActive : true))
      .map((u) => ({ ...u }));
  },
  async getById(id) {
    const u = store.find((x) => x.id === id);
    return u ? { ...u } : null;
  },
  async getByEmail(email) {
    const u = store.find((x) => x.email.toLowerCase() === email.toLowerCase());
    return u ? { ...u } : null;
  },
  async getCurrent() {
    const email = process.env.MOCK_CURRENT_USER_EMAIL ?? "k_furuno@neoacademia.jp";
    const u = store.find((x) => x.email.toLowerCase() === email.toLowerCase());
    return u ? { ...u } : null;
  },
  async setRole(id, role: AppUserRole) {
    const idx = store.findIndex((u) => u.id === id);
    if (idx < 0) throw new Error(`User not found: ${id}`);
    store[idx] = { ...store[idx], role };
  },
  async setActive(id, isActive) {
    const idx = store.findIndex((u) => u.id === id);
    if (idx < 0) throw new Error(`User not found: ${id}`);
    store[idx] = {
      ...store[idx],
      isActive,
      disabledAt: isActive ? undefined : new Date().toISOString()
    };
  }
};
