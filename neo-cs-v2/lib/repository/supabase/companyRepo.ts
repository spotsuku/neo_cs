import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import { DEFAULT_ORG_ID } from "../types";
import type { Company, CompanyFilter, CompanyRepo } from "../types";

type Row = {
  id: string;
  organization_id: string;
  corporate_number: string | null;
  name: string;
  kana: string | null;
  industry: string | null;
  address: string | null;
  group_name: string | null;
  owner_user_id: string | null;
  memo: string | null;
};

function toCompany(row: Row, ownerName: string = ""): Company {
  // Domain型 (mock互換) は ownerName / contracts / mrr / lastTouchDays を持つが、
  // これらは別テーブル / view に分離されているため本リポジトリでは省略 or 既定値。
  // 後段の画面リファクタで Repository が contracts/health/touch を組み合わせて返す。
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    kana: row.kana ?? "",
    industry: row.industry ?? "",
    address: row.address ?? "",
    group: row.group_name ?? undefined,
    ownerName,
    contracts: [],
    mrr: 0,
    lastTouchDays: 0,
    memo: row.memo ?? undefined
  };
}

function toRow(input: Partial<Company>): Partial<Row> {
  const out: Partial<Row> = {};
  if (input.id !== undefined) out.id = input.id;
  if (input.organizationId !== undefined) out.organization_id = input.organizationId;
  if (input.name !== undefined) out.name = input.name;
  if (input.kana !== undefined) out.kana = input.kana;
  if (input.industry !== undefined) out.industry = input.industry;
  if (input.address !== undefined) out.address = input.address;
  if (input.group !== undefined) out.group_name = input.group ?? null;
  if (input.memo !== undefined) out.memo = input.memo ?? null;
  return out;
}

export const supabaseCompanyRepo: CompanyRepo = {
  async list(filter?: CompanyFilter) {
    const sb = getServiceClient();
    let q = sb.from("companies").select("*").eq("is_active", true);
    if (filter?.organizationId) q = q.eq("organization_id", filter.organizationId);
    if (filter?.industry) q = q.eq("industry", filter.industry);
    if (filter?.search) q = q.ilike("name", `%${filter.search}%`);
    const { data, error } = await q;
    if (error) throw new Error(`companies.list: ${error.message}`);
    return (data ?? []).map((r: Row) => toCompany(r));
  },

  async getById(id: string) {
    const sb = getServiceClient();
    const { data, error } = await sb.from("companies").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`companies.getById: ${error.message}`);
    return data ? toCompany(data as Row) : null;
  },

  async create(input) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const row: Row = {
      id: `c-${Math.random().toString(36).slice(2, 10)}`,
      organization_id: input.organizationId ?? DEFAULT_ORG_ID,
      corporate_number: null,
      name: input.name,
      kana: input.kana,
      industry: input.industry,
      address: input.address,
      group_name: input.group ?? null,
      owner_user_id: null,
      memo: input.memo ?? null
    };
    const { data, error } = await sb.from("companies").insert(row).select().single();
    if (error) throw new Error(`companies.create: ${error.message}`);
    const created = toCompany(data as Row, input.ownerName);
    await runAfterWrite({
      entityType: "companies",
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
    const { data: before } = await sb.from("companies").select("*").eq("id", id).maybeSingle();
    const { data, error } = await sb
      .from("companies")
      .update(toRow(patch))
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(`companies.update: ${error.message}`);
    const updated = toCompany(data as Row);
    await runAfterWrite({
      entityType: "companies",
      entityId: id,
      before,
      after: updated,
      action: "update",
      ctx
    });
    return updated;
  },

  async delete(id) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb.from("companies").select("*").eq("id", id).maybeSingle();
    // 論理削除: is_active=false + archived_at
    const { error } = await sb
      .from("companies")
      .update({ is_active: false, archived_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(`companies.delete: ${error.message}`);
    await runAfterWrite({
      entityType: "companies",
      entityId: id,
      before,
      action: "delete",
      ctx
    });
  }
};
