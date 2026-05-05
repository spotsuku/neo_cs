// 企業ジャーニー (会社単位) mock 実装
// 後退 (display_order が下がる遷移) は acknowledgeRegression が必須

import {
  seedCompanyJourneys,
  type CompanyJourney,
  type JourneyEvent
} from "@/lib/mock/journeys";
import type {
  CompanyJourneyRepo,
  SetCompanyJourneyStageInput
} from "../types";
import { DEFAULT_ORG_ID } from "../types";
import { getStageDefinitionsSync } from "./journeyStageDefinitionRepo";

// Next.js dev モードの module 多重評価対策で globalThis に共有保存
type GlobalStore = {
  journeys: CompanyJourney[];
  events: JourneyEvent[];
};
const G = globalThis as unknown as { __companyJourneyStore?: GlobalStore };
if (!G.__companyJourneyStore) {
  G.__companyJourneyStore = {
    journeys: seedCompanyJourneys.map((j) => ({
      ...j,
      organizationId: DEFAULT_ORG_ID
    })),
    events: seedCompanyJourneys.map((j, i) => ({
      id: `cj-evt-${j.companyId}-${i}`,
      organizationId: DEFAULT_ORG_ID,
      subjectId: j.companyId,
      journeyType: "company" as const,
      toStageKey: j.currentStageKey,
      changedAt: j.stageEnteredAt,
      isRegression: false
    }))
  };
}
const journeys = G.__companyJourneyStore.journeys;
const events = G.__companyJourneyStore.events;

export const mockCompanyJourneyRepo: CompanyJourneyRepo = {
  async getByCompany(companyId) {
    const j = journeys.find((x) => x.companyId === companyId);
    return j ? { ...j } : null;
  },

  async list({ organizationId = DEFAULT_ORG_ID } = {}) {
    return journeys
      .filter((j) => j.organizationId === organizationId)
      .map((j) => ({ ...j }));
  },

  async setStage(input: SetCompanyJourneyStageInput) {
    const organizationId = input.organizationId ?? DEFAULT_ORG_ID;
    const defs = getStageDefinitionsSync(organizationId, "company");
    const toDef = defs.find((d) => d.stageKey === input.toStageKey);
    if (!toDef) {
      throw new Error(
        `Unknown company journey stage: ${input.toStageKey}`
      );
    }
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const idx = journeys.findIndex((j) => j.companyId === input.companyId);
    const prev = idx >= 0 ? journeys[idx] : null;
    const fromDef = prev
      ? defs.find((d) => d.stageKey === prev.currentStageKey)
      : undefined;
    const isRegression =
      fromDef !== undefined && toDef.displayOrder < fromDef.displayOrder;

    if (isRegression && !input.acknowledgeRegression) {
      const err: Error & { code?: string } = new Error(
        "company-journey: 後退する変更には acknowledgeRegression=true が必要です"
      );
      err.code = "REGRESSION_REQUIRES_ACK";
      throw err;
    }

    const next: CompanyJourney = {
      companyId: input.companyId,
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
      id: `cj-evt-${input.companyId}-${events.length}`,
      organizationId,
      subjectId: input.companyId,
      journeyType: "company",
      fromStageKey: prev?.currentStageKey,
      toStageKey: input.toStageKey,
      changedAt: now,
      changedBy: input.changedBy,
      note: input.note,
      isRegression
    });
    return { ...next };
  },

  async listEvents(companyId) {
    return events
      .filter((e) => e.subjectId === companyId && e.journeyType === "company")
      .sort((a, b) => a.changedAt.localeCompare(b.changedAt))
      .map((e) => ({ ...e }));
  }
};
