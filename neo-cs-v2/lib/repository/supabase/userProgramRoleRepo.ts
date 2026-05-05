// user_program_roles の Supabase 実装
// マイグレーション: supabase/migrations/0022_user_program_roles.sql

import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import type {
  UserProgramRole,
  UserProgramRoleRepo,
  ProgramScopeRole
} from "../types";

type Row = {
  user_id: string;
  organization_id: string;
  product_code: string;
  scope_role: ProgramScopeRole;
  assigned_at: string;
  assigned_by: string | null;
};

function toEntity(r: Row): UserProgramRole {
  return {
    userId: r.user_id,
    organizationId: r.organization_id,
    productCode: r.product_code,
    scopeRole: r.scope_role,
    assignedAt: r.assigned_at,
    assignedBy: r.assigned_by ?? undefined
  };
}

export const supabaseUserProgramRoleRepo: UserProgramRoleRepo = {
  async listByUser(userId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("user_program_roles")
      .select("*")
      .eq("user_id", userId);
    if (error) throw new Error(`user_program_roles.listByUser: ${error.message}`);
    return (data ?? []).map((r: Row) => toEntity(r));
  },

  async listByProduct(productCode, opts) {
    const sb = getServiceClient();
    let q = sb.from("user_program_roles").select("*").eq("product_code", productCode);
    if (opts?.organizationId) q = q.eq("organization_id", opts.organizationId);
    const { data, error } = await q;
    if (error) throw new Error(`user_program_roles.listByProduct: ${error.message}`);
    return (data ?? []).map((r: Row) => toEntity(r));
  },

  async list(opts) {
    const sb = getServiceClient();
    let q = sb.from("user_program_roles").select("*");
    if (opts?.organizationId) q = q.eq("organization_id", opts.organizationId);
    const { data, error } = await q;
    if (error) throw new Error(`user_program_roles.list: ${error.message}`);
    return (data ?? []).map((r: Row) => toEntity(r));
  },

  async upsert(input) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb
      .from("user_program_roles")
      .select("*")
      .eq("user_id", input.userId)
      .eq("product_code", input.productCode)
      .maybeSingle();

    const row = {
      user_id: input.userId,
      organization_id: input.organizationId,
      product_code: input.productCode,
      scope_role: input.scopeRole,
      assigned_at: input.assignedAt ?? new Date().toISOString(),
      assigned_by: input.assignedBy ?? null
    };
    const { data, error } = await sb
      .from("user_program_roles")
      .upsert(row, { onConflict: "user_id,product_code" })
      .select("*")
      .single();
    if (error) throw new Error(`user_program_roles.upsert: ${error.message}`);

    await runAfterWrite({
      entityType: "user_program_roles",
      entityId: `${input.userId}/${input.productCode}`,
      before,
      after: row,
      action: before ? "update" : "create",
      ctx
    });
    return toEntity(data as Row);
  },

  async remove(userId, productCode) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb
      .from("user_program_roles")
      .select("*")
      .eq("user_id", userId)
      .eq("product_code", productCode)
      .maybeSingle();
    const { error } = await sb
      .from("user_program_roles")
      .delete()
      .eq("user_id", userId)
      .eq("product_code", productCode);
    if (error) throw new Error(`user_program_roles.remove: ${error.message}`);

    if (before) {
      await runAfterWrite({
        entityType: "user_program_roles",
        entityId: `${userId}/${productCode}`,
        before,
        after: null,
        action: "delete",
        ctx
      });
    }
  }
};
