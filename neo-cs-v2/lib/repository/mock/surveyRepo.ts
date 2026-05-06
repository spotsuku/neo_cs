// surveys / survey_responses (Mock 実装)
// データソース: lib/mock/surveys.ts

import { surveys as seedSurveys, surveyResponses as seedResponses } from "@/lib/mock/surveys";
import { allContracts } from "@/lib/mock/onboarding";
import { DEFAULT_ORG_ID } from "../types";
import type { Survey, SurveyRepo, SurveyResponse } from "../types";

const surveyStore: Survey[] = seedSurveys.map((s) => ({
  ...s,
  organizationId: DEFAULT_ORG_ID
}));

const responseStore: SurveyResponse[] = seedResponses.map((r) => ({
  ...r,
  organizationId: DEFAULT_ORG_ID
}));

export const mockSurveyRepo: SurveyRepo = {
  async list(opts) {
    let out = surveyStore.slice();
    if (opts?.productCode) {
      const productContractIds = new Set(
        allContracts.filter((c) => c.product === opts.productCode).map((c) => c.id)
      );
      out = out.filter(
        (s) => !s.contractId || productContractIds.has(s.contractId)
      );
    }
    return out.map((s) => ({ ...s }));
  },
  async getById(id) {
    const found = surveyStore.find((s) => s.id === id);
    return found ? { ...found } : null;
  },
  async listResponses(surveyId) {
    return responseStore.filter((r) => r.surveyId === surveyId).map((r) => ({ ...r }));
  }
};
