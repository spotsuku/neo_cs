import { describe, it, expect } from "vitest";
import {
  checkCompanyCompleteness,
  completenessLevel,
  type CompanyCompletenessInput
} from "./completeness";

const baseInput = (): CompanyCompletenessInput => ({
  company: { id: "c-test" },
  contacts: [],
  contracts: [],
  assignments: [],
  onboarding: { taskCount: 0 },
  stakeholders: []
});

const fullyFilled = (): CompanyCompletenessInput => ({
  company: {
    id: "c-test",
    name: "テスト株式会社",
    industry: "IT",
    size: 500,
    website: "https://example.com",
    legalNumber: "1234567890123"
  },
  contacts: [
    {
      isPrimary: true,
      name: "田中太郎",
      email: "tanaka@example.com",
      title: "部長",
      slackId: "U123"
    }
  ],
  contracts: [
    {
      status: "active",
      courseKey: "basic",
      mrr: 300_000,
      startDate: "2026-01-01",
      endDate: "2026-12-31"
    }
  ],
  assignments: [
    { role: "primary" },
    { role: "sales_owner" }
  ],
  onboarding: { taskCount: 3 },
  stakeholders: [{ type: "champion" }],
  drive: { folderUrl: "https://drive.google.com/folder/abc" },
  postHandoff: true
});

describe("checkCompanyCompleteness", () => {
  it("空入力では score=0、すべて未入力 (drive はスコア対象外)", () => {
    const r = checkCompanyCompleteness(baseInput());
    expect(r.score).toBe(0);
    expect(r.filledCount).toBe(0);
    // 必須17項目 (drive と sales_owner は除外)
    expect(r.totalCount).toBeGreaterThan(15);
    // drive 項目は items に含まれるが scoreOptional=true
    const drive = r.items.find((i) => i.key === "drive.folderUrl");
    expect(drive?.scoreOptional).toBe(true);
  });

  it("フル入力では score=100", () => {
    const r = checkCompanyCompleteness(fullyFilled());
    expect(r.score).toBe(100);
    expect(r.filledCount).toBe(r.totalCount);
  });

  it("会社名/業種だけ入力 → 部分スコア", () => {
    const input = baseInput();
    input.company.name = "X社";
    input.company.industry = "金融";
    const r = checkCompanyCompleteness(input);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(50);
    expect(r.missingByCategory.basic.length).toBeGreaterThan(0);
  });

  it("contracts が無い場合 contract カテゴリ全項目が未入力", () => {
    const r = checkCompanyCompleteness(baseInput());
    expect(r.missingByCategory.contract.length).toBe(4);
  });

  it("active 契約があれば hasActive が filled になる", () => {
    const input = baseInput();
    input.contracts = [{ status: "active", courseKey: "k1", mrr: 100, startDate: "2026-01-01", endDate: "2026-12-31" }];
    const r = checkCompanyCompleteness(input);
    const hasActive = r.items.find((i) => i.key === "contract.hasActive");
    expect(hasActive?.filled).toBe(true);
  });

  it("renewed/churned は active として扱わない", () => {
    const input = baseInput();
    input.contracts = [{ status: "churned", courseKey: "k1", mrr: 100 }];
    const r = checkCompanyCompleteness(input);
    expect(r.items.find((i) => i.key === "contract.hasActive")?.filled).toBe(false);
  });

  it("内諾前 (postHandoff=false) は sales_owner 未指定でも自動充足", () => {
    const input = baseInput();
    input.postHandoff = false;
    const r = checkCompanyCompleteness(input);
    const so = r.items.find((i) => i.key === "assign.salesOwner");
    expect(so?.filled).toBe(true);
    expect(so?.scoreOptional).toBe(true);
  });

  it("内諾後は sales_owner 必須", () => {
    const input = baseInput();
    input.postHandoff = true;
    const r = checkCompanyCompleteness(input);
    const so = r.items.find((i) => i.key === "assign.salesOwner");
    expect(so?.filled).toBe(false);
    expect(so?.scoreOptional).toBe(false);
  });

  it("assignments 未提供時は fallbackPrimaryOwnerName を primary CS とみなす", () => {
    const input = baseInput();
    input.assignments = undefined;
    input.fallbackPrimaryOwnerName = "古野";
    const r = checkCompanyCompleteness(input);
    expect(r.items.find((i) => i.key === "assign.primaryCs")?.filled).toBe(true);
  });

  it("unassigned された primary は filled とみなさない", () => {
    const input = baseInput();
    input.assignments = [{ role: "primary", unassignedAt: "2026-04-01" }];
    const r = checkCompanyCompleteness(input);
    expect(r.items.find((i) => i.key === "assign.primaryCs")?.filled).toBe(false);
  });

  it("Champion stakeholder で onboard.champion が filled", () => {
    const input = baseInput();
    input.stakeholders = [{ type: "champion" }];
    const r = checkCompanyCompleteness(input);
    expect(r.items.find((i) => i.key === "onboard.champion")?.filled).toBe(true);
  });

  it("missingByCategory はカテゴリ別に未入力項目を集約", () => {
    const r = checkCompanyCompleteness(baseInput());
    expect(r.missingByCategory.basic.length).toBe(5);
    expect(r.missingByCategory.contact.length).toBe(4);
  });

  it("primary 指定が無ければ最初の contact をフォールバック", () => {
    const input = baseInput();
    input.contacts = [{ name: "A", email: "a@x.jp" }];
    const r = checkCompanyCompleteness(input);
    expect(r.items.find((i) => i.key === "contact.primaryName")?.filled).toBe(true);
    expect(r.items.find((i) => i.key === "contact.email")?.filled).toBe(true);
  });
});

describe("completenessLevel", () => {
  it("80以上は high", () => expect(completenessLevel(80)).toBe("high"));
  it("50-79 は medium", () => {
    expect(completenessLevel(50)).toBe("medium");
    expect(completenessLevel(79)).toBe("medium");
  });
  it("50未満は low", () => expect(completenessLevel(49)).toBe("low"));
});
