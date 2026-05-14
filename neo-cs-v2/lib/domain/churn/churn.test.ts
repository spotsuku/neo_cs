import { describe, it, expect } from "vitest";
import {
  detectChurnSignals,
  aggregateContractRisk,
  compareSeverity,
  type DetectInput
} from "./churn";

const baseInput: DetectInput = {
  contractId: "c-1",
  companyId: "co-1",
  product: "academia",
  snapshots: [],
  recentMeetings: [],
  milestones: [],
  activityRecent: 10,
  activityBaseline: 10,
  asOf: "2026-05-03T00:00:00Z"
};

describe("detectChurnSignals — 6 ルール", () => {
  describe("1. score_drop", () => {
    it("4週で -15pt 以上で発火", () => {
      const r = detectChurnSignals({
        ...baseInput,
        snapshots: [
          { asOf: "2026-04-05", score: 80 },
          { asOf: "2026-04-12", score: 78 },
          { asOf: "2026-04-19", score: 75 },
          { asOf: "2026-04-26", score: 70 },
          { asOf: "2026-05-03", score: 60 }
        ]
      });
      expect(r.find((s) => s.rule === "score_drop")).toBeDefined();
    });

    it("snapshots が 5未満なら発火しない", () => {
      const r = detectChurnSignals({
        ...baseInput,
        snapshots: [
          { asOf: "2026-04-12", score: 100 },
          { asOf: "2026-05-03", score: 50 }
        ]
      });
      expect(r.find((s) => s.rule === "score_drop")).toBeUndefined();
    });

    it("delta -14pt 未満なら発火しない (境界)", () => {
      const r = detectChurnSignals({
        ...baseInput,
        snapshots: [
          { asOf: "2026-04-05", score: 70 },
          { asOf: "2026-04-12", score: 70 },
          { asOf: "2026-04-19", score: 70 },
          { asOf: "2026-04-26", score: 70 },
          { asOf: "2026-05-03", score: 56 } // -14
        ]
      });
      expect(r.find((s) => s.rule === "score_drop")).toBeUndefined();
    });
  });

  describe("2. score_low_streak", () => {
    it("3週連続 < 55 で発火", () => {
      const r = detectChurnSignals({
        ...baseInput,
        snapshots: [
          { asOf: "2026-04-19", score: 50 },
          { asOf: "2026-04-26", score: 48 },
          { asOf: "2026-05-03", score: 40 }
        ]
      });
      expect(r.find((s) => s.rule === "score_low_streak")).toBeDefined();
    });

    it("3週中1週でも 55 以上なら発火しない", () => {
      const r = detectChurnSignals({
        ...baseInput,
        snapshots: [
          { asOf: "2026-04-19", score: 50 },
          { asOf: "2026-04-26", score: 55 }, // 境界
          { asOf: "2026-05-03", score: 40 }
        ]
      });
      expect(r.find((s) => s.rule === "score_low_streak")).toBeUndefined();
    });
  });

  describe("3. consecutive_absence", () => {
    it("直近2回連続欠席で発火", () => {
      const r = detectChurnSignals({
        ...baseInput,
        recentMeetings: [
          { occurredAt: "2026-05-01", attended: false },
          { occurredAt: "2026-04-24", attended: false },
          { occurredAt: "2026-04-17", attended: true }
        ]
      });
      expect(r.find((s) => s.rule === "consecutive_absence")).toBeDefined();
    });

    it("直近のうち片方でも出席なら発火しない", () => {
      const r = detectChurnSignals({
        ...baseInput,
        recentMeetings: [
          { occurredAt: "2026-05-01", attended: true },
          { occurredAt: "2026-04-24", attended: false }
        ]
      });
      expect(r.find((s) => s.rule === "consecutive_absence")).toBeUndefined();
    });
  });

  describe("4. milestone_overdue", () => {
    it("T-60 todo + dueDate 過去で発火", () => {
      const r = detectChurnSignals({
        ...baseInput,
        milestones: [{ type: "T-60", dueDate: "2026-04-01", status: "todo" }]
      });
      expect(r.find((s) => s.rule === "milestone_overdue")).toBeDefined();
    });

    it("T-60 done なら発火しない", () => {
      const r = detectChurnSignals({
        ...baseInput,
        milestones: [{ type: "T-60", dueDate: "2026-04-01", status: "done" }]
      });
      expect(r.find((s) => s.rule === "milestone_overdue")).toBeUndefined();
    });

    it("T-60 が無い (T-90 のみ) なら発火しない", () => {
      const r = detectChurnSignals({
        ...baseInput,
        milestones: [{ type: "T-90", dueDate: "2026-04-01", status: "todo" }]
      });
      expect(r.find((s) => s.rule === "milestone_overdue")).toBeUndefined();
    });
  });

  describe("5. usage_drop", () => {
    it("ratio ≤ 0.5 で発火", () => {
      const r = detectChurnSignals({
        ...baseInput,
        activityRecent: 4,
        activityBaseline: 10
      });
      expect(r.find((s) => s.rule === "usage_drop")).toBeDefined();
    });

    it("baseline=0 では発火しない (ゼロ除算回避)", () => {
      const r = detectChurnSignals({
        ...baseInput,
        activityRecent: 0,
        activityBaseline: 0
      });
      expect(r.find((s) => s.rule === "usage_drop")).toBeUndefined();
    });
  });

  describe("6. survey_detractor", () => {
    it("NPS 0..6 で発火", () => {
      for (const n of [0, 3, 6]) {
        const r = detectChurnSignals({ ...baseInput, latestNpsScore: n });
        expect(r.find((s) => s.rule === "survey_detractor")).toBeDefined();
      }
    });

    it("NPS 7..10 では発火しない", () => {
      for (const n of [7, 8, 10]) {
        const r = detectChurnSignals({ ...baseInput, latestNpsScore: n });
        expect(r.find((s) => s.rule === "survey_detractor")).toBeUndefined();
      }
    });

    it("NPS undefined では発火しない", () => {
      const r = detectChurnSignals({ ...baseInput });
      expect(r.find((s) => s.rule === "survey_detractor")).toBeUndefined();
    });
  });

  it("各シグナルに id (cs-<contractId>-<rule>) が付与される", () => {
    const r = detectChurnSignals({ ...baseInput, latestNpsScore: 3 });
    expect(r[0].id).toBe("cs-c-1-survey_detractor");
  });
});

describe("aggregateContractRisk", () => {
  it("空配列なら totalWeight=0, topSeverity=null", () => {
    expect(aggregateContractRisk([])).toEqual({ totalWeight: 0, topSeverity: null });
  });

  it("総weight は 100 でクリップ", () => {
    const r = detectChurnSignals({
      ...baseInput,
      snapshots: [
        { asOf: "2026-04-05", score: 80 },
        { asOf: "2026-04-12", score: 78 },
        { asOf: "2026-04-19", score: 75 },
        { asOf: "2026-04-26", score: 70 },
        { asOf: "2026-05-03", score: 30 } // score_drop -50
      ],
      recentMeetings: [
        { occurredAt: "2026-05-01", attended: false },
        { occurredAt: "2026-04-24", attended: false }
      ],
      milestones: [{ type: "T-60", dueDate: "2026-04-01", status: "todo" }],
      activityRecent: 1,
      activityBaseline: 10,
      latestNpsScore: 3
    });
    const a = aggregateContractRisk(r);
    expect(a.totalWeight).toBe(100); // クリップ
    expect(a.topSeverity).toBe("high");
  });
});

describe("compareSeverity", () => {
  it("high > medium > low で降順ソート用", () => {
    const arr: ("high" | "medium" | "low")[] = ["low", "high", "medium"];
    arr.sort(compareSeverity);
    expect(arr).toEqual(["high", "medium", "low"]);
  });
});
