// 企業ジャーニー (会社単位・永続) Supabase リポジトリ
// マイグレーション: supabase/migrations/0029_journey_v2.sql

import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import { DEFAULT_ORG_ID } from "../types";
import type {
  CompanyJourneyRepo,
  CompanyJourney,
  SetCompanyJourneyStageInput
} from "../types";
import type { JourneyEvent } from "@/lib/mock/journeys";

type Row = {
  company_id: string;
  organization_id: string;
  current_stage_key: string;
  stage_entered_at: string;
  note: string | null;
  updated_at: string;
  updated_by: string | null;
};

type EventRow = {
  id: string;
  organization_id: string;
  subject_id: string;
  journey_type: string;
  from_stage_key: string | null;
  to_stage_key: string;
  changed_at: string;
  changed_by: string | null;
  note: string | null;
  is_regression: boolean;
};

function toJourney(r: Row): CompanyJourney {
  return {
    companyId: r.company_id,
    organizationId: r.organization_id,
    currentStageKey: r.current_stage_key,
    stageEnteredAt: r.stage_entered_at,
    note: r.note ?? undefined,
    updatedAt: r.updated_at,
    updatedBy: r.updated_by ?? undefined
  };
}

function toEvent(r: EventRow): JourneyEvent {
  return {
    id: r.id,
    organizationId: r.organization_id,
    subjectId: r.subject_id,
    journeyType: "company",
    fromStageKey: r.from_stage_key ?? undefined,
    toStageKey: r.to_stage_key,
    changedAt: r.changed_at,
    changedBy: r.changed_by ?? undefined,
    note: r.note ?? undefined,
    isRegression: r.is_regression
  };
}

export const supabaseCompanyJourneyRepo: CompanyJourneyRepo = {
  async getByCompany(companyId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("company_journeys")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) throw new Error(`company_journeys.get: ${error.message}`);
    return data ? toJourney(data as Row) : null;
  },

  async list({ organizationId = DEFAULT_ORG_ID } = {}) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("company_journeys")
      .select("*")
      .eq("organization_id", organizationId);
    if (error) throw new Error(`company_journeys.list: ${error.message}`);
    return (data ?? []).map((r) => toJourney(r as Row));
  },

  async setStage(input: SetCompanyJourneyStageInput) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const organizationId = input.organizationId ?? DEFAULT_ORG_ID;

    // 1. ステージ定義を引いて、後退判定 + 存在検証
    const { data: defs, error: dErr } = await sb
      .from("journey_stage_definitions")
      .select("stage_key, display_order")
      .eq("organization_id", organizationId)
      .eq("journey_type", "company");
    if (dErr) throw new Error(`journey_stage_definitions.read: ${dErr.message}`);
    const defMap = new Map<string, number>(
      (defs ?? []).map((d: { stage_key: string; display_order: number }) => [
        d.stage_key,
        d.display_order
      ])
    );
    const toOrder = defMap.get(input.toStageKey);
    if (toOrder == null) {
      throw new Error(`Unknown company journey stage: ${input.toStageKey}`);
    }

    // 2. 既存ジャーニーを取得 (後退チェック)
    const { data: prev } = await sb
      .from("company_journeys")
      .select("*")
      .eq("company_id", input.companyId)
      .maybeSingle();
    const fromStageKey = prev ? (prev as Row).current_stage_key : undefined;
    const fromOrder = fromStageKey ? defMap.get(fromStageKey) : undefined;
    const isRegression = fromOrder != null && toOrder < fromOrder;
    if (isRegression && !input.acknowledgeRegression) {
      const err: Error & { code?: string } = new Error(
        "company-journey: 後退する変更には acknowledgeRegression=true が必要です"
      );
      err.code = "REGRESSION_REQUIRES_ACK";
      throw err;
    }

    // 3. UPSERT
    const today = new Date().toISOString().slice(0, 10);
    const { data: upserted, error: uErr } = await sb
      .from("company_journeys")
      .upsert(
        {
          company_id: input.companyId,
          organization_id: organizationId,
          current_stage_key: input.toStageKey,
          stage_entered_at: today,
          note: input.note ?? null,
          updated_by: input.changedBy ?? null
        },
        { onConflict: "company_id" }
      )
      .select()
      .single();
    if (uErr) throw new Error(`company_journeys.upsert: ${uErr.message}`);
    const next = toJourney(upserted as Row);

    // 4. event を記録 (best-effort: 失敗しても upsert はロールバックしない)
    const { error: evErr } = await sb.from("journey_events").insert({
      organization_id: organizationId,
      subject_id: input.companyId,
      journey_type: "company",
      from_stage_key: fromStageKey ?? null,
      to_stage_key: input.toStageKey,
      changed_by: input.changedBy ?? null,
      note: input.note ?? null,
      is_regression: isRegression
    });
    if (evErr) throw new Error(`journey_events.insert: ${evErr.message}`);

    await runAfterWrite({
      entityType: "company_journeys",
      entityId: input.companyId,
      before: prev,
      after: next,
      action: "update",
      ctx
    });
    return next;
  },

  async listEvents(companyId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("journey_events")
      .select("*")
      .eq("subject_id", companyId)
      .eq("journey_type", "company")
      .order("changed_at", { ascending: true });
    if (error) throw new Error(`journey_events.list: ${error.message}`);
    return (data ?? []).map((r) => toEvent(r as EventRow));
  }
};
