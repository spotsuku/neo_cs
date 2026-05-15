import { describe, it, expect } from "vitest";
import { buildCommunityOverview } from "./overview";
import type { Stakeholder } from "@/lib/repository/types";

// テスト用の Stakeholder 生成ヘルパ (必須/任意フィールドの省略を許容)
function sh(partial: Partial<Stakeholder> & { id: string; companyId: string }): Stakeholder {
  return {
    id: partial.id,
    companyId: partial.companyId,
    name: partial.name ?? partial.id,
    role: partial.role ?? "担当",
    type: partial.type ?? "user",
    products: partial.products ?? [],
    activeFrom: partial.activeFrom ?? "2025-01-01",
    organizationId: "org-1",
    engagementTier: partial.engagementTier
  } as Stakeholder;
}

describe("buildCommunityOverview", () => {
  it("空入力でも全カウント 0 / リストは空配列", () => {
    const o = buildCommunityOverview({
      companies: [],
      stakeholders: [],
      stakeholderEngagement: {}
    });
    expect(o.tierCounts).toEqual({
      core: 0,
      active: 0,
      casual: 0,
      at_risk: 0,
      unmeasured: 0
    });
    expect(o.companyTierCounts).toEqual({
      core: 0,
      active: 0,
      casual: 0,
      at_risk: 0,
      unmeasured: 0
    });
    expect(o.promotionCandidates).toEqual([]);
    expect(o.atRiskCompanies).toEqual([]);
  });

  it("通常: tierCounts / companyTierCounts を tier ごとに集計", () => {
    const stakeholders: Stakeholder[] = [
      sh({ id: "s1", companyId: "c1", engagementTier: "core" }),
      sh({ id: "s2", companyId: "c1", engagementTier: "active" }),
      sh({ id: "s3", companyId: "c1", engagementTier: "active" }),
      sh({ id: "s4", companyId: "c2", engagementTier: "at_risk" }),
      sh({ id: "s5", companyId: "c2", engagementTier: "at_risk" }),
      sh({ id: "s6", companyId: "c3", engagementTier: null })
    ];
    const o = buildCommunityOverview({
      companies: [
        { id: "c1", name: "C1" },
        { id: "c2", name: "C2" },
        { id: "c3", name: "C3" }
      ],
      stakeholders,
      stakeholderEngagement: {}
    });
    expect(o.tierCounts).toEqual({
      core: 1,
      active: 2,
      casual: 0,
      at_risk: 2,
      unmeasured: 1
    });
    // c1 = core (1 core + active 過半数), c2 = at_risk, c3 = unmeasured
    expect(o.companyTierCounts.core).toBe(1);
    expect(o.companyTierCounts.at_risk).toBe(1);
    expect(o.companyTierCounts.unmeasured).toBe(1);
  });

  it("昇格候補多数: (suggested-current) rank 差が大きい順 → reasons 多い順", () => {
    const stakeholders: Stakeholder[] = [
      sh({ id: "s-small", companyId: "c1", engagementTier: "active" }), // active(2) → core(3), 差 1
      sh({ id: "s-large", companyId: "c1", engagementTier: "at_risk" }), // at_risk(0) → core(3), 差 3
      sh({ id: "s-mid", companyId: "c1", engagementTier: "casual" }) // casual(1) → core(3), 差 2
    ];
    const o = buildCommunityOverview({
      companies: [{ id: "c1", name: "C1" }],
      stakeholders,
      stakeholderEngagement: {
        "s-small": { suggestedTier: "core", reasons: ["r"] },
        "s-large": { suggestedTier: "core", reasons: ["r1", "r2"] },
        "s-mid": { suggestedTier: "core", reasons: ["r"] }
      },
      limit: 5
    });
    expect(o.promotionCandidates.map((p) => p.stakeholderId)).toEqual([
      "s-large",
      "s-mid",
      "s-small"
    ]);
    // limit が効くこと
    const o2 = buildCommunityOverview({
      companies: [{ id: "c1", name: "C1" }],
      stakeholders,
      stakeholderEngagement: {
        "s-small": { suggestedTier: "core", reasons: ["r"] },
        "s-large": { suggestedTier: "core", reasons: ["r1", "r2"] },
        "s-mid": { suggestedTier: "core", reasons: ["r"] }
      },
      limit: 2
    });
    expect(o2.promotionCandidates).toHaveLength(2);
  });

  it("at_risk 企業集計: 集約 at_risk な企業を at_risk stakeholder 数の多い順に列挙", () => {
    const stakeholders: Stakeholder[] = [
      // c-bad: 3 名全員 at_risk
      sh({ id: "a1", companyId: "c-bad", engagementTier: "at_risk" }),
      sh({ id: "a2", companyId: "c-bad", engagementTier: "at_risk" }),
      sh({ id: "a3", companyId: "c-bad", engagementTier: "at_risk" }),
      // c-meh: 2 名 at_risk
      sh({ id: "b1", companyId: "c-meh", engagementTier: "at_risk" }),
      sh({ id: "b2", companyId: "c-meh", engagementTier: "at_risk" }),
      // c-ok: active majority — at_risk リストには載らない
      sh({ id: "d1", companyId: "c-ok", engagementTier: "active" }),
      sh({ id: "d2", companyId: "c-ok", engagementTier: "active" })
    ];
    const o = buildCommunityOverview({
      companies: [
        { id: "c-bad", name: "Bad Co", ownerName: "古野" },
        { id: "c-meh", name: "Meh Co" },
        { id: "c-ok", name: "OK Co" }
      ],
      stakeholders,
      stakeholderEngagement: {}
    });
    expect(o.atRiskCompanies.map((c) => c.companyId)).toEqual([
      "c-bad",
      "c-meh"
    ]);
    expect(o.atRiskCompanies[0]).toMatchObject({
      companyName: "Bad Co",
      ownerName: "古野",
      stakeholderAtRiskCount: 3
    });
  });
});
