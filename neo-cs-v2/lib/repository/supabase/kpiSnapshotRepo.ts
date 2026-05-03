import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import type { KpiSnapshot, KpiSnapshotFilter, KpiSnapshotRepo } from "../types";

type Row = {
  organization_id: string;
  as_of: string;
  total_mrr: string;
  total_arr: string;
  active_contract_count: number;
  active_company_count: number;
  churn_rate_30d: string | null;
  churn_rate_90d: string | null;
  nrr_30d: string | null;
  nrr_90d: string | null;
  at_risk_mrr: string | null;
  by_product: Record<string, number> | null;
  by_segment: Record<string, number> | null;
  computed_at: string;
};

function num(v: string | null): number | undefined {
  return v == null ? undefined : Number(v);
}

function toSnap(r: Row): KpiSnapshot {
  return {
    organizationId: r.organization_id,
    asOf: r.as_of,
    totalMrr: Number(r.total_mrr),
    totalArr: Number(r.total_arr),
    activeContractCount: r.active_contract_count,
    activeCompanyCount: r.active_company_count,
    churnRate30d: num(r.churn_rate_30d),
    churnRate90d: num(r.churn_rate_90d),
    nrr30d: num(r.nrr_30d),
    nrr90d: num(r.nrr_90d),
    atRiskMrr: num(r.at_risk_mrr),
    byProduct: r.by_product ?? {},
    bySegment: r.by_segment ?? {},
    computedAt: r.computed_at
  };
}

export const supabaseKpiSnapshotRepo: KpiSnapshotRepo = {
  async list(filter?: KpiSnapshotFilter) {
    const sb = getServiceClient();
    let q = sb
      .from("kpi_snapshots")
      .select("*")
      .order("as_of", { ascending: true });
    if (filter?.organizationId) q = q.eq("organization_id", filter.organizationId);
    if (filter?.fromAsOf) q = q.gte("as_of", filter.fromAsOf);
    if (filter?.toAsOf) q = q.lte("as_of", filter.toAsOf);
    if (filter?.limit) q = q.limit(filter.limit);
    const { data, error } = await q;
    if (error) throw new Error(`kpi_snapshots.list: ${error.message}`);
    return (data ?? []).map((r: Row) => toSnap(r));
  },

  async latest(opts) {
    const sb = getServiceClient();
    let q = sb
      .from("kpi_snapshots")
      .select("*")
      .order("as_of", { ascending: false })
      .limit(1);
    if (opts?.organizationId) q = q.eq("organization_id", opts.organizationId);
    if (opts?.asOf) q = q.lte("as_of", opts.asOf);
    const { data, error } = await q.maybeSingle();
    if (error) throw new Error(`kpi_snapshots.latest: ${error.message}`);
    return data ? toSnap(data as Row) : null;
  },

  async upsert(snap) {
    const sb = getServiceClient();
    const { error } = await sb.from("kpi_snapshots").upsert(
      {
        organization_id: snap.organizationId,
        as_of: snap.asOf,
        total_mrr: snap.totalMrr,
        total_arr: snap.totalArr,
        active_contract_count: snap.activeContractCount,
        active_company_count: snap.activeCompanyCount,
        churn_rate_30d: snap.churnRate30d ?? null,
        churn_rate_90d: snap.churnRate90d ?? null,
        nrr_30d: snap.nrr30d ?? null,
        nrr_90d: snap.nrr90d ?? null,
        at_risk_mrr: snap.atRiskMrr ?? null,
        by_product: snap.byProduct,
        by_segment: snap.bySegment,
        computed_at: snap.computedAt
      },
      { onConflict: "organization_id,as_of" }
    );
    if (error) throw new Error(`kpi_snapshots.upsert: ${error.message}`);
  }
};
