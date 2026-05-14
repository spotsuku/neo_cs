import { describe, it, expect } from "vitest";
import { periodFor, computeMrr, formatYen, formatPct } from "./kpi";
import type { Contract } from "@/lib/mock/contracts";

// 注: contracts は最小限のフィールドだけ持てばよい (kpi は status/start/end/mrr/product のみ参照)
function mkContract(p: Partial<Contract> & Pick<Contract, "id" | "product">): Contract {
  return {
    id: p.id,
    companyId: p.companyId ?? "co-x",
    product: p.product,
    courseKey: p.courseKey ?? "default",
    cycleNumber: p.cycleNumber ?? 1,
    startDate: p.startDate ?? "2026-04-01",
    endDate: p.endDate,
    mrr: p.mrr ?? 100_000,
    status: p.status ?? "active",
    healthScore: p.healthScore,
    ownerName: p.ownerName ?? "test",
    revenue: p.revenue ?? 1_200_000,
    participants: p.participants ?? 5
  } as Contract;
}

describe("periodFor — Q1=FY 不具合の回帰テスト", () => {
  it("【REGRESSION】 thisQuarter (Q1) と thisFY は別の窓を返す", () => {
    // Q1=4-6月。FY26は2026-04-01 〜 2027-04-01。同一窓ではいけない
    const q = periodFor("thisQuarter", "2026-04-15");
    const fy = periodFor("thisFY", "2026-04-15");
    expect(q.from).toBe("2026-04-01");
    expect(q.to).toBe("2026-07-01"); // ★ Q1 は 3ヶ月窓
    expect(fy.from).toBe("2026-04-01");
    expect(fy.to).toBe("2027-04-01"); // ★ FY は 12ヶ月窓
    expect(q.to).not.toBe(fy.to);
  });

  it("Q2 (7月)", () => {
    const q = periodFor("thisQuarter", "2026-08-15");
    expect(q.from).toBe("2026-07-01");
    expect(q.to).toBe("2026-10-01");
    expect(q.label).toContain("Q2");
  });

  it("Q3 (10月)", () => {
    const q = periodFor("thisQuarter", "2026-11-30");
    expect(q.from).toBe("2026-10-01");
    expect(q.to).toBe("2027-01-01");
    expect(q.label).toContain("Q3");
  });

  it("Q4 (1月: 翌暦年だが同FY)", () => {
    const q = periodFor("thisQuarter", "2027-02-15");
    expect(q.from).toBe("2027-01-01");
    expect(q.to).toBe("2027-04-01");
    expect(q.label).toContain("Q4");
    expect(q.label).toContain("FY27");
  });
});

describe("periodFor — 各期間", () => {
  it("thisMonth: 月初〜翌月初", () => {
    const p = periodFor("thisMonth", "2026-05-15");
    expect(p.from).toBe("2026-05-01");
    expect(p.to).toBe("2026-06-01");
  });

  it("last30d: asOf-30 から asOf+1 まで", () => {
    const p = periodFor("last30d", "2026-05-15");
    expect(p.from).toBe("2026-04-15");
    expect(p.to).toBe("2026-05-16");
  });

  it("thisFY: 3月時点は前年4月始まり (会計年度)", () => {
    const p = periodFor("thisFY", "2026-03-15");
    expect(p.from).toBe("2025-04-01");
    expect(p.to).toBe("2026-04-01");
    expect(p.label).toContain("FY26");
  });
});

describe("computeMrr", () => {
  it("active 契約の mrr のみ合算 (churned/renewed 除外)", () => {
    const r = computeMrr(
      [
        mkContract({ id: "1", product: "academia", mrr: 100_000, status: "active" }),
        mkContract({ id: "2", product: "academia", mrr: 50_000, status: "churned" }),
        mkContract({ id: "3", product: "hyogikai", mrr: 200_000, status: "active" })
      ],
      "2026-05-01"
    );
    expect(r.totalMrr).toBe(300_000);
    expect(r.byProduct.academia).toBe(100_000);
    expect(r.byProduct.hyogikai).toBe(200_000);
    expect(r.contractCount).toBe(2);
  });

  it("単発(mrr=0) は集計対象外", () => {
    const r = computeMrr(
      [mkContract({ id: "1", product: "aiken", mrr: 0, status: "active" })],
      "2026-05-01"
    );
    expect(r.totalMrr).toBe(0);
    expect(r.contractCount).toBe(0);
  });

  it("startDate が asOf より未来の契約は除外", () => {
    const r = computeMrr(
      [mkContract({ id: "1", product: "academia", mrr: 100_000, startDate: "2026-12-01" })],
      "2026-05-01"
    );
    expect(r.totalMrr).toBe(0);
  });

  it("セグメント分け: 30万以上=large / 15万〜=mid / それ未満=small", () => {
    const r = computeMrr(
      [
        mkContract({ id: "1", product: "academia", mrr: 400_000 }),
        mkContract({ id: "2", product: "hyogikai", mrr: 200_000 }),
        mkContract({ id: "3", product: "commu", mrr: 80_000 })
      ],
      "2026-05-01"
    );
    expect(r.bySegment.large).toBe(400_000);
    expect(r.bySegment.mid).toBe(200_000);
    expect(r.bySegment.small).toBe(80_000);
  });
});

describe("format helpers", () => {
  it("formatYen は数値を日本円表記の文字列にする", () => {
    const out = formatYen(1_234_567);
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
    // 円表記いずれか (¥1,234,567 または 123万円 等)
    expect(out).toMatch(/円|¥/);
  });
  it("formatPct (1桁)", () => {
    expect(formatPct(0.12345)).toBe("12.3%");
    expect(formatPct(0.5, 0)).toBe("50%");
  });
});
