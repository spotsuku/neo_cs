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
  },
  {
    id: "u-ext-demo",
    organizationId: DEFAULT_ORG_ID,
    email: "external-demo@example.com",
    name: "外部 太郎",
    role: "external",
    isActive: true,
    createdAt: "2026-04-01T00:00:00Z"
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
    // dev/E2E のみ: cookie `mock_user_email` で actor を切替可能（next/headers 経由）
    let email = process.env.MOCK_CURRENT_USER_EMAIL ?? "k_furuno@neoacademia.jp";
    if (process.env.NODE_ENV !== "production") {
      try {
        const { cookies } = await import("next/headers");
        const c = await cookies();
        const override = c.get("mock_user_email")?.value;
        if (override) email = override;
      } catch {
        // next/headers が無いコンテキスト（テスト等）では無視
      }
    }
    const u = store.find((x) => x.email.toLowerCase() === email.toLowerCase());
    return u ? { ...u } : null;
  },
  async create(input) {
    const email = input.email.trim().toLowerCase();
    if (store.some((u) => u.email.toLowerCase() === email)) {
      throw new Error(`既に登録済みのメールアドレスです: ${input.email}`);
    }
    const created: AppUser = {
      id: `u-${Math.random().toString(36).slice(2, 10)}`,
      organizationId: input.organizationId ?? DEFAULT_ORG_ID,
      email,
      name: input.name,
      role: input.role,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    store.push(created);
    return { ...created };
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
