import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import type {
  ChurnSignalFilter,
  ChurnSignalRecord,
  ChurnSignalRepo,
  ChurnSignalRule,
  ChurnSignalSeverity,
  ChurnSignalUpsertInput,
  ProductCode
} from "../types";

type Row = {
  id: string;
  organization_id: string;
  contract_id: string;
  company_id: string;
  product: ProductCode;
  rule: ChurnSignalRule;
  severity: ChurnSignalSeverity;
  weight: number;
  reason: string;
  evidence: Record<string, unknown>;
  detected_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  notified_at: string | null;
};

function toRecord(r: Row): ChurnSignalRecord {
  return {
    id: r.id,
    organizationId: r.organization_id,
    contractId: r.contract_id,
    companyId: r.company_id,
    product: r.product,
    rule: r.rule,
    severity: r.severity,
    weight: r.weight,
    reason: r.reason,
    evidence: r.evidence ?? {},
    detectedAt: r.detected_at,
    resolvedAt: r.resolved_at ?? undefined,
    resolvedBy: r.resolved_by ?? undefined,
    resolutionNote: r.resolution_note ?? undefined,
    notifiedAt: r.notified_at ?? undefined
  };
}

export const supabaseChurnSignalRepo: ChurnSignalRepo = {
  async list(filter?: ChurnSignalFilter) {
    const sb = getServiceClient();
    let q = sb.from("churn_signals").select("*").order("detected_at", { ascending: false });
    if (filter?.organizationId) q = q.eq("organization_id", filter.organizationId);
    if (filter?.contractId) q = q.eq("contract_id", filter.contractId);
    if (filter?.companyId) q = q.eq("company_id", filter.companyId);
    if (filter?.rule) q = q.eq("rule", filter.rule);
    if (filter?.severity) q = q.eq("severity", filter.severity);
    if (filter?.resolvedOnly) q = q.not("resolved_at", "is", null);
    if (filter?.unresolvedOnly) q = q.is("resolved_at", null);
    if (filter?.unNotifiedOnly) q = q.is("notified_at", null);
    const { data, error } = await q;
    if (error) throw new Error(`churn_signals.list: ${error.message}`);
    return (data ?? []).map((r: Row) => toRecord(r));
  },

  async listByContract(contractId, opts) {
    const sb = getServiceClient();
    let q = sb
      .from("churn_signals")
      .select("*")
      .eq("contract_id", contractId)
      .order("detected_at", { ascending: false });
    if (opts?.unresolvedOnly) q = q.is("resolved_at", null);
    const { data, error } = await q;
    if (error) throw new Error(`churn_signals.listByContract: ${error.message}`);
    return (data ?? []).map((r: Row) => toRecord(r));
  },

  async upsert(input: ChurnSignalUpsertInput) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const id = input.id ?? `cs-${input.contractId}-${input.rule}`;

    // 既存があれば resolved/notified を維持 (mock 同様の挙動)
    const { data: prev } = await sb
      .from("churn_signals")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    const row = {
      id,
      organization_id: input.organizationId,
      contract_id: input.contractId,
      company_id: input.companyId,
      product: input.product,
      rule: input.rule,
      severity: input.severity,
      weight: input.weight,
      reason: input.reason,
      evidence: input.evidence,
      detected_at: input.detectedAt,
      resolved_at: (prev as Row | null)?.resolved_at ?? null,
      resolved_by: (prev as Row | null)?.resolved_by ?? null,
      resolution_note: (prev as Row | null)?.resolution_note ?? null,
      notified_at: (prev as Row | null)?.notified_at ?? null
    };

    const { data, error } = await sb
      .from("churn_signals")
      .upsert(row, { onConflict: "id" })
      .select()
      .single();
    if (error) throw new Error(`churn_signals.upsert: ${error.message}`);

    const result = toRecord(data as Row);
    await runAfterWrite({
      entityType: "churn_signals",
      entityId: id,
      before: prev ?? undefined,
      after: result,
      action: prev ? "update" : "create",
      ctx
    });
    return result;
  },

  async resolve(id, opts) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb
      .from("churn_signals")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const patch = {
      resolved_at: opts.resolvedAt ?? new Date().toISOString(),
      resolved_by: opts.resolvedBy ?? null,
      resolution_note: opts.note ?? null
    };
    const { error } = await sb.from("churn_signals").update(patch).eq("id", id);
    if (error) throw new Error(`churn_signals.resolve: ${error.message}`);
    await runAfterWrite({
      entityType: "churn_signals",
      entityId: id,
      before,
      after: patch,
      action: "update",
      ctx
    });
  },

  async markNotified(id, notifiedAt) {
    const sb = getServiceClient();
    const { error } = await sb
      .from("churn_signals")
      .update({ notified_at: notifiedAt ?? new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(`churn_signals.markNotified: ${error.message}`);
    // markNotified は監査ログとしては低価値 (毎回大量に発行されうる) のため
    // runAfterWrite を意図的に呼ばない。
  }
};
