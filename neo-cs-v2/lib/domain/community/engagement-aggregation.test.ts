import { describe, it, expect } from "vitest";
import { aggregateEngagementTier } from "./engagement-aggregation";

describe("aggregateEngagementTier — 案 B (ハイブリッド)", () => {
  it("空配列は null", () => {
    expect(aggregateEngagementTier([])).toBe(null);
  });

  it("全員 null は null", () => {
    expect(
      aggregateEngagementTier([
        { engagementTier: null },
        { engagementTier: null }
      ])
    ).toBe(null);
  });

  it("core 1 人 + active 過半数 → core (本格パートナー)", () => {
    // core=1, active=2, casual=0, at_risk=0 (total=3, core+active=3 > 1.5)
    expect(
      aggregateEngagementTier([
        { engagementTier: "core" },
        { engagementTier: "active" },
        { engagementTier: "active" }
      ])
    ).toBe("core");
  });

  it("core 1 人 + 他全員 at_risk → active (スターリーダー依存の罠を可視化)", () => {
    // core=1, active=0, at_risk=4 (total=5, core+active=1 vs 5)
    // → 過半数を満たさない → active も満たさない → casual も満たさない → at_risk
    const result = aggregateEngagementTier([
      { engagementTier: "core" },
      { engagementTier: "at_risk" },
      { engagementTier: "at_risk" },
      { engagementTier: "at_risk" },
      { engagementTier: "at_risk" }
    ]);
    expect(result).toBe("at_risk");
  });

  it("active が過半数だが core 不在 → active", () => {
    // core=0, active=3, casual=2 (total=5, active=3 > 2.5)
    expect(
      aggregateEngagementTier([
        { engagementTier: "active" },
        { engagementTier: "active" },
        { engagementTier: "active" },
        { engagementTier: "casual" },
        { engagementTier: "casual" }
      ])
    ).toBe("active");
  });

  it("casual が過半数 → casual", () => {
    // active=1, casual=3, at_risk=1 (total=5, active+casual=4 > 2.5)
    expect(
      aggregateEngagementTier([
        { engagementTier: "active" },
        { engagementTier: "casual" },
        { engagementTier: "casual" },
        { engagementTier: "casual" },
        { engagementTier: "at_risk" }
      ])
    ).toBe("casual");
  });

  it("半数以上 at_risk → at_risk", () => {
    expect(
      aggregateEngagementTier([
        { engagementTier: "at_risk" },
        { engagementTier: "at_risk" },
        { engagementTier: "at_risk" },
        { engagementTier: "casual" }
      ])
    ).toBe("at_risk");
  });

  it("null は母数から除外", () => {
    // measured: core=1, active=1 (null は除外)。total=2, core+active=2 > 1
    // → core 1 人かつ過半数満たす → core
    expect(
      aggregateEngagementTier([
        { engagementTier: "core" },
        { engagementTier: "active" },
        { engagementTier: null },
        { engagementTier: null }
      ])
    ).toBe("core");
  });

  it("ちょうど半数 (2/4) は過半数ではない — active 2 + casual 2 → casual", () => {
    // active+core=2, total=4 → 2*2=4 は >4 でない → active 不可
    // casualOrAbove=4 > 2 → casual
    expect(
      aggregateEngagementTier([
        { engagementTier: "active" },
        { engagementTier: "active" },
        { engagementTier: "casual" },
        { engagementTier: "casual" }
      ])
    ).toBe("casual");
  });
});
