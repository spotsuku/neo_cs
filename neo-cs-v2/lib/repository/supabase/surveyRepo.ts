// surveys / survey_responses (Supabase 実装)
// マイグレーション: supabase/migrations/0001_init.sql surveys, survey_responses
//
// 列マッピング (surveys):
//   schedule_id            ↔ scheduleId
//   contract_id            ↔ contractId
//   session_id             ↔ sessionId
//   product_session_label  ↔ productSessionLabel
//   respondent_type        ↔ respondentType
//   expected_count         ↔ expectedRespondentCount
//   opened_at              ↔ openedAt (timestamptz → YYYY-MM-DD で返却)
//   closed_at              ↔ closedAt
//
// 注意: mock の Survey.templateIds は DB 側に対応列が無いため [] を返す
// (将来 survey_templates との join テーブルを追加して対応予定)。
//
// 列マッピング (survey_responses):
//   survey_id        ↔ surveyId
//   company_id       ↔ companyId
//   participant_id   ↔ participantId
//   respondent_name  ↔ respondentName
//   submitted_at     ↔ submittedAt (timestamptz → YYYY-MM-DD)
//   answers          ↔ answers (jsonb → SurveyAnswer[])

import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
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
import type {
  SurveyAnswer,
  SurveyScheduleTrigger,
  SurveyRespondentTarget
} from "@/lib/mock/surveys";
import type { ProductCode } from "@/lib/master";
import { DEFAULT_ORG_ID } from "../types";

type SurveyRow = {
  id: string;
  organization_id: string;
  schedule_id: string | null;
  contract_id: string | null;
  session_id: string | null;
  title: string;
  product_session_label: string | null;
  respondent_type: "stakeholder" | "participant";
  expected_count: number | null;
  opened_at: string | null;
  closed_at: string | null;
  status: "draft" | "open" | "closed";
};

type ResponseRow = {
  id: string;
  organization_id: string;
  survey_id: string;
  company_id: string | null;
  participant_id: string | null;
  respondent_name: string | null;
  submitted_at: string;
  answers: SurveyAnswer[];
};

function toDate(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function toSurvey(r: SurveyRow): Survey {
  return {
    id: r.id,
    organizationId: r.organization_id,
    scheduleId: r.schedule_id ?? "",
    contractId: r.contract_id ?? undefined,
    sessionId: r.session_id ?? undefined,
    title: r.title,
    templateIds: [], // DB に対応列が無いため空配列で返す
    productSessionLabel: r.product_session_label ?? undefined,
    respondentType: r.respondent_type,
    expectedRespondentCount: r.expected_count ?? 0,
    openedAt: toDate(r.opened_at),
    closedAt: r.closed_at ? toDate(r.closed_at) : undefined,
    status: r.status
  };
}

type ScheduleRow = {
  id: string;
  organization_id: string;
  product_code: string;
  name: string;
  template_ids: string[] | null;
  trigger: SurveyScheduleTrigger;
  respondent_target: SurveyRespondentTarget;
  expected_respondent_ids: string[] | null;
  active: boolean;
};

function toSchedule(r: ScheduleRow): SurveySchedule {
  return {
    id: r.id,
    organizationId: r.organization_id,
    product: r.product_code as ProductCode,
    name: r.name,
    templateIds: Array.isArray(r.template_ids) ? r.template_ids : [],
    trigger: r.trigger,
    respondentTarget: r.respondent_target,
    expectedRespondentIds: r.expected_respondent_ids ?? undefined,
    active: r.active
  };
}

function toResponse(r: ResponseRow): SurveyResponse {
  return {
    id: r.id,
    organizationId: r.organization_id,
    surveyId: r.survey_id,
    companyId: r.company_id ?? "",
    participantId: r.participant_id ?? undefined,
    respondentName: r.respondent_name ?? "",
    submittedAt: toDate(r.submitted_at),
    answers: Array.isArray(r.answers) ? r.answers : []
  };
}

export const supabaseSurveyRepo: SurveyRepo = {
  async list(opts) {
    const sb = getServiceClient();
    if (opts?.productCode) {
      let cq = sb
        .from("contracts")
        .select("id")
        .eq("product_code", opts.productCode);
      if (opts.organizationId) cq = cq.eq("organization_id", opts.organizationId);
      const { data: contracts, error: cErr } = await cq;
      if (cErr) throw new Error(`contracts.list(forSurveys): ${cErr.message}`);
      const ids = (contracts ?? []).map((c: { id: string }) => c.id);
      if (ids.length === 0) return [];
      const { data, error } = await sb
        .from("surveys")
        .select("*")
        .in("contract_id", ids);
      if (error) throw new Error(`surveys.list: ${error.message}`);
      return (data ?? []).map((r: SurveyRow) => toSurvey(r));
    }
    let q = sb.from("surveys").select("*");
    if (opts?.organizationId) q = q.eq("organization_id", opts.organizationId);
    const { data, error } = await q;
    if (error) throw new Error(`surveys.list: ${error.message}`);
    return (data ?? []).map((r: SurveyRow) => toSurvey(r));
  },

  async getById(id) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("surveys")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`surveys.getById: ${error.message}`);
    if (!data) return null;
    return toSurvey(data as SurveyRow);
  },

  async listResponses(surveyId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("survey_responses")
      .select("*")
      .eq("survey_id", surveyId);
    if (error) throw new Error(`survey_responses.list: ${error.message}`);
    return (data ?? []).map((r: ResponseRow) => toResponse(r));
  },

  async listSchedules(opts) {
    const sb = getServiceClient();
    let q = sb.from("survey_schedules").select("*");
    if (opts?.organizationId) q = q.eq("organization_id", opts.organizationId);
    if (opts?.productCode) q = q.eq("product_code", opts.productCode);
    if (opts?.activeOnly) q = q.eq("active", true);
    const { data, error } = await q.order("id");
    if (error) throw new Error(`survey_schedules.list: ${error.message}`);
    return (data ?? []).map((r: ScheduleRow) => toSchedule(r));
  },

  async getScheduleById(id) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("survey_schedules")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`survey_schedules.getById: ${error.message}`);
    if (!data) return null;
    return toSchedule(data as ScheduleRow);
  },

  // ─────────────────────────────────────────────
  // 取り込み機能（Phase 1）
  // ─────────────────────────────────────────────
  async createSurveyWithResponses(payload: SurveyImportPayload): Promise<SurveyImportResult> {
    const sb = getServiceClient();
    const orgId = DEFAULT_ORG_ID;
    const surveyId = `sv-imp-${Date.now().toString(36)}`;
    const templateId = `tpl-imp-${Date.now().toString(36)}`;

    // 1. 新規質問を INSERT（重複は upsert で吸収）
    if (payload.newQuestions.length > 0) {
      const rows = payload.newQuestions.map((q) => ({
        id: q.id,
        q_key: q.key,
        text: q.text,
        q_type: q.type,
        scale_min: q.scaleMin ?? null,
        scale_max: q.scaleMax ?? null,
        choices: q.choices ?? null,
        required: q.required,
        is_imported: true
      }));
      const { error } = await sb.from("survey_questions").upsert(rows, { onConflict: "id" });
      if (error) throw new Error(`survey_questions.upsert: ${error.message}`);
    }

    // 2. survey_templates + survey_template_questions
    const { error: tplErr } = await sb.from("survey_templates").insert({
      id: templateId,
      name: payload.survey.templateName,
      scope: "common",
      respondent_type: payload.survey.respondentType
    });
    if (tplErr) throw new Error(`survey_templates.insert: ${tplErr.message}`);

    const tplQRows: { template_id: string; question_id: string; display_order: number }[] = [];
    let order = 0;
    for (const m of payload.columnMappings) {
      let qid: string | null = null;
      if (m.matched === "existing" && m.questionKey) {
        const { data: q } = await sb
          .from("survey_questions")
          .select("id")
          .eq("q_key", m.questionKey)
          .maybeSingle();
        qid = q?.id ?? null;
      } else if (m.matched === "new" && m.proposedQuestion) {
        qid = m.proposedQuestion.id;
      }
      if (qid) {
        tplQRows.push({ template_id: templateId, question_id: qid, display_order: order++ });
      }
    }
    if (tplQRows.length > 0) {
      const { error } = await sb.from("survey_template_questions").insert(tplQRows);
      if (error) throw new Error(`survey_template_questions.insert: ${error.message}`);
    }

    // 3. surveys
    const { error: svErr } = await sb.from("surveys").insert({
      id: surveyId,
      organization_id: orgId,
      schedule_id: payload.scheduleId,
      title: payload.survey.title,
      product_session_label: payload.survey.productSessionLabel ?? null,
      respondent_type: payload.survey.respondentType,
      expected_count: payload.survey.expectedRespondentCount,
      opened_at: payload.survey.openedAt,
      closed_at: payload.survey.closedAt ?? null,
      status: payload.survey.status
    });
    if (svErr) throw new Error(`surveys.insert: ${svErr.message}`);

    // 4. survey_responses
    const respRows = payload.responses.map((r, idx) => {
      const resolvedAnswers: SurveyAnswer[] = [];
      for (const a of r.answers) {
        let qid = a.questionId;
        if (qid.startsWith("existing:")) {
          // ループ前段で proposedQuestion を全部 upsert 済 + 既存 q_key も解決済み
          // ここでは answers 内に existing:{key} がそのまま来ている前提を簡略化し、
          // 厳密解決は呼び出し元の API ルートで template 構築時に行う
          continue;
        }
        resolvedAnswers.push({ questionId: qid, value: a.value });
      }
      return {
        id: `${surveyId}-r${idx + 1}`,
        organization_id: orgId,
        survey_id: surveyId,
        company_id: r.companyId,
        respondent_name: r.respondentName,
        submitted_at: r.submittedAt,
        answers: resolvedAnswers
      };
    });
    if (respRows.length > 0) {
      const { error } = await sb.from("survey_responses").insert(respRows);
      if (error) throw new Error(`survey_responses.insert: ${error.message}`);
    }

    // 5. survey_imports
    const { data: impRow, error: impErr } = await sb
      .from("survey_imports")
      .insert({
        organization_id: orgId,
        file_name: payload.fileName,
        uploaded_by: null,
        schedule_id: payload.scheduleId,
        survey_id: surveyId,
        status: "applied",
        row_count: payload.responses.length,
        column_mappings: payload.columnMappings,
        raw_csv: payload.rawCsv,
        ai_summary: payload.aiSummary ?? null
      })
      .select("id")
      .single();
    if (impErr) throw new Error(`survey_imports.insert: ${impErr.message}`);

    return {
      surveyId,
      importId: (impRow as { id: string }).id,
      createdQuestionCount: payload.newQuestions.length,
      responseCount: payload.responses.length
    };
  },

  async listImports(opts): Promise<SurveyImportRecord[]> {
    const sb = getServiceClient();
    let q = sb.from("survey_imports").select("*");
    if (opts?.scheduleId) q = q.eq("schedule_id", opts.scheduleId);
    if (opts?.surveyId) q = q.eq("survey_id", opts.surveyId);
    const { data, error } = await q.order("uploaded_at", { ascending: false });
    if (error) throw new Error(`survey_imports.list: ${error.message}`);
    return (data ?? []).map((r: {
      id: string; organization_id: string; file_name: string; uploaded_at: string;
      uploaded_by: string | null; schedule_id: string; survey_id: string | null;
      status: SurveyImportRecord["status"]; row_count: number; ai_summary: string | null;
    }) => ({
      id: r.id,
      organizationId: r.organization_id,
      fileName: r.file_name,
      uploadedAt: r.uploaded_at,
      uploadedBy: r.uploaded_by ?? undefined,
      scheduleId: r.schedule_id,
      surveyId: r.survey_id ?? undefined,
      status: r.status,
      rowCount: r.row_count,
      aiSummary: r.ai_summary ?? undefined
    }));
  },

  async saveInsights(surveyId, insights) {
    const sb = getServiceClient();
    // 既存削除 → 一括 INSERT
    const { error: delErr } = await sb.from("survey_insights").delete().eq("survey_id", surveyId);
    if (delErr) throw new Error(`survey_insights.delete: ${delErr.message}`);
    if (insights.length === 0) return;
    const rows = insights.map((i) => ({
      organization_id: DEFAULT_ORG_ID,
      survey_id: surveyId,
      question_id: i.questionId ?? null,
      category: i.category,
      summary: i.summary,
      source_response_ids: i.sourceResponseIds,
      confidence: i.confidence
    }));
    const { error } = await sb.from("survey_insights").insert(rows);
    if (error) throw new Error(`survey_insights.insert: ${error.message}`);
  },

  async listQuestionsForSurvey(surveyId) {
    const sb = getServiceClient();
    // surveys -> survey_template_questions -> survey_questions
    const { data: tplQ, error: e1 } = await sb
      .from("survey_template_questions")
      .select("question_id, display_order, survey_templates!inner(id), surveys!inner(id)")
      .eq("surveys.id", surveyId);
    if (e1) {
      // フォールバック: 生 SQL で対応できない場合は survey_responses から逆引き
      const { data: resps } = await sb.from("survey_responses").select("answers").eq("survey_id", surveyId);
      const qIds = new Set<string>();
      (resps ?? []).forEach((r: { answers: unknown }) => {
        if (Array.isArray(r.answers)) {
          (r.answers as { questionId: string }[]).forEach((a) => qIds.add(a.questionId));
        }
      });
      if (qIds.size === 0) return [];
      const { data: qs } = await sb.from("survey_questions").select("*").in("id", Array.from(qIds));
      return (qs ?? []).map((row: {
        id: string; q_key: string; text: string; q_type: import("@/lib/mock/surveys").SurveyQuestionType;
        scale_min: number | null; scale_max: number | null; choices: string[] | null; required: boolean;
      }) => ({
        id: row.id,
        key: row.q_key,
        text: row.text,
        type: row.q_type,
        scaleMin: row.scale_min ?? undefined,
        scaleMax: row.scale_max ?? undefined,
        choices: row.choices ?? undefined,
        required: row.required
      }));
    }
    const qIds = (tplQ ?? []).map((r: { question_id: string }) => r.question_id);
    if (qIds.length === 0) return [];
    const { data: qs } = await sb.from("survey_questions").select("*").in("id", qIds);
    return (qs ?? []).map((row: {
      id: string; q_key: string; text: string; q_type: import("@/lib/mock/surveys").SurveyQuestionType;
      scale_min: number | null; scale_max: number | null; choices: string[] | null; required: boolean;
    }) => ({
      id: row.id,
      key: row.q_key,
      text: row.text,
      type: row.q_type,
      scaleMin: row.scale_min ?? undefined,
      scaleMax: row.scale_max ?? undefined,
      choices: row.choices ?? undefined,
      required: row.required
    }));
  },

  async listInsights(surveyId): Promise<SurveyInsightRecord[]> {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("survey_insights")
      .select("*")
      .eq("survey_id", surveyId);
    if (error) throw new Error(`survey_insights.list: ${error.message}`);
    return (data ?? []).map((r: {
      id: string; survey_id: string; question_id: string | null;
      category: SurveyInsightRecord["category"]; summary: string;
      source_response_ids: string[]; confidence: number; created_at: string;
    }) => ({
      id: r.id,
      surveyId: r.survey_id,
      questionId: r.question_id ?? undefined,
      category: r.category,
      summary: r.summary,
      sourceResponseIds: Array.isArray(r.source_response_ids) ? r.source_response_ids : [],
      confidence: Number(r.confidence ?? 0),
      createdAt: r.created_at
    }));
  }
};
