import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import type {
  ExpansionKind,
  ExpansionOpportunityFilter,
  ExpansionOpportunityRecord,
  ExpansionOpportunityRepo,
  ExpansionOpportunityUpsertInput,
  ExpansionRule,
  ProductCode
} from "../types";

type Row = {
  id: string;
  organization_id: string;
  contract_id: string;
  company_id: string;
  product: ProductCode;
  kind: ExpansionKind;
  rule: ExpansionRule;
  score: string;                    // numeric は string
  reason: string;
  evidence: Record<string, unknown>;
  suggested_action: string | null;
  estimated_upsell_jpy: string | null;
  detected_at: string;
  handed_off_at: string | null;
  handed_off_to: string | null;
  handed_off_note: string | null;
  closed_at: string | null;
  closed_reason: ExpansionOpportunityRecord["closedReason"] | null;
  notified_at: string | null;
};

function toRecord(r: Row): ExpansionOpportunityRecord {
  return {
    id: r.id,
    organizationId: r.organization_id,
    contractId: r.contract_id,
    companyId: r.company_id,
    product: r.product,
    kind: r.kind,
    rule: r.rule,
    score: Number(r.score),
    reason: r.reason,
    evidence: r.evidence ?? {},
    suggestedAction: r.suggested_action ?? "",
    estimatedUpsellJpy:
      r.estimated_upsell_jpy != null ? Number(r.estimated_upsell_jpy) : undefined,
    detectedAt: r.detected_at,
    handedOffAt: r.handed_off_at ?? undefined,
    handedOffTo: r.handed_off_to ?? undefined,
    handedOffNote: r.handed_off_note ?? undefined,
    closedAt: r.closed_at ?? undefined,
    closedReason: r.closed_reason ?? undefined,
    notifiedAt: r.notified_at ?? undefined
  };
}

export const supabaseExpansionOpportunityRepo: ExpansionOpportunityRepo = {
  async list(filter?: ExpansionOpportunityFilter) {
    const sb = getServiceClient();
    let q = sb
      .from("expansion_opportunities")
      .select("*")
      .order("score", { ascending: false })
      .order("detected_at", { ascending: false });
    if (filter?.organizationId) q = q.eq("organization_id", filter.organizationId);
    if (filter?.contractId) q = q.eq("contract_id", filter.contractId);
    if (filter?.companyId) q = q.eq("company_id", filter.companyId);
    if (filter?.kind) q = q.eq("kind", filter.kind);
    if (filter?.rule) q = q.eq("rule", filter.rule);
    if (filter?.openOnly) q = q.is("closed_at", null);
    if (filter?.unNotifiedOnly) q = q.is("notified_at", null);
    if (filter?.minScore !== undefined) q = q.gte("score", filter.minScore);
    const { data, error } = await q;
    if (error) throw new Error(`expansion_opportunities.list: ${error.message}`);
    return (data ?? []).map((r: Row) => toRecord(r));
  },

  async listByContract(contractId, opts) {
    const sb = getServiceClient();
    let q = sb
      .from("expansion_opportunities")
      .select("*")
      .eq("contract_id", contractId)
      .order("score", { ascending: false });
    if (opts?.openOnly) q = q.is("closed_at", null);
    const { data, error } = await q;
    if (error) throw new Error(`expansion_opportunities.listByContract: ${error.message}`);
    return (data ?? []).map((r: Row) => toRecord(r));
  },

  async upsert(input: ExpansionOpportunityUpsertInput) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const id = input.id ?? `exp-${input.contractId}-${input.rule}`;

    // 既存があれば handoff/closed/notified 情報は維持 (mock 同様)
    const { data: prev } = await sb
      .from("expansion_opportunities")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const p = prev as Row | null;

    const row = {
      id,
      organization_id: input.organizationId,
      contract_id: input.contractId,
      company_id: input.companyId,
      product: input.product,
      kind: input.kind,
      rule: input.rule,
      score: input.score,
      reason: input.reason,
      evidence: input.evidence,
      suggested_action: input.suggestedAction ?? null,
      estimated_upsell_jpy: input.estimatedUpsellJpy ?? null,
      detected_at: input.detectedAt,
      handed_off_at: p?.handed_off_at ?? null,
      handed_off_to: p?.handed_off_to ?? null,
      handed_off_note: p?.handed_off_note ?? null,
      closed_at: p?.closed_at ?? null,
      closed_reason: p?.closed_reason ?? null,
      notified_at: p?.notified_at ?? null
    };

    const { data, error } = await sb
      .from("expansion_opportunities")
      .upsert(row, { onConflict: "id" })
      .select()
      .single();
    if (error) throw new Error(`expansion_opportunities.upsert: ${error.message}`);

    const result = toRecord(data as Row);
    await runAfterWrite({
      entityType: "expansion_opportunities",
      entityId: id,
      before: prev ?? undefined,
      after: result,
      action: prev ? "update" : "create",
      ctx
    });
    return result;
  },

  async handOff(id, opts) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb
      .from("expansion_opportunities")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const patch = {
      handed_off_at: opts.handedOffAt ?? new Date().toISOString(),
      handed_off_to: opts.handedOffTo,
      handed_off_note: opts.note ?? null
    };
    const { error } = await sb.from("expansion_opportunities").update(patch).eq("id", id);
    if (error) throw new Error(`expansion_opportunities.handOff: ${error.message}`);
    await runAfterWrite({
      entityType: "expansion_opportunities",
      entityId: id,
      before,
      after: patch,
      action: "update",
      ctx
    });
  },

  async close(id, opts) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb
      .from("expansion_opportunities")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const patch = {
      closed_at: opts.closedAt ?? new Date().toISOString(),
      closed_reason: opts.reason
    };
    const { error } = await sb.from("expansion_opportunities").update(patch).eq("id", id);
    if (error) throw new Error(`expansion_opportunities.close: ${error.message}`);
    await runAfterWrite({
      entityType: "expansion_opportunities",
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
      .from("expansion_opportunities")
      .update({ notified_at: notifiedAt ?? new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(`expansion_opportunities.markNotified: ${error.message}`);
    // markNotified は監査ログとしては低価値のため runAfterWrite を呼ばない
  }
};
