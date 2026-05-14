// surveys / survey_responses (Mock 実装)
// データソース: lib/mock/surveys.ts
// + 取り込み機能（Phase 1）: in-memory で survey_imports / survey_insights / 動的に作成された
//   surveys / responses / questions を保持する。プロセス終了で消える前提（実 DB 書き込みは Supabase 実装側）。

import {
  surveys as seedSurveys,
  surveyResponses as seedResponses,
  surveyQuestions as seedQuestions,
  surveyTemplates as seedTemplates,
  surveySchedules as seedSchedules,
  type SurveyQuestion,
  type SurveyTemplate,
  type SurveyAnswer
} from "@/lib/mock/surveys";
import { allContracts } from "@/lib/mock/onboarding";
import { DEFAULT_ORG_ID } from "../types";
import type {
  Survey,
  SurveyRepo,
  SurveyResponse,
  SurveySchedule,
  SurveyImportPayload,
  SurveyImportResult,
  SurveyImportRecord,
  SurveyInsightRecord
} from "../types";

// HMR / RSC ↔ API ルート間で同一インスタンスを保つため globalThis に逃がす。
// dev サーバ再起動で消えるが、本番では Supabase 実装が使われる前提なので問題なし。
type SurveyMockState = {
  surveyStore: Survey[];
  responseStore: SurveyResponse[];
  questionStore: SurveyQuestion[];
  templateStore: SurveyTemplate[];
  importStore: SurveyImportRecord[];
  insightStore: SurveyInsightRecord[];
  surveyCounter: number;
};

const G = globalThis as unknown as { __surveyMock?: SurveyMockState };

if (!G.__surveyMock) {
  const seededSurveys = seedSurveys.map((s) => ({
    ...s,
    organizationId: DEFAULT_ORG_ID
  }));
  G.__surveyMock = {
    surveyStore: seededSurveys,
    responseStore: seedResponses.map((r) => ({ ...r, organizationId: DEFAULT_ORG_ID })),
    questionStore: [...seedQuestions],
    templateStore: [],
    importStore: [],
    insightStore: [],
    surveyCounter: seededSurveys.length + 1
  };
}

const state = G.__surveyMock!;
const surveyStore = state.surveyStore;
const responseStore = state.responseStore;
const questionStore = state.questionStore;
const templateStore = state.templateStore;
const importStore = state.importStore;
const insightStore = state.insightStore;

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

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
  },

  async listSchedules(opts) {
    let out: SurveySchedule[] = seedSchedules.map((s) => ({
      ...s,
      organizationId: DEFAULT_ORG_ID
    }));
    if (opts?.productCode) out = out.filter((s) => s.product === opts.productCode);
    if (opts?.activeOnly) out = out.filter((s) => s.active);
    return out;
  },

  async getScheduleById(id) {
    const found = seedSchedules.find((s) => s.id === id);
    return found ? { ...found, organizationId: DEFAULT_ORG_ID } : null;
  },

  // ─────────────────────────────────────────────
  // 取り込み機能（mock = in-memory persistence）
  // ─────────────────────────────────────────────
  async createSurveyWithResponses(payload: SurveyImportPayload): Promise<SurveyImportResult> {
    const surveyId = `sv-imp-${state.surveyCounter++}`;
    const importId = newId("imp");

    // ① 新規質問を questions ストアに追加
    const createdQuestionIds: string[] = [];
    for (const q of payload.newQuestions) {
      // 衝突回避：同じ id がストアにあれば skip
      if (!questionStore.some((existing) => existing.id === q.id)) {
        questionStore.push({ ...q });
        createdQuestionIds.push(q.id);
      }
    }

    // ② テンプレ作成（既存 + 新規 question を順序付きで束ねる）
    const templateId = `tpl-imp-${state.surveyCounter}`;
    const templateQuestionIds: string[] = [];
    for (const m of payload.columnMappings) {
      if (m.matched === "existing" && m.questionKey) {
        const q = questionStore.find((x) => x.key === m.questionKey);
        if (q) templateQuestionIds.push(q.id);
      } else if (m.matched === "new" && m.proposedQuestion) {
        templateQuestionIds.push(m.proposedQuestion.id);
      }
    }
    const templateRecord: SurveyTemplate = {
      id: templateId,
      name: payload.survey.templateName,
      scope: "common",
      questionIds: templateQuestionIds,
      respondentType: payload.survey.respondentType
    };
    templateStore.push(templateRecord);
    // mock seed 配列にも反映：CompanyDetail / aggregateSurvey などが直接参照しているため
    if (!seedTemplates.some((t) => t.id === templateRecord.id)) seedTemplates.push(templateRecord);
    for (const q of payload.newQuestions) {
      if (!seedQuestions.some((sq) => sq.id === q.id)) seedQuestions.push(q);
    }

    // ③ surveys に 1 件追加
    const survey: Survey = {
      id: surveyId,
      organizationId: DEFAULT_ORG_ID,
      scheduleId: payload.scheduleId,
      title: payload.survey.title,
      templateIds: [templateId],
      productSessionLabel: payload.survey.productSessionLabel,
      respondentType: payload.survey.respondentType,
      expectedRespondentCount: payload.survey.expectedRespondentCount,
      openedAt: payload.survey.openedAt,
      closedAt: payload.survey.closedAt,
      status: payload.survey.status
    };
    surveyStore.push(survey);
    // mock seed 配列にも反映（CompanyDetail.allSurveys / aggregateSurvey 経路で参照される）
    if (!seedSurveys.some((s) => s.id === survey.id)) {
      // organizationId は seed 型にはないが、構造上の余分なプロパティとして許容される
      seedSurveys.push(survey as unknown as (typeof seedSurveys)[number]);
    }

    // ④ responses 投入。answers の中の "existing:{key}" を実 questionId に解決
    let respCounter = 1;
    for (const r of payload.responses) {
      const resolvedAnswers: SurveyAnswer[] = [];
      for (const a of r.answers) {
        let qid = a.questionId;
        if (qid.startsWith("existing:")) {
          const key = qid.slice("existing:".length);
          const q = questionStore.find((x) => x.key === key);
          if (!q) continue;
          qid = q.id;
        }
        resolvedAnswers.push({ questionId: qid, value: a.value });
      }
      const resp: SurveyResponse = {
        id: `${surveyId}-r${respCounter++}`,
        organizationId: DEFAULT_ORG_ID,
        surveyId,
        companyId: r.companyId ?? "",
        respondentName: r.respondentName,
        submittedAt: r.submittedAt,
        answers: resolvedAnswers
      };
      responseStore.push(resp);
      // CompanyDetail などが allResponses として参照する mock 配列にも反映
      if (!seedResponses.some((s) => s.id === resp.id)) {
        seedResponses.push(resp as unknown as (typeof seedResponses)[number]);
      }
    }

    // ⑤ 取込履歴
    const record: SurveyImportRecord = {
      id: importId,
      organizationId: DEFAULT_ORG_ID,
      fileName: payload.fileName,
      uploadedAt: new Date().toISOString(),
      uploadedBy: payload.uploadedBy,
      scheduleId: payload.scheduleId,
      surveyId,
      status: "applied",
      rowCount: payload.responses.length,
      aiSummary: payload.aiSummary
    };
    importStore.push(record);

    return {
      surveyId,
      importId,
      createdQuestionCount: createdQuestionIds.length,
      responseCount: payload.responses.length
    };
  },

  async listImports(opts) {
    return importStore
      .filter((r) => !opts?.scheduleId || r.scheduleId === opts.scheduleId)
      .filter((r) => !opts?.surveyId || r.surveyId === opts.surveyId)
      .map((r) => ({ ...r }))
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  },

  async saveInsights(surveyId, insights) {
    // 既存の同 survey インサイトを置き換え
    for (let i = insightStore.length - 1; i >= 0; i--) {
      if (insightStore[i].surveyId === surveyId) insightStore.splice(i, 1);
    }
    for (const ins of insights) {
      insightStore.push({ ...ins });
    }
  },

  async listInsights(surveyId) {
    return insightStore.filter((i) => i.surveyId === surveyId).map((i) => ({ ...i }));
  },

  async listQuestionsForSurvey(surveyId) {
    const survey = surveyStore.find((s) => s.id === surveyId);
    if (!survey) return [];
    const qIds = new Set<string>();
    for (const tid of survey.templateIds) {
      const tpl = templateStore.find((t) => t.id === tid);
      if (tpl) tpl.questionIds.forEach((qid) => qIds.add(qid));
    }
    // テンプレ未登録 (seed 由来) の場合は seed から探す
    if (qIds.size === 0) {
      const { surveyTemplates } = await import("@/lib/mock/surveys");
      for (const tid of survey.templateIds) {
        const tpl = surveyTemplates.find((t) => t.id === tid);
        if (tpl) tpl.questionIds.forEach((qid) => qIds.add(qid));
      }
    }
    return Array.from(qIds)
      .map((qid) => questionStore.find((q) => q.id === qid))
      .filter((q): q is SurveyQuestion => Boolean(q));
  }
};
