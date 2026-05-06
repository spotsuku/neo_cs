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
  SurveyResponse
} from "../types";
import type { SurveyAnswer } from "@/lib/mock/surveys";

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
  }
};
