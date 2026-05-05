// 権限ヘルパの単体テスト
//
// 純関数の境界条件を網羅的に確認。
//   - effectiveRole（admin の表示モード切替）
//   - programScopeRole / canEditProgress / canEditProgramTemplate / canViewProgram
//   - canSeeManagerView
//   - canEditGlobalSettings / canManageUsers
//   - canViewCompany / canSeeCompanyProgressTabs（external のアクセス制限）

import { describe, it, expect } from "vitest";
import {
  effectiveRole,
  programScopeRole,
  canSeeManagerView,
  canViewProgram,
  canEditProgress,
  canEditProgramTemplate,
  canEditGlobalSettings,
  canManageUsers,
  canViewCompany,
  canSeeCompanyProgressTabs,
  type PermissionContext
} from "./permissions";
import type {
  AppUser,
  AppUserRole,
  UserProgramRole,
  UserCompanyAccess,
  ProgramScopeRole
} from "@/lib/repository/types";

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

function programRole(
  productCode: string,
  scopeRole: ProgramScopeRole,
  userId = "u-1"
): UserProgramRole {
  return {
    userId,
    organizationId: "org-1",
    productCode,
    scopeRole,
    assignedAt: NOW
  };
}

function companyAccess(companyId: string, userId = "u-1"): UserCompanyAccess {
  return {
    userId,
    organizationId: "org-1",
    companyId,
    grantedAt: NOW
  };
}

function ctx(
  actor: AppUser | null,
  overrides: Partial<PermissionContext> = {}
): PermissionContext {
  return {
    actor,
    programs: overrides.programs ?? [],
    companyAccess: overrides.companyAccess ?? [],
    viewModeOverride: overrides.viewModeOverride
  };
}

// ─────────────────────────────────────────────
// effectiveRole
// ─────────────────────────────────────────────
describe("effectiveRole", () => {
  it("未認証は viewer 扱い", () => {
    expect(effectiveRole(ctx(null))).toBe("viewer");
  });

  it("admin は viewModeOverride で表示モード切替できる", () => {
    expect(effectiveRole(ctx(user("admin"), { viewModeOverride: "manager" }))).toBe("manager");
    expect(effectiveRole(ctx(user("admin"), { viewModeOverride: "member" }))).toBe("member");
  });

  it("admin で override 無しなら admin", () => {
    expect(effectiveRole(ctx(user("admin")))).toBe("admin");
  });

  it("admin 以外は override を無視する", () => {
    expect(effectiveRole(ctx(user("manager"), { viewModeOverride: "member" }))).toBe("manager");
    expect(effectiveRole(ctx(user("member"), { viewModeOverride: "manager" }))).toBe("member");
    expect(effectiveRole(ctx(user("external"), { viewModeOverride: "manager" }))).toBe("external");
  });
});

// ─────────────────────────────────────────────
// programScopeRole
// ─────────────────────────────────────────────
describe("programScopeRole", () => {
  it("admin は常に template_editor 相当", () => {
    expect(programScopeRole(ctx(user("admin")), "academia")).toBe("template_editor");
    expect(programScopeRole(ctx(user("admin")), "any-product")).toBe("template_editor");
  });

  it("manager / member は user_program_roles に従う", () => {
    const c = ctx(user("manager"), {
      programs: [programRole("academia", "editor"), programRole("aiken", "viewer")]
    });
    expect(programScopeRole(c, "academia")).toBe("editor");
    expect(programScopeRole(c, "aiken")).toBe("viewer");
    expect(programScopeRole(c, "commu")).toBeNull();
  });

  it("未認証は null", () => {
    expect(programScopeRole(ctx(null), "academia")).toBeNull();
  });
});

// ─────────────────────────────────────────────
// canSeeManagerView
// ─────────────────────────────────────────────
describe("canSeeManagerView", () => {
  it("admin / manager は true", () => {
    expect(canSeeManagerView(ctx(user("admin")))).toBe(true);
    expect(canSeeManagerView(ctx(user("manager")))).toBe(true);
  });

  it("member / viewer / external は false", () => {
    expect(canSeeManagerView(ctx(user("member")))).toBe(false);
    expect(canSeeManagerView(ctx(user("viewer")))).toBe(false);
    expect(canSeeManagerView(ctx(user("external")))).toBe(false);
  });

  it("admin が「メンバー表示」モードなら false", () => {
    expect(canSeeManagerView(ctx(user("admin"), { viewModeOverride: "member" }))).toBe(false);
  });

  it("admin が「マネージャー表示」モードなら true", () => {
    expect(canSeeManagerView(ctx(user("admin"), { viewModeOverride: "manager" }))).toBe(true);
  });
});

// ─────────────────────────────────────────────
// canViewProgram / canEditProgress / canEditProgramTemplate
// ─────────────────────────────────────────────
describe("canViewProgram / canEditProgress / canEditProgramTemplate", () => {
  it("admin はすべて true", () => {
    const c = ctx(user("admin"));
    expect(canViewProgram(c, "academia")).toBe(true);
    expect(canEditProgress(c, "academia")).toBe(true);
    expect(canEditProgramTemplate(c, "academia")).toBe(true);
  });

  it("external は事業横断画面を見られない", () => {
    const c = ctx(user("external"));
    expect(canViewProgram(c, "academia")).toBe(false);
    expect(canEditProgress(c, "academia")).toBe(false);
    expect(canEditProgramTemplate(c, "academia")).toBe(false);
  });

  it("scope=viewer は閲覧のみ", () => {
    const c = ctx(user("member"), { programs: [programRole("academia", "viewer")] });
    expect(canViewProgram(c, "academia")).toBe(true);
    expect(canEditProgress(c, "academia")).toBe(false);
    expect(canEditProgramTemplate(c, "academia")).toBe(false);
  });

  it("scope=editor は項目編集可、テンプレ編集不可", () => {
    const c = ctx(user("member"), { programs: [programRole("academia", "editor")] });
    expect(canViewProgram(c, "academia")).toBe(true);
    expect(canEditProgress(c, "academia")).toBe(true);
    expect(canEditProgramTemplate(c, "academia")).toBe(false);
  });

  it("scope=template_editor は全部可", () => {
    const c = ctx(user("manager"), {
      programs: [programRole("academia", "template_editor")]
    });
    expect(canViewProgram(c, "academia")).toBe(true);
    expect(canEditProgress(c, "academia")).toBe(true);
    expect(canEditProgramTemplate(c, "academia")).toBe(true);
  });

  it("担当外事業はすべて false", () => {
    const c = ctx(user("member"), { programs: [programRole("academia", "editor")] });
    expect(canViewProgram(c, "aiken")).toBe(false);
    expect(canEditProgress(c, "aiken")).toBe(false);
    expect(canEditProgramTemplate(c, "aiken")).toBe(false);
  });
});

// ─────────────────────────────────────────────
// canEditGlobalSettings / canManageUsers
// ─────────────────────────────────────────────
describe("グローバル管理権限", () => {
  it("admin のみ true", () => {
    expect(canEditGlobalSettings(ctx(user("admin")))).toBe(true);
    expect(canManageUsers(ctx(user("admin")))).toBe(true);
  });

  it("manager / member / viewer / external は false", () => {
    for (const r of ["manager", "member", "viewer", "external"] as AppUserRole[]) {
      expect(canEditGlobalSettings(ctx(user(r)))).toBe(false);
      expect(canManageUsers(ctx(user(r)))).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────
// canViewCompany
// ─────────────────────────────────────────────
describe("canViewCompany", () => {
  it("社内ユーザー（admin/manager/member/viewer）は全企業閲覧可", () => {
    for (const r of ["admin", "manager", "member", "viewer"] as AppUserRole[]) {
      expect(canViewCompany(ctx(user(r)), "c-1")).toBe(true);
      expect(canViewCompany(ctx(user(r)), "c-2")).toBe(true);
    }
  });

  it("external は user_company_access にある企業のみ true", () => {
    const c = ctx(user("external"), { companyAccess: [companyAccess("c-1")] });
    expect(canViewCompany(c, "c-1")).toBe(true);
    expect(canViewCompany(c, "c-2")).toBe(false);
  });

  it("external でアクセス無しなら false", () => {
    expect(canViewCompany(ctx(user("external")), "c-1")).toBe(false);
  });

  it("未認証は false", () => {
    expect(canViewCompany(ctx(null), "c-1")).toBe(false);
  });
});

// ─────────────────────────────────────────────
// canSeeCompanyProgressTabs
// ─────────────────────────────────────────────
describe("canSeeCompanyProgressTabs", () => {
  it("admin は常に true", () => {
    expect(
      canSeeCompanyProgressTabs(ctx(user("admin")), {
        companyId: "c-1",
        productCodes: ["academia"]
      })
    ).toBe(true);
  });

  it("member: 担当事業の契約があれば true", () => {
    const c = ctx(user("member"), { programs: [programRole("academia", "editor")] });
    expect(
      canSeeCompanyProgressTabs(c, { companyId: "c-1", productCodes: ["academia"] })
    ).toBe(true);
  });

  it("member: 担当外事業のみの企業は false", () => {
    const c = ctx(user("member"), { programs: [programRole("academia", "editor")] });
    expect(
      canSeeCompanyProgressTabs(c, { companyId: "c-1", productCodes: ["aiken"] })
    ).toBe(false);
  });

  it("external: 自分のアクセス可能企業は true", () => {
    const c = ctx(user("external"), { companyAccess: [companyAccess("c-1")] });
    expect(
      canSeeCompanyProgressTabs(c, { companyId: "c-1", productCodes: ["any"] })
    ).toBe(true);
  });

  it("external: アクセス外企業は false", () => {
    const c = ctx(user("external"), { companyAccess: [companyAccess("c-1")] });
    expect(
      canSeeCompanyProgressTabs(c, { companyId: "c-2", productCodes: ["any"] })
    ).toBe(false);
  });
});
