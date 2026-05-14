import { describe, it, expect } from "vitest";
import { deriveFactorsFromSignals } from "./health-factors";
import type { Repository, Contract } from "@/lib/repository/types";

// Repository の必要メソッドだけをスタブ化したフェイク。型を簡略化するため
// `as unknown as Repository` でキャストして渡す。
function makeRepo(stubs: {
  attendance?: { recordedAt: string; status: "present" | "late" | "absent" | "excused" }[];
  meetings?: { date: string; product: string }[];
  onboarding?: { dueDate: string; status: "todo" | "doing" | "done" | "not_applicable" | "overdue" }[];
  signals?: { severity: "low" | "medium" | "high" }[];
  checkpoints?: { stageKey: string; done: boolean }[];
  businessJourney?: { currentStageKey: string } | null;
  stageDefs?: { stageKey: string; displayOrder: number }[];
}) {
  return {
    attendance: {
      listByContract: async () => stubs.attendance ?? []
    },
    meetingLogs: {
      listByCompany: async () => stubs.meetings ?? []
    },
    onboardingItems: {
      listByContractIds: async () => stubs.onboarding ?? []
    },
    churnSignals: {
      listByContract: async () => stubs.signals ?? []
    },
    journeyCheckpoints: {
      list: async () => stubs.checkpoints ?? []
    },
    businessJourneys: {
      getByContract: async () => stubs.businessJourney ?? null
    },
    journeyStageDefinitions: {
      list: async () => stubs.stageDefs ?? []
    }
  } as unknown as Repository;
}

const baseContract = {
  id: "k-1",
  organizationId: "org-1",
  companyId: "c-1",
  product: "academia",
  startDate: "2026-01-01"
} as unknown as Contract;

describe("deriveFactorsFromSignals", () => {
  it("全シグナル空なら count 系は 0 / 比率系は undefined", async () => {
    const repo = makeRepo({});
    const f = await deriveFactorsFromSignals(repo, {
      contract: baseContract,
      asOf: "2026-04-24"
    });
    expect(f.attendance).toBeUndefined();
    expect(f.weeksSinceLastTouch).toBeUndefined();
    expect(f.overdueOnboardingTasks).toBe(0);
    expect(f.negativeSignalCount).toBe(0);
    expect(f.milestoneProgress).toBeUndefined();
  });

  it("attendance: present + late を肯定的扱いとして比率を出す", async () => {
    const repo = makeRepo({
      attendance: [
        { recordedAt: "2026-04-01T00:00:00Z", status: "present" },
        { recordedAt: "2026-04-02T00:00:00Z", status: "late" },
        { recordedAt: "2026-04-03T00:00:00Z", status: "absent" },
        { recordedAt: "2026-04-04T00:00:00Z", status: "excused" }
      ]
    });
    const f = await deriveFactorsFromSignals(repo, {
      contract: baseContract,
      asOf: "2026-04-24"
    });
    expect(f.attendance).toBe(0.5);
  });

  it("attendance: asOf より未来のレコードは無視", async () => {
    const repo = makeRepo({
      attendance: [
        { recordedAt: "2026-04-01T00:00:00Z", status: "present" },
        { recordedAt: "2026-05-30T00:00:00Z", status: "absent" }
      ]
    });
    const f = await deriveFactorsFromSignals(repo, {
      contract: baseContract,
      asOf: "2026-04-24"
    });
    expect(f.attendance).toBe(1); // 未来の absent は除外される
  });

  it("weeksSinceLastTouch: 直近 meeting からの週数 (切り捨て)", async () => {
    const repo = makeRepo({
      // asOf=2026-04-24 → 2026-04-10 は 14日 = 2週
      meetings: [{ date: "2026-04-10", product: "academia" }]
    });
    const f = await deriveFactorsFromSignals(repo, {
      contract: baseContract,
      asOf: "2026-04-24"
    });
    expect(f.weeksSinceLastTouch).toBe(2);
  });

  it("weeksSinceLastTouch: 契約 product と一致しないログは無視 (他事業の接点を混入させない)", async () => {
    const repo = makeRepo({
      // 直近は別事業 "commu"。次に古い "academia" ログを採用すべき。
      meetings: [
        { date: "2026-04-22", product: "commu" },
        { date: "2026-04-03", product: "academia" }
      ]
    });
    const f = await deriveFactorsFromSignals(repo, {
      contract: baseContract,
      asOf: "2026-04-24"
    });
    // 2026-04-03 → 21日 = 3週
    expect(f.weeksSinceLastTouch).toBe(3);
  });

  it('weeksSinceLastTouch: product="cross" は契約事業によらず採用される', async () => {
    const repo = makeRepo({
      meetings: [
        { date: "2026-04-20", product: "commu" },
        { date: "2026-04-15", product: "cross" }
      ]
    });
    const f = await deriveFactorsFromSignals(repo, {
      contract: baseContract,
      asOf: "2026-04-24"
    });
    // 2026-04-15 → 9日 = 1週
    expect(f.weeksSinceLastTouch).toBe(1);
  });

  it("overdueOnboardingTasks: dueDate < asOf かつ 未消化のみカウント", async () => {
    const repo = makeRepo({
      onboarding: [
        { dueDate: "2026-04-01", status: "todo" }, // 期日超過 → 1
        { dueDate: "2026-04-01", status: "done" }, // done は除外
        { dueDate: "2026-04-01", status: "not_applicable" }, // 除外
        { dueDate: "2026-05-01", status: "todo" }, // 未来 → 除外
        { dueDate: "2026-04-15", status: "doing" } // 期日超過 → 1
      ]
    });
    const f = await deriveFactorsFromSignals(repo, {
      contract: baseContract,
      asOf: "2026-04-24"
    });
    expect(f.overdueOnboardingTasks).toBe(2);
  });

  it("negativeSignalCount: high/medium のみカウント (low は除外)", async () => {
    const repo = makeRepo({
      signals: [
        { severity: "high" },
        { severity: "medium" },
        { severity: "low" }
      ]
    });
    const f = await deriveFactorsFromSignals(repo, {
      contract: baseContract,
      asOf: "2026-04-24"
    });
    expect(f.negativeSignalCount).toBe(2);
  });

  it("milestoneProgress: 現ステージ以前の checkpoint だけで done 比率を計算", async () => {
    const repo = makeRepo({
      stageDefs: [
        { stageKey: "kickoff", displayOrder: 1 },
        { stageKey: "running", displayOrder: 2 },
        { stageKey: "value_articulated", displayOrder: 3 },
        { stageKey: "renewal_consideration", displayOrder: 4 }
      ],
      businessJourney: { currentStageKey: "running" }, // displayOrder=2
      checkpoints: [
        // kickoff (現ステージ以前) — 採用される
        { stageKey: "kickoff", done: true },
        { stageKey: "kickoff", done: true },
        // running (現ステージ) — 採用される
        { stageKey: "running", done: true },
        { stageKey: "running", done: false },
        // 未来ステージ — 除外
        { stageKey: "value_articulated", done: false },
        { stageKey: "renewal_consideration", done: false }
      ]
    });
    const f = await deriveFactorsFromSignals(repo, {
      contract: baseContract,
      asOf: "2026-04-24"
    });
    // 採用 4 件中 done 3 件 → 0.75
    expect(f.milestoneProgress).toBe(0.75);
  });

  it("milestoneProgress: business_journey が取得できない場合は全 checkpoint 横断", async () => {
    const repo = makeRepo({
      checkpoints: [
        { stageKey: "kickoff", done: true },
        { stageKey: "running", done: false }
      ]
      // businessJourney と stageDefs を渡さない
    });
    const f = await deriveFactorsFromSignals(repo, {
      contract: baseContract,
      asOf: "2026-04-24"
    });
    expect(f.milestoneProgress).toBe(0.5);
  });
});
