// participants (Supabase 実装)
// マイグレーション: supabase/migrations/0001_init.sql participants
//
// 列マッピング (snake_case ↔ camelCase):
//   role_title    ↔ role
//   department    ↔ department
//   seniority     ↔ seniority
//   joined_at     ↔ joinedAt (date 型 → YYYY-MM-DD)
//   left_at       ↔ leftAt
//
// 注意: mock 型に存在する title / functions / community / personality / note /
// linkedContactId / continuingFromPrev / customFields は DB に列が無いため
// undefined を返す (将来の列追加で対応予定)。

import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import type { Participant, ParticipantRepo } from "../types";

type Row = {
  id: string;
  organization_id: string;
  company_id: string;
  contract_id: string;
  name: string;
  email: string | null;
  role_title: string | null;
  department: string | null;
  seniority: "young" | "mid" | "senior" | "exec" | null;
  status: "active" | "inactive" | "dropped";
  joined_at: string;
  left_at: string | null;
};

function toParticipant(r: Row): Participant {
  return {
    id: r.id,
    organizationId: r.organization_id,
    companyId: r.company_id,
    contractId: r.contract_id,
    name: r.name,
    email: r.email ?? "",
    role: r.role_title ?? undefined,
    status: r.status,
    joinedAt: r.joined_at,
    leftAt: r.left_at ?? undefined,
    department: r.department ?? undefined,
    seniority: r.seniority ?? undefined
  };
}

export const supabaseParticipantRepo: ParticipantRepo = {
  async listByContract(contractId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("participants")
      .select("*")
      .eq("contract_id", contractId);
    if (error) throw new Error(`participants.listByContract: ${error.message}`);
    return (data ?? []).map((r: Row) => toParticipant(r));
  },

  async list(opts) {
    const sb = getServiceClient();
    if (opts?.productCode) {
      // 該当 product の契約 id を引いてから IN 句で絞る
      let cq = sb.from("contracts").select("id").eq("product_code", opts.productCode);
      if (opts.organizationId) cq = cq.eq("organization_id", opts.organizationId);
      const { data: contracts, error: cErr } = await cq;
      if (cErr) throw new Error(`contracts.list(forParticipants): ${cErr.message}`);
      const ids = (contracts ?? []).map((c: { id: string }) => c.id);
      if (ids.length === 0) return [];
      const { data, error } = await sb
        .from("participants")
        .select("*")
        .in("contract_id", ids);
      if (error) throw new Error(`participants.list: ${error.message}`);
      return (data ?? []).map((r: Row) => toParticipant(r));
    }
    let q = sb.from("participants").select("*");
    if (opts?.organizationId) q = q.eq("organization_id", opts.organizationId);
    const { data, error } = await q;
    if (error) throw new Error(`participants.list: ${error.message}`);
    return (data ?? []).map((r: Row) => toParticipant(r));
  }
};
