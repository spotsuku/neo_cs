import { describe, it, expect } from "vitest";
import { computeCccBreakdown } from "./breakdown";

describe("computeCccBreakdown", () => {
  it("全シグナルが満点近傍なら overallStatus=healthy / Retention high", () => {
    const r = computeCccBreakdown({
      companyId: "c1",
      attendance: 1.0,
      weeksSinceLastTouch: 0,
      churnSignalCount: 0,
      meetingLogCount: 10,
      weeklyReviewSubmissionRate: 1.0,
      vocItemCount: 0, // Support 反転で 100
      surveyScore: 100,
      newParticipantCount: 5,
      referralCount: 3,
      engagementTier: "core"
    });
    expect(r.overallStatus).toBe("healthy");
    expect(r.overallScore).toBeGreaterThanOrEqual(70);
    expect(r.pillars.retention.confidence).toBe("high");
    expect(r.pillars.retention.status).toBe("healthy");
    expect(r.engagementTier).toBe("core");
  });

  it("全シグナルが悪値なら overallStatus=risk", () => {
    const r = computeCccBreakdown({
      companyId: "c2",
      attendance: 0,
      weeksSinceLastTouch: 12,
      churnSignalCount: 8,
      meetingLogCount: 0,
      weeklyReviewSubmissionRate: 0,
      vocItemCount: 15, // Support は 0 / Relevance は 100 だが高すぎても他が悪い
      surveyScore: 0,
      newParticipantCount: 0,
      referralCount: 0,
      engagementTier: "at_risk"
    });
    expect(r.overallStatus).toBe("risk");
    expect(r.overallScore).toBeLessThan(40);
    expect(r.pillars.retention.status).toBe("risk");
    expect(r.pillars.support.status).toBe("risk");
  });

  it("シグナルがほぼ null なら全柱が低信頼 (low) で中央 50 寄り", () => {
    const r = computeCccBreakdown({
      companyId: "c3"
    });
    // 全柱とも safe default=50
    expect(r.pillars.retention.confidence).toBe("low");
    expect(r.pillars.contribution.confidence).toBe("low");
    expect(r.pillars.support.confidence).toBe("low");
    expect(r.pillars.growth.confidence).toBe("low");
    expect(r.pillars.relevance.confidence).toBe("low");
    expect(r.overallScore).toBe(50);
    expect(r.overallStatus).toBe("watch");
    expect(r.engagementTier).toBeNull();
  });

  it("Retention 1 シグナルだけなら med 信頼度", () => {
    const r = computeCccBreakdown({
      companyId: "c4",
      attendance: 0.9
    });
    expect(r.pillars.retention.confidence).toBe("med");
    expect(r.pillars.retention.score).toBe(90);
  });
});
