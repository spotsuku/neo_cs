// 事業ジャーニー (契約=商材×期 単位) Supabase リポジトリ
// マイグレーション: supabase/migrations/0029_journey_v2.sql

import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import { DEFAULT_ORG_ID } from "../types";
import type {
  BusinessJourneyRepo,
  BusinessJourney,
  SetBusinessJourneyStageInput
} from "../types";
import type { JourneyEvent, BusinessLifecycleState } from "@/lib/mock/journeys";

type Row = {
  contract_id: string;
  organization_id: string;
  current_stage_key: string;
  stage_entered_at: string;
  lifecycle_state: string;
  lifecycle_reason: string | null;
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

function toJourney(r: Row): BusinessJourney {
  return {
    contractId: r.contract_id,
    organizationId: r.organization_id,
    currentStageKey: r.current_stage_key,
    stageEnteredAt: r.stage_entered_at,
    lifecycleState: r.lifecycle_state as BusinessLifecycleState,
    lifecycleReason: r.lifecycle_reason ?? undefined,
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
    journeyType: "business",
    fromStageKey: r.from_stage_key ?? undefined,
    toStageKey: r.to_stage_key,
    changedAt: r.changed_at,
    changedBy: r.changed_by ?? undefined,
    note: r.note ?? undefined,
    isRegression: r.is_regression
  };
}

export const supabaseBusinessJourneyRepo: BusinessJourneyRepo = {
  async getByContract(contractId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("business_journeys")
      .select("*")
      .eq("contract_id", contractId)
      .maybeSingle();
    if (error) throw new Error(`business_journeys.get: ${error.message}`);
    return data ? toJourney(data as Row) : null;
  },

  async listByCompany(companyId) {
    const sb = getServiceClient();
    // 会社の全契約 ID → business_journeys の行を結合
    const { data: contractIds, error: cErr } = await sb
      .from("contracts")
      .select("id")
      .eq("company_id", companyId);
    if (cErr) throw new Error(`contracts.byCompany: ${cErr.message}`);
    const ids = (contractIds ?? []).map((r: { id: string }) => r.id);
    if (ids.length === 0) return [];
    const { data, error } = await sb
      .from("business_journeys")
      .select("*")
      .in("contract_id", ids);
    if (error) throw new Error(`business_journeys.byCompany: ${error.message}`);
    return (data ?? []).map((r) => toJourney(r as Row));
  },

  async listByContractIds(contractIds) {
    if (contractIds.length === 0) return [];
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("business_journeys")
      .select("*")
      .in("contract_id", contractIds);
    if (error) throw new Error(`business_journeys.byIds: ${error.message}`);
    return (data ?? []).map((r) => toJourney(r as Row));
  },

  async setStage(input: SetBusinessJourneyStageInput) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const organizationId = input.organizationId ?? DEFAULT_ORG_ID;

    const { data: defs, error: dErr } = await sb
      .from("journey_stage_definitions")
      .select("stage_key, display_order")
      .eq("organization_id", organizationId)
      .eq("journey_type", "business");
    if (dErr) throw new Error(`journey_stage_definitions.read: ${dErr.message}`);
    const defMap = new Map<string, number>(
      (defs ?? []).map((d: { stage_key: string; display_order: number }) => [
        d.stage_key,
        d.display_order
      ])
    );
    const toOrder = defMap.get(input.toStageKey);
    if (toOrder == null) {
      throw new Error(`Unknown business journey stage: ${input.toStageKey}`);
    }

    const { data: prev } = await sb
      .from("business_journeys")
      .select("*")
      .eq("contract_id", input.contractId)
      .maybeSingle();
    const fromStageKey = prev ? (prev as Row).current_stage_key : undefined;
    const fromOrder = fromStageKey ? defMap.get(fromStageKey) : undefined;
    const isRegression = fromOrder != null && toOrder < fromOrder;
    if (isRegression && !input.acknowledgeRegression) {
      const err: Error & { code?: string } = new Error(
        "business-journey: 後退する変更には acknowledgeRegression=true が必要です"
      );
      err.code = "REGRESSION_REQUIRES_ACK";
      throw err;
    }

    const today = new Date().toISOString().slice(0, 10);
    const { data: upserted, error: uErr } = await sb
      .from("business_journeys")
      .upsert(
        {
          contract_id: input.contractId,
          organization_id: organizationId,
          current_stage_key: input.toStageKey,
          stage_entered_at: today,
          note: input.note ?? null,
          updated_by: input.changedBy ?? null
          // lifecycle_state は別 API で更新するため、ここでは触らない
          // (新規行の場合は default 'active' が入る)
        },
        { onConflict: "contract_id" }
      )
      .select()
      .single();
    if (uErr) throw new Error(`business_journeys.upsert: ${uErr.message}`);
    const next = toJourney(upserted as Row);

    const { error: evErr } = await sb.from("journey_events").insert({
      organization_id: organizationId,
      subject_id: input.contractId,
      journey_type: "business",
      from_stage_key: fromStageKey ?? null,
      to_stage_key: input.toStageKey,
      changed_by: input.changedBy ?? null,
      note: input.note ?? null,
      is_regression: isRegression
    });
    if (evErr) throw new Error(`journey_events.insert: ${evErr.message}`);

    await runAfterWrite({
      entityType: "business_journeys",
      entityId: input.contractId,
      before: prev,
      after: next,
      action: "update",
      ctx
    });
    return next;
  },

  async setLifecycleState(input) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb
      .from("business_journeys")
      .select("*")
      .eq("contract_id", input.contractId)
      .maybeSingle();
    if (!before) {
      throw new Error(`business-journey not found: ${input.contractId}`);
    }
    const { data, error } = await sb
      .from("business_journeys")
      .update({
        lifecycle_state: input.state,
        lifecycle_reason: input.reason ?? null,
        updated_by: input.changedBy ?? null
      })
      .eq("contract_id", input.contractId)
      .select()
      .single();
    if (error) throw new Error(`business_journeys.setLifecycleState: ${error.message}`);
    const next = toJourney(data as Row);
    await runAfterWrite({
      entityType: "business_journeys",
      entityId: input.contractId,
      before,
      after: next,
      action: "update",
      ctx
    });
    return next;
  },

  async listEvents(contractId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("journey_events")
      .select("*")
      .eq("subject_id", contractId)
      .eq("journey_type", "business")
      .order("changed_at", { ascending: true });
    if (error) throw new Error(`journey_events.list: ${error.message}`);
    return (data ?? []).map((r) => toEvent(r as EventRow));
  }
};
