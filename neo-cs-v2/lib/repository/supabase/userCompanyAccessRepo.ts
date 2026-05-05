// user_company_access の Supabase 実装
// マイグレーション: supabase/migrations/0022_user_program_roles.sql

import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import { DEFAULT_ORG_ID } from "../types";
import type { UserCompanyAccess, UserCompanyAccessRepo } from "../types";

type Row = {
  user_id: string;
  organization_id: string;
  company_id: string;
  granted_at: string;
  granted_by: string | null;
};

function toEntity(r: Row): UserCompanyAccess {
  return {
    userId: r.user_id,
    organizationId: r.organization_id,
    companyId: r.company_id,
    grantedAt: r.granted_at,
    grantedBy: r.granted_by ?? undefined
  };
}

export const supabaseUserCompanyAccessRepo: UserCompanyAccessRepo = {
  async listByUser(userId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("user_company_access")
      .select("*")
      .eq("user_id", userId);
    if (error) throw new Error(`user_company_access.listByUser: ${error.message}`);
    return (data ?? []).map((r: Row) => toEntity(r));
  },

  async listByCompany(companyId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("user_company_access")
      .select("*")
      .eq("company_id", companyId);
    if (error) throw new Error(`user_company_access.listByCompany: ${error.message}`);
    return (data ?? []).map((r: Row) => toEntity(r));
  },

  async grant(input) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const row = {
      user_id: input.userId,
      organization_id: input.organizationId ?? DEFAULT_ORG_ID,
      company_id: input.companyId,
      granted_at: input.grantedAt ?? new Date().toISOString(),
      granted_by: input.grantedBy ?? null
    };
    const { data, error } = await sb
      .from("user_company_access")
      .upsert(row, { onConflict: "user_id,company_id" })
      .select("*")
      .single();
    if (error) throw new Error(`user_company_access.grant: ${error.message}`);
    await runAfterWrite({
      entityType: "user_company_access",
      entityId: `${input.userId}/${input.companyId}`,
      before: null,
      after: row,
      action: "create",
      ctx
    });
    return toEntity(data as Row);
  },

  async revoke(userId, companyId) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb
      .from("user_company_access")
      .select("*")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .maybeSingle();
    const { error } = await sb
      .from("user_company_access")
      .delete()
      .eq("user_id", userId)
      .eq("company_id", companyId);
    if (error) throw new Error(`user_company_access.revoke: ${error.message}`);
    if (before) {
      await runAfterWrite({
        entityType: "user_company_access",
        entityId: `${userId}/${companyId}`,
        before,
        after: null,
        action: "delete",
        ctx
      });
    }
  }
};
