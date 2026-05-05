// 通知ロールフィルタのテスト

import { describe, it, expect } from "vitest";
import {
  canReceiveNotification,
  filterRecipientsByRole,
  externalCanReceiveCompanyNotification
} from "./role-filter";
import type { AppUser, AppUserRole } from "@/lib/repository/types";

const NOW = "2026-04-24T09:00:00Z";

function user(role: AppUserRole, id = "u-1"): AppUser {
  return {
    id,
    organizationId: "org-1",
    email: `${id}@example.com`,
    name: id,
    role,
    isActive: true,
    createdAt: NOW
  };
}

describe("canReceiveNotification", () => {
  it("internal_ops は external 以外受信可", () => {
    expect(canReceiveNotification("admin", "internal_ops")).toBe(true);
    expect(canReceiveNotification("manager", "internal_ops")).toBe(true);
    expect(canReceiveNotification("member", "internal_ops")).toBe(true);
    expect(canReceiveNotification("viewer", "internal_ops")).toBe(true);
    expect(canReceiveNotification("external", "internal_ops")).toBe(false);
  });

  it("cross_business も external 以外", () => {
    expect(canReceiveNotification("manager", "cross_business")).toBe(true);
    expect(canReceiveNotification("external", "cross_business")).toBe(false);
  });

  it("assigned_company は全ロール可", () => {
    for (const r of ["admin", "manager", "member", "viewer", "external"] as AppUserRole[]) {
      expect(canReceiveNotification(r, "assigned_company")).toBe(true);
    }
  });

  it("personal は全ロール可", () => {
    for (const r of ["admin", "manager", "member", "viewer", "external"] as AppUserRole[]) {
      expect(canReceiveNotification(r, "personal")).toBe(true);
    }
  });

  it("undefined は false", () => {
    expect(canReceiveNotification(undefined, "personal")).toBe(false);
  });
});

describe("filterRecipientsByRole", () => {
  const users = [
    user("admin", "u-admin"),
    user("manager", "u-manager"),
    user("member", "u-member"),
    user("external", "u-ext")
  ];

  it("internal_ops で external が除外される", () => {
    const filtered = filterRecipientsByRole(users, "internal_ops");
    expect(filtered.map((u) => u.id)).toEqual(["u-admin", "u-manager", "u-member"]);
  });

  it("cross_business でも external が除外される", () => {
    const filtered = filterRecipientsByRole(users, "cross_business");
    expect(filtered.find((u) => u.role === "external")).toBeUndefined();
  });

  it("assigned_company / personal は全員残る", () => {
    expect(filterRecipientsByRole(users, "assigned_company")).toHaveLength(4);
    expect(filterRecipientsByRole(users, "personal")).toHaveLength(4);
  });
});

describe("externalCanReceiveCompanyNotification", () => {
  it("アクセス可能企業のみ true", () => {
    expect(externalCanReceiveCompanyNotification(["c-1", "c-2"], "c-1")).toBe(true);
    expect(externalCanReceiveCompanyNotification(["c-1", "c-2"], "c-3")).toBe(false);
  });
  it("アクセス無しは false", () => {
    expect(externalCanReceiveCompanyNotification([], "c-1")).toBe(false);
  });
});
