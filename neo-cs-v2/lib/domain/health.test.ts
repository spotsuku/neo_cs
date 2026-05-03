import { describe, it, expect } from "vitest";
import {
  computeHealthScore,
  deriveMockFactors,
  colorOfScore,
  colorScore
} from "./health";

describe("computeHealthScore", () => {
  it("全因子が満点なら 100 / green", () => {
    const r = computeHealthScore({
      attendance: 1.0,
      weeksSinceLastTouch: 0,
      overdueOnboardingTasks: 0,
      negativeSignalCount: 0,
      milestoneProgress: 1.0
    });
    expect(r.score).toBe(100);
    expect(r.color).toBe("green");
  });

  it("全因子が最悪なら 0 / red", () => {
    const r = computeHealthScore({
      attendance: 0,
      weeksSinceLastTouch: 20,
      overdueOnboardingTasks: 10,
      negativeSignalCount: 10,
      milestoneProgress: 0
    });
    expect(r.score).toBe(0);
    expect(r.color).toBe("red");
  });

  it("欠損(undefined)は中立フォールバックで処理される", () => {
    const r = computeHealthScore({});
    // 全部 70/80 程度の中立値 → 70 前後
    expect(r.score).toBeGreaterThan(60);
    expect(r.score).toBeLessThan(85);
  });

  it("色閾値: 75/55 で green/yellow/red 切替", () => {
    expect(colorOfScore(75)).toBe("green");
    expect(colorOfScore(74)).toBe("yellow");
    expect(colorOfScore(55)).toBe("yellow");
    expect(colorOfScore(54)).toBe("red");
  });

  it("contributions は 5 因子分そろい、weight 合計 100", () => {
    const r = computeHealthScore({});
    expect(r.contributions).toHaveLength(5);
    const sum = r.contributions.reduce((s, c) => s + c.weight, 0);
    expect(sum).toBe(100);
  });

  it("topNegative は最も寄与損失の大きい因子", () => {
    const r = computeHealthScore({
      attendance: 0.95,
      weeksSinceLastTouch: 0,
      overdueOnboardingTasks: 0,
      negativeSignalCount: 0,
      milestoneProgress: 0 // 最低 (weight 15)
    });
    expect(r.topNegative?.key).toBe("milestoneProgress");
  });

  it("topNegative は normalizedScore < 75 がない場合 null", () => {
    const r = computeHealthScore({
      attendance: 1.0,
      weeksSinceLastTouch: 0,
      overdueOnboardingTasks: 0,
      negativeSignalCount: 0,
      milestoneProgress: 0.95
    });
    expect(r.topNegative).toBeNull();
  });
});

describe("deriveMockFactors (決定論性)", () => {
  it("同じ contractId は何度呼んでも同じ factor", () => {
    const a = deriveMockFactors({ contractId: "c-001", product: "academia", baselineColor: "yellow" });
    const b = deriveMockFactors({ contractId: "c-001", product: "academia", baselineColor: "yellow" });
    expect(a).toEqual(b);
  });

  it("baselineColor=green は overdue=0, neg=0 (ほぼ)", () => {
    const f = deriveMockFactors({ contractId: "c-green", product: "academia", baselineColor: "green" });
    expect(f.overdueOnboardingTasks).toBe(0);
    expect(f.attendance).toBeGreaterThanOrEqual(0.88);
  });

  it("baselineColor=red は overdue ≥ 3, neg ≥ 2", () => {
    const f = deriveMockFactors({ contractId: "c-red", product: "academia", baselineColor: "red" });
    expect(f.overdueOnboardingTasks!).toBeGreaterThanOrEqual(3);
    expect(f.negativeSignalCount!).toBeGreaterThanOrEqual(2);
    expect(f.attendance!).toBeLessThan(0.7);
  });
});

describe("colorScore", () => {
  it.each([
    ["green", 85],
    ["yellow", 65],
    ["red", 40]
  ] as const)("%s → %i", (color, expected) => {
    expect(colorScore(color)).toBe(expected);
  });

  it("undefined は null", () => {
    expect(colorScore(undefined)).toBeNull();
  });
});
