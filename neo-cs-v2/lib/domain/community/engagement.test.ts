import { describe, it, expect } from "vitest";
import {
  classifyEngagement,
  computeEngagement,
  tallyByTier,
  type EngagementTouch
} from "./engagement";

const ASOF = "2026-04-24";

function touchesAtDays(days: number[]): EngagementTouch[] {
  // ASOF からの相対日数を ISO 日付に変換
  const baseMs = Date.parse(ASOF);
  return days.map((d) => ({
    occurredAt: new Date(baseMs - d * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
    kind: "meeting" as const
  }));
}

describe("classifyEngagement — 4 区分の境界", () => {
  it("30日内 3件 → core", () => {
    expect(classifyEngagement({ touchCount30d: 3, touchCount90d: 5 })).toBe("core");
  });
  it("30日内 2件 → active (core 未満)", () => {
    expect(classifyEngagement({ touchCount30d: 2, touchCount90d: 5 })).toBe("active");
  });
  it("30日内 1件 → active", () => {
    expect(classifyEngagement({ touchCount30d: 1, touchCount90d: 1 })).toBe("active");
  });
  it("30日内 0件 / 90日内 1件 → casual", () => {
    expect(classifyEngagement({ touchCount30d: 0, touchCount90d: 1 })).toBe("casual");
  });
  it("30日内 0件 / 90日内 0件 → at_risk", () => {
    expect(classifyEngagement({ touchCount30d: 0, touchCount90d: 0 })).toBe("at_risk");
  });
});

describe("computeEngagement — 入力 → 4 区分判定", () => {
  it("30日内 3件 (5/15/25日前) → core", () => {
    const r = computeEngagement({ touches: touchesAtDays([5, 15, 25]), asOf: ASOF });
    expect(r.suggestedTier).toBe("core");
    expect(r.tier).toBe("core");
    expect(r.touchCount30d).toBe(3);
    expect(r.touchCount90d).toBe(3);
    expect(r.score).toBeGreaterThan(0);
    expect(r.lastTouchAt).toBeTruthy();
  });

  it("30日内 1件 → active", () => {
    const r = computeEngagement({ touches: touchesAtDays([10]), asOf: ASOF });
    expect(r.suggestedTier).toBe("active");
  });

  it("30日内 0件 / 31〜90日内 1件 → casual", () => {
    const r = computeEngagement({ touches: touchesAtDays([45]), asOf: ASOF });
    expect(r.suggestedTier).toBe("casual");
    expect(r.touchCount30d).toBe(0);
    expect(r.touchCount90d).toBe(1);
  });

  it("touches 空 → at_risk / lastTouchAt=null / score=0", () => {
    const r = computeEngagement({ touches: [], asOf: ASOF });
    expect(r.suggestedTier).toBe("at_risk");
    expect(r.lastTouchAt).toBeNull();
    expect(r.touchCount30d).toBe(0);
    expect(r.touchCount90d).toBe(0);
    expect(r.score).toBe(0);
  });

  it("90日以前のみ → at_risk", () => {
    const r = computeEngagement({ touches: touchesAtDays([120, 200]), asOf: ASOF });
    expect(r.suggestedTier).toBe("at_risk");
    expect(r.touchCount30d).toBe(0);
    expect(r.touchCount90d).toBe(0);
  });

  it("overrideTier が指定されたら tier はそれを優先 / suggested は自動値", () => {
    const r = computeEngagement({
      touches: touchesAtDays([5, 15, 25]),
      asOf: ASOF,
      overrideTier: "casual"
    });
    expect(r.suggestedTier).toBe("core"); // 自動は core
    expect(r.tier).toBe("casual"); // 手動上書き
  });

  it("不正な日付は無視される", () => {
    const r = computeEngagement({
      touches: [
        ...touchesAtDays([5]),
        { occurredAt: "not-a-date", kind: "other" }
      ],
      asOf: ASOF
    });
    expect(r.touchCount30d).toBe(1);
  });

  it("lastTouchAt は最も新しい接点", () => {
    const r = computeEngagement({ touches: touchesAtDays([45, 5, 25]), asOf: ASOF });
    // 5日前 = ASOF-5 日
    const expected = new Date(Date.parse(ASOF) - 5 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    expect(r.lastTouchAt).toBe(expected);
  });

  it("接点記録なしのときは reasons に '接点記録なし' を含む", () => {
    const r = computeEngagement({ touches: [], asOf: ASOF });
    expect(r.reasons).toContain("接点記録なし");
  });

  it("30日内接点ありのときは件数 + 最終接点日数の reason が生成される", () => {
    const r = computeEngagement({ touches: touchesAtDays([5, 10, 20]), asOf: ASOF });
    expect(r.reasons.some((s) => s.includes("直近30日に 3 件"))).toBe(true);
    expect(r.reasons.some((s) => s.includes("最終接点 5 日前"))).toBe(true);
  });

  it("override と suggestedTier が乖離しているときは差分の reason が出る", () => {
    const r = computeEngagement({
      touches: touchesAtDays([1, 2, 3, 4]),
      asOf: ASOF,
      overrideTier: "casual"
    });
    expect(r.suggestedTier).toBe("core");
    expect(r.tier).toBe("casual");
    expect(
      r.reasons.some(
        (s) => s.includes("手動で casual に設定済") && s.includes("自動算出は core")
      )
    ).toBe(true);
  });
});

describe("tallyByTier", () => {
  it("tier ごとの件数を集計", () => {
    const rows = [
      { tier: "core" as const },
      { tier: "core" as const },
      { tier: "active" as const },
      { tier: "at_risk" as const }
    ];
    const t = tallyByTier(rows);
    expect(t.core).toBe(2);
    expect(t.active).toBe(1);
    expect(t.casual).toBe(0);
    expect(t.at_risk).toBe(1);
  });
});
