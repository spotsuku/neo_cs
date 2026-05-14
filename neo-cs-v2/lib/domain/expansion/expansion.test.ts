import { describe, it, expect } from "vitest";
import {
  detectExpansionOpportunities,
  EXPANSION_UPSELL_MULTIPLIER,
  type DetectExpansionInput
} from "./expansion";

const baseInput: DetectExpansionInput = {
  contractId: "ctr_001",
  companyId: "co_001",
  product: "academia",
  mrr: 100000,
  asOf: "2026-05-07",
  endDate: "2026-07-15", // T-90 圏内 (asOf からおよそ 69 日)
  snapshots: [
    { asOf: "2026-04-23", score: 88 },
    { asOf: "2026-04-30", score: 90 },
    { asOf: "2026-05-07", score: 92 }
  ],
  recentSurveyTexts: [],
  stakeholderHistory: [],
  participantCount: 0,
  participantCap: 0
};

describe("detectExpansionOpportunities", () => {
  it("健全継続 + 更新窓 green を両方検知する", () => {
    const result = detectExpansionOpportunities(baseInput);
    const rules = result.map((o) => o.rule).sort();
    expect(rules).toContain("healthy_streak");
    expect(rules).toContain("renewal_window_green");
  });

  it("score 79 連続なら healthy_streak は出ない (>=80 が要件)", () => {
    const result = detectExpansionOpportunities({
      ...baseInput,
      snapshots: [
        { asOf: "2026-04-23", score: 79 },
        { asOf: "2026-04-30", score: 79 },
        { asOf: "2026-05-07", score: 79 }
      ]
    });
    expect(result.find((o) => o.rule === "healthy_streak")).toBeUndefined();
  });

  it("更新窓 green の score 閾値は HEALTH_THRESHOLDS.green と同期", () => {
    // 直近 score 74 (= green 閾値 75 未満) なら検知されない
    const result = detectExpansionOpportunities({
      ...baseInput,
      snapshots: [{ asOf: "2026-05-07", score: 74 }]
    });
    expect(result.find((o) => o.rule === "renewal_window_green")).toBeUndefined();
  });

  it("受講枠 80% 以上で seat_at_capacity を検知し、推定MRR は乗数定数と一致", () => {
    const result = detectExpansionOpportunities({
      ...baseInput,
      snapshots: [{ asOf: "2026-05-07", score: 60 }], // healthy_streak / renewal を回避
      endDate: undefined,
      participantCount: 8,
      participantCap: 10
    });
    const seat = result.find((o) => o.rule === "seat_at_capacity");
    expect(seat).toBeDefined();
    expect(seat?.estimatedUpsellJpy).toBe(
      Math.round(100000 * EXPANSION_UPSELL_MULTIPLIER.seat_at_capacity)
    );
  });

  it("サーベイキーワード検出時の推定MRRは乗数定数と一致", () => {
    const result = detectExpansionOpportunities({
      ...baseInput,
      snapshots: [{ asOf: "2026-05-07", score: 60 }],
      endDate: undefined,
      recentSurveyTexts: ["他コースも気になります"]
    });
    const sig = result.find((o) => o.rule === "survey_signal");
    expect(sig).toBeDefined();
    expect(sig?.estimatedUpsellJpy).toBe(
      Math.round(100000 * EXPANSION_UPSELL_MULTIPLIER.survey_signal)
    );
  });
});
