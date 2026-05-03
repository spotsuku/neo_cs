import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import { DEFAULT_ORG_ID } from "../types";
import type {
  Contract,
  ContractFilter,
  ContractRepo,
  ContractStatus,
  ProductCode
} from "../types";

type Row = {
  id: string;
  organization_id: string;
  company_id: string;
  product_code: ProductCode;
  course_key: string | null;
  plan_name: string | null;
  start_date: string;
  end_date: string | null;
  mrr_amount: string | null;       // numeric は string で返る
  total_revenue: string | null;
  owner_user_id: string | null;
  participant_count: number | null;
  cycle_number: number;
  previous_contract_id: string | null;
  current_phase: string | null;
  phase_entered_at: string | null;
  status: ContractStatus;
};

function toContract(r: Row, ownerName = ""): Contract {
  return {
    id: r.id,
    organizationId: r.organization_id,
    companyId: r.company_id,
    product: r.product_code,
    courseKey: r.course_key ?? "",
    planName: r.plan_name ?? undefined,
    startDate: r.start_date,
    endDate: r.end_date ?? undefined,
    mrr: r.mrr_amount != null ? Number(r.mrr_amount) : undefined,
    revenue: r.total_revenue != null ? Number(r.total_revenue) : undefined,
    ownerName, // owner_user_id → app_users.name の解決は呼び出し側で別途
    participants: r.participant_count ?? 0,
    cycleNumber: r.cycle_number,
    previousContractId: r.previous_contract_id ?? undefined,
    currentPhase: r.current_phase ?? undefined,
    phaseEnteredAt: r.phase_entered_at ?? undefined,
    status: r.status
    // healthScore は別 repo (healthSnapshots) で取得
  };
}

function toRow(input: Partial<Contract>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.organizationId !== undefined) out.organization_id = input.organizationId;
  if (input.companyId !== undefined) out.company_id = input.companyId;
  if (input.product !== undefined) out.product_code = input.product;
  if (input.courseKey !== undefined) out.course_key = input.courseKey;
  if (input.planName !== undefined) out.plan_name = input.planName ?? null;
  if (input.startDate !== undefined) out.start_date = input.startDate;
  if (input.endDate !== undefined) out.end_date = input.endDate ?? null;
  if (input.mrr !== undefined) out.mrr_amount = input.mrr ?? null;
  if (input.revenue !== undefined) out.total_revenue = input.revenue ?? null;
  if (input.participants !== undefined) out.participant_count = input.participants;
  if (input.cycleNumber !== undefined) out.cycle_number = input.cycleNumber;
  if (input.previousContractId !== undefined)
    out.previous_contract_id = input.previousContractId ?? null;
  if (input.currentPhase !== undefined) out.current_phase = input.currentPhase ?? null;
  if (input.phaseEnteredAt !== undefined) out.phase_entered_at = input.phaseEnteredAt ?? null;
  if (input.status !== undefined) out.status = input.status;
  return out;
}

const ACTIVE_STATUSES: ContractStatus[] = [
  "handoff",
  "onboarding",
  "active",
  "renewal_window"
];

// status フィルタは list 内でインライン実装する（supabase-js のチェイン型を
// 取り回すと型推論が崩れるため、ヘルパ化を諦めた）。

export const supabaseContractRepo: ContractRepo = {
  async list(filter?: ContractFilter) {
    const sb = getServiceClient();
    // supabase-js v2 のチェイン型は select("*") で widening が崩れるため any で受ける
    // (Server-only かつ実行時には正しく動く)
    let q: any = sb.from("contracts").select("*");
    if (filter?.organizationId) q = q.eq("organization_id", filter.organizationId);
    if (filter?.companyId) q = q.eq("company_id", filter.companyId);
    if (filter?.product) q = q.eq("product_code", filter.product);
    if (filter?.ownerUserId) q = q.eq("owner_user_id", filter.ownerUserId);
    if (filter?.activeOnly) q = q.in("status", ACTIVE_STATUSES);
    if (filter?.status) {
      q = Array.isArray(filter.status)
        ? q.in("status", filter.status)
        : q.eq("status", filter.status);
    }
    const { data, error } = await q;
    if (error) throw new Error(`contracts.list: ${error.message}`);
    return (data ?? []).map((r: Row) => toContract(r));
  },

  async getById(id) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("contracts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`contracts.getById: ${error.message}`);
    return data ? toContract(data as Row) : null;
  },

  async listByCompany(companyId, opts) {
    const sb = getServiceClient();
    let q = sb.from("contracts").select("*").eq("company_id", companyId);
    if (opts?.activeOnly) q = q.in("status", ACTIVE_STATUSES);
    const { data, error } = await q;
    if (error) throw new Error(`contracts.listByCompany: ${error.message}`);
    return (data ?? []).map((r: Row) => toContract(r));
  },

  async create(input) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const id = `k-${Math.random().toString(36).slice(2, 10)}`;
    const row = {
      id,
      organization_id: input.organizationId ?? DEFAULT_ORG_ID,
      ...toRow(input)
    };
    const { data, error } = await sb.from("contracts").insert(row).select().single();
    if (error) throw new Error(`contracts.create: ${error.message}`);
    const created = toContract(data as Row, input.ownerName);
    await runAfterWrite({
      entityType: "contracts",
      entityId: created.id,
      after: created,
      action: "create",
      ctx
    });
    return created;
  },

  async update(id, patch) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb
      .from("contracts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const { data, error } = await sb
      .from("contracts")
      .update(toRow(patch))
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(`contracts.update: ${error.message}`);
    const updated = toContract(data as Row);
    await runAfterWrite({
      entityType: "contracts",
      entityId: id,
      before,
      after: updated,
      action: "update",
      ctx
    });
    return updated;
  }
};
