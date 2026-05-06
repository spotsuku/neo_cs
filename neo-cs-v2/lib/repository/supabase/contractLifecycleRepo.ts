// 契約ライフサイクル スナップショット Supabase リポジトリ
// マイグレーション: supabase/migrations/0030_company_vision_weather_lifecycle.sql
// 解約 / 更新成功 / 期満了の時点で freeze。読み取り中心。

import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import type {
  ContractLifecycleRepo,
  ContractLifecycleSnapshot
} from "../types";
import type {
  BusinessLifecycleState,
  JourneyCheckpointStatus
} from "@/lib/mock/journeys";

type Row = {
  contract_id: string;
  organization_id: string;
  ended_as: string;
  ended_at: string;
  final_stage_key: string;
  final_lifecycle_state: string;
  metrics: ContractLifecycleSnapshot["metrics"];
  churn_reason: string | null;
  succeeded_by_contract_id: string | null;
  checkpoint_status_snapshot: JourneyCheckpointStatus[] | null;
  created_at: string;
};

function toSnapshot(r: Row): ContractLifecycleSnapshot {
  return {
    contractId: r.contract_id,
    organizationId: r.organization_id,
    endedAs: r.ended_as as ContractLifecycleSnapshot["endedAs"],
    endedAt: r.ended_at,
    finalStageKey: r.final_stage_key,
    finalLifecycleState: r.final_lifecycle_state as BusinessLifecycleState,
    metrics: r.metrics ?? {},
    churnReason: r.churn_reason ?? undefined,
    succeededByContractId: r.succeeded_by_contract_id ?? undefined,
    checkpointStatusSnapshot: r.checkpoint_status_snapshot ?? undefined,
    createdAt: r.created_at
  };
}

export const supabaseContractLifecycleRepo: ContractLifecycleRepo = {
  async listByCompany(companyId) {
    const sb = getServiceClient();
    const { data: contractIds, error: cErr } = await sb
      .from("contracts")
      .select("id")
      .eq("company_id", companyId);
    if (cErr) throw new Error(`contracts.byCompany: ${cErr.message}`);
    const ids = (contractIds ?? []).map((r: { id: string }) => r.id);
    if (ids.length === 0) return [];
    const { data, error } = await sb
      .from("contract_lifecycle_snapshots")
      .select("*")
      .in("contract_id", ids)
      .order("ended_at", { ascending: false });
    if (error) throw new Error(`contract_lifecycle_snapshots.byCompany: ${error.message}`);
    return (data ?? []).map((r) => toSnapshot(r as Row));
  },

  async getByContract(contractId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("contract_lifecycle_snapshots")
      .select("*")
      .eq("contract_id", contractId)
      .maybeSingle();
    if (error) throw new Error(`contract_lifecycle_snapshots.get: ${error.message}`);
    return data ? toSnapshot(data as Row) : null;
  },

  async freeze(input) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb
      .from("contract_lifecycle_snapshots")
      .select("*")
      .eq("contract_id", input.contractId)
      .maybeSingle();
    const { data, error } = await sb
      .from("contract_lifecycle_snapshots")
      .upsert(
        {
          contract_id: input.contractId,
          organization_id: input.organizationId,
          ended_as: input.endedAs,
          ended_at: input.endedAt,
          final_stage_key: input.finalStageKey,
          final_lifecycle_state: input.finalLifecycleState,
          metrics: input.metrics ?? {},
          churn_reason: input.churnReason ?? null,
          succeeded_by_contract_id: input.succeededByContractId ?? null,
          checkpoint_status_snapshot: input.checkpointStatusSnapshot ?? null
        },
        { onConflict: "contract_id" }
      )
      .select()
      .single();
    if (error) throw new Error(`contract_lifecycle_snapshots.freeze: ${error.message}`);
    const next = toSnapshot(data as Row);
    await runAfterWrite({
      entityType: "contract_lifecycle_snapshots",
      entityId: input.contractId,
      before,
      after: next,
      action: before ? "update" : "create",
      ctx
    });
    return next;
  },

  async unfreeze(contractId) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb
      .from("contract_lifecycle_snapshots")
      .select("*")
      .eq("contract_id", contractId)
      .maybeSingle();
    if (!before) return;
    const { error } = await sb
      .from("contract_lifecycle_snapshots")
      .delete()
      .eq("contract_id", contractId);
    if (error) throw new Error(`contract_lifecycle_snapshots.unfreeze: ${error.message}`);
    await runAfterWrite({
      entityType: "contract_lifecycle_snapshots",
      entityId: contractId,
      before,
      action: "delete",
      ctx
    });
  }
};
