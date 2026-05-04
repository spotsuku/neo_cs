import { describe, it, expect } from "vitest";
import {
  validatePayload,
  mapToCompanyData,
  mapToContactData,
  mapToContractData,
  computeEndDate,
} from "./sales-handoff";

const baseInput = {
  salesDealId: "deal_abc",
  company: { name: "サンプル株式会社", industry: "金融", size: "100-300", website: "https://x.example" },
  primaryContact: { name: "山田太郎", email: "y@x.example", role: "部長", phone: "090-0000-0000" },
  contract: {
    productCode: "academia",
    courseCode: "pjt",
    startDate: "2026-06-01",
    termMonths: 12,
    amountJpy: 1200000,
  },
  salesOwner: { email: "sales@neo.example" },
  notes: "決裁者は社長",
  occurredAt: "2026-05-04T03:00:00Z",
};

describe("validatePayload", () => {
  it("正常系", () => {
    const r = validatePayload(baseInput);
    expect(r.ok).toBe(true);
  });

  it("salesDealId 欠落で fail", () => {
    const r = validatePayload({ ...baseInput, salesDealId: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(",")).toMatch(/salesDealId/);
  });

  it("不明な productCode は弾く", () => {
    const r = validatePayload({
      ...baseInput,
      contract: { ...baseInput.contract, productCode: "unknown" },
    });
    expect(r.ok).toBe(false);
  });

  it("startDate が ISO date でないと fail", () => {
    const r = validatePayload({
      ...baseInput,
      contract: { ...baseInput.contract, startDate: "2026/6/1" },
    });
    expect(r.ok).toBe(false);
  });

  it("termMonths が負数だと fail", () => {
    const r = validatePayload({
      ...baseInput,
      contract: { ...baseInput.contract, termMonths: -3 },
    });
    expect(r.ok).toBe(false);
  });

  it("primaryContact.name 必須", () => {
    const r = validatePayload({ ...baseInput, primaryContact: { name: "" } });
    expect(r.ok).toBe(false);
  });

  it("オブジェクトじゃない入力", () => {
    expect(validatePayload(null).ok).toBe(false);
    expect(validatePayload("hi").ok).toBe(false);
  });
});

describe("mapToCompanyData", () => {
  it("memo にサイズ/website/notes を集約する", () => {
    const r = validatePayload(baseInput);
    if (!r.ok) throw new Error("invalid");
    const c = mapToCompanyData(r.data);
    expect(c.name).toBe("サンプル株式会社");
    expect(c.industry).toBe("金融");
    expect(c.memo).toMatch(/従業員規模/);
    expect(c.memo).toMatch(/Website/);
    expect(c.memo).toMatch(/営業引継ぎメモ/);
  });
});

describe("mapToContactData", () => {
  it("primary=true で正規化", () => {
    const r = validatePayload(baseInput);
    if (!r.ok) throw new Error("invalid");
    const c = mapToContactData(r.data);
    expect(c.is_primary).toBe(true);
    expect(c.email).toBe("y@x.example");
    expect(c.title).toBe("部長");
  });
});

describe("mapToContractData", () => {
  it("status='handoff' + end_date 計算", () => {
    const r = validatePayload(baseInput);
    if (!r.ok) throw new Error("invalid");
    const c = mapToContractData(r.data);
    expect(c.status).toBe("handoff");
    expect(c.start_date).toBe("2026-06-01");
    expect(c.end_date).toBe("2027-05-31"); // 開始6/1 + 12ヶ月 - 1日 = 翌年5/31
    expect(c.total_revenue).toBe(1200000);
    expect(c.product_code).toBe("academia");
  });

  it("termMonths null なら end_date も null", () => {
    const r = validatePayload({
      ...baseInput,
      contract: { ...baseInput.contract, termMonths: null },
    });
    if (!r.ok) throw new Error("invalid");
    const c = mapToContractData(r.data);
    expect(c.end_date).toBeNull();
  });
});

describe("computeEndDate", () => {
  it("基本: 6/1 + 12ヶ月 = 翌年5/31", () => {
    expect(computeEndDate("2026-06-01", 12)).toBe("2027-05-31");
  });
  it("月末丸め: 1/31 + 1ヶ月 → 2/28 → -1日 = 2/27 (2026年は平年)", () => {
    expect(computeEndDate("2026-01-31", 1)).toBe("2026-02-27");
  });
  it("年跨ぎ: 12/15 + 6ヶ月 = 翌年6/15 → -1日 = 6/14", () => {
    expect(computeEndDate("2026-12-15", 6)).toBe("2027-06-14");
  });
  it("不正フォーマットは null", () => {
    expect(computeEndDate("bad", 12)).toBeNull();
  });
});
