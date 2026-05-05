// 事業ジャーニー (契約=商材×期 単位) mock 実装

import {
  seedBusinessJourneys,
  type BusinessJourney,
  type JourneyEvent
} from "@/lib/mock/journeys";
import type {
  BusinessJourneyRepo,
  SetBusinessJourneyStageInput
} from "../types";
import { DEFAULT_ORG_ID } from "../types";
import { getStageDefinitionsSync } from "./journeyStageDefinitionRepo";
import { allContracts } from "@/lib/mock/onboarding";

// Next.js の dev モードでは Server Action / Server Component が別の module
// graph で評価されることがあり、module-level の配列は別インスタンスになる。
// globalThis に保存して全インスタンスで共有する。
type GlobalStore = {
  journeys: BusinessJourney[];
  events: JourneyEvent[];
};
const G = globalThis as unknown as { __businessJourneyStore?: GlobalStore };
if (!G.__businessJourneyStore) {
  G.__businessJourneyStore = {
    journeys: seedBusinessJourneys.map((j) => ({
      ...j,
      organizationId: DEFAULT_ORG_ID
    })),
    events: seedBusinessJourneys.map((j, i) => ({
      id: `bj-evt-${j.contractId}-${i}`,
      organizationId: DEFAULT_ORG_ID,
      subjectId: j.contractId,
      journeyType: "business" as const,
      toStageKey: j.currentStageKey,
      changedAt: j.stageEnteredAt,
      isRegression: false
    }))
  };
}
const journeys = G.__businessJourneyStore.journeys;
const events = G.__businessJourneyStore.events;

export const mockBusinessJourneyRepo: BusinessJourneyRepo = {
  async getByContract(contractId) {
    const j = journeys.find((x) => x.contractId === contractId);
    return j ? { ...j } : null;
  },

  async listByCompany(companyId) {
    const ids = new Set(
      allContracts.filter((c) => c.companyId === companyId).map((c) => c.id)
    );
    return journeys
      .filter((j) => ids.has(j.contractId))
      .map((j) => ({ ...j }));
  },

  async listByContractIds(contractIds) {
    const set = new Set(contractIds);
    return journeys.filter((j) => set.has(j.contractId)).map((j) => ({ ...j }));
  },

  async setStage(input: SetBusinessJourneyStageInput) {
    const organizationId = input.organizationId ?? DEFAULT_ORG_ID;
    const defs = getStageDefinitionsSync(organizationId, "business");
    const toDef = defs.find((d) => d.stageKey === input.toStageKey);
    if (!toDef) {
      throw new Error(
        `Unknown business journey stage: ${input.toStageKey}`
      );
    }
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const idx = journeys.findIndex((j) => j.contractId === input.contractId);
    const prev = idx >= 0 ? journeys[idx] : null;
    const fromDef = prev
      ? defs.find((d) => d.stageKey === prev.currentStageKey)
      : undefined;
    // 事業ジャーニーは後退も比較的起こり得る (社内検討で巻き戻し等) が、
    // UI では同様に確認モーダルを出す。バックエンドは記録のみ。
    const isRegression =
      fromDef !== undefined && toDef.displayOrder < fromDef.displayOrder;

    const next: BusinessJourney = {
      contractId: input.contractId,
      organizationId,
      currentStageKey: input.toStageKey,
      stageEnteredAt: today,
      note: input.note,
      updatedAt: now,
      updatedBy: input.changedBy
    };
    if (idx >= 0) journeys[idx] = next;
    else journeys.push(next);

    events.push({
      id: `bj-evt-${input.contractId}-${events.length}`,
      organizationId,
      subjectId: input.contractId,
      journeyType: "business",
      fromStageKey: prev?.currentStageKey,
      toStageKey: input.toStageKey,
      changedAt: now,
      changedBy: input.changedBy,
      note: input.note,
      isRegression
    });
    return { ...next };
  },

  async listEvents(contractId) {
    return events
      .filter((e) => e.subjectId === contractId && e.journeyType === "business")
      .sort((a, b) => a.changedAt.localeCompare(b.changedAt))
      .map((e) => ({ ...e }));
  }
};
