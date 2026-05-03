import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import type { HealthSnapshot, HealthSnapshotRepo } from "../types";

type Row = {
  organization_id: string;
  contract_id: string;
  as_of_date: string;
  score: number;
  color: "green" | "yellow" | "red";
  factors: HealthSnapshot["factors"];
  computed_at: string;
};

function toSnap(r: Row): HealthSnapshot {
  return {
    organizationId: r.organization_id,
    contractId: r.contract_id,
    asOf: r.as_of_date,
    score: r.score,
    color: r.color,
    factors: r.factors ?? {},
    computedAt: r.computed_at
  };
}

export const supabaseHealthSnapshotRepo: HealthSnapshotRepo = {
  async listByContract(contractId, opts) {
    const sb = getServiceClient();
    let q = sb
      .from("health_score_snapshots")
      .select("*")
      .eq("contract_id", contractId)
      .order("as_of_date", { ascending: true });
    if (opts?.from) q = q.gte("as_of_date", opts.from);
    if (opts?.to) q = q.lte("as_of_date", opts.to);
    const { data, error } = await q;
    if (error) throw new Error(`health_score_snapshots.listByContract: ${error.message}`);
    return (data ?? []).map((r: Row) => toSnap(r));
  },

  async latestAll(opts) {
    // (organization_id, contract_id) ごとに as_of_date <= target で最新の1行を採用。
    // Supabase JS には DISTINCT ON が無いため、サーバー側で latest を解決する RPC か
    // ビューを作るのが本筋。本実装は対象範囲を取得してアプリ側で reduce する
    // (kpi_snapshots と同じ程度の件数で運用される想定)。
    const sb = getServiceClient();
    let q = sb
      .from("health_score_snapshots")
      .select("*")
      .order("as_of_date", { ascending: false });
    if (opts?.organizationId) q = q.eq("organization_id", opts.organizationId);
    if (opts?.asOf) q = q.lte("as_of_date", opts.asOf);
    const { data, error } = await q;
    if (error) throw new Error(`health_score_snapshots.latestAll: ${error.message}`);
    const seen = new Set<string>();
    const out: HealthSnapshot[] = [];
    for (const r of (data ?? []) as Row[]) {
      if (seen.has(r.contract_id)) continue;
      seen.add(r.contract_id);
      out.push(toSnap(r));
    }
    return out;
  },

  async upsert(snap) {
    // service_role 経由 (RLS バイパス)。日次バッチから呼ぶ。
    const sb = getServiceClient();
    const { error } = await sb.from("health_score_snapshots").upsert(
      {
        organization_id: snap.organizationId,
        contract_id: snap.contractId,
        as_of_date: snap.asOf,
        score: snap.score,
        color: snap.color,
        factors: snap.factors,
        computed_at: snap.computedAt
      },
      { onConflict: "contract_id,as_of_date" }
    );
    if (error) throw new Error(`health_score_snapshots.upsert: ${error.message}`);
  }
};
