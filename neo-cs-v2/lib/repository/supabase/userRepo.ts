import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import type { AppUser, AppUserRole, UserRepo } from "../types";

type Row = {
  id: string;
  organization_id: string;
  auth_user_id: string | null;
  email: string;
  name: string;
  picture_url: string | null;
  role: AppUserRole;
  is_active: boolean;
  disabled_at: string | null;
  last_login_at: string | null;
  created_at: string;
};

function toUser(row: Row): AppUser {
  return {
    id: row.id,
    organizationId: row.organization_id,
    authUserId: row.auth_user_id ?? undefined,
    email: row.email,
    name: row.name,
    pictureUrl: row.picture_url ?? undefined,
    role: row.role,
    isActive: row.is_active,
    disabledAt: row.disabled_at ?? undefined,
    lastLoginAt: row.last_login_at ?? undefined,
    createdAt: row.created_at
  };
}

export const supabaseUserRepo: UserRepo = {
  async list(opts) {
    const sb = getServiceClient();
    let q = sb.from("app_users").select("*");
    if (opts?.organizationId) q = q.eq("organization_id", opts.organizationId);
    if (opts?.activeOnly) q = q.eq("is_active", true);
    const { data, error } = await q;
    if (error) throw new Error(`app_users.list: ${error.message}`);
    return (data ?? []).map((r: Row) => toUser(r));
  },

  async getById(id) {
    const sb = getServiceClient();
    const { data, error } = await sb.from("app_users").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`app_users.getById: ${error.message}`);
    return data ? toUser(data as Row) : null;
  },

  async getByEmail(email) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("app_users")
      .select("*")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    if (error) throw new Error(`app_users.getByEmail: ${error.message}`);
    return data ? toUser(data as Row) : null;
  },

  async getCurrent() {
    // RLS が有効になり次第 auth.uid() ベースのSELECTに切替。
    // 現状は service_role 経由で auth_user_id をもとに取得するヘルパーは
    // middleware.ts 整備とセットで P1 後半。MOCK_CURRENT_USER_EMAIL があれば優先。
    const sb = getServiceClient();
    const email = process.env.MOCK_CURRENT_USER_EMAIL;
    if (!email) return null;
    const { data, error } = await sb
      .from("app_users")
      .select("*")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    if (error) throw new Error(`app_users.getCurrent: ${error.message}`);
    return data ? toUser(data as Row) : null;
  },

  async setRole(id, role) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb.from("app_users").select("role").eq("id", id).maybeSingle();
    const { error } = await sb.from("app_users").update({ role }).eq("id", id);
    if (error) throw new Error(`app_users.setRole: ${error.message}`);
    await runAfterWrite({
      entityType: "app_users",
      entityId: id,
      before,
      after: { role },
      action: "update",
      ctx
    });
  },

  async setActive(id, isActive) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb
      .from("app_users")
      .select("is_active,disabled_at")
      .eq("id", id)
      .maybeSingle();
    const patch = isActive
      ? { is_active: true, disabled_at: null }
      : { is_active: false, disabled_at: new Date().toISOString() };
    const { error } = await sb.from("app_users").update(patch).eq("id", id);
    if (error) throw new Error(`app_users.setActive: ${error.message}`);
    await runAfterWrite({
      entityType: "app_users",
      entityId: id,
      before,
      after: patch,
      action: "update",
      ctx
    });
  }
};
