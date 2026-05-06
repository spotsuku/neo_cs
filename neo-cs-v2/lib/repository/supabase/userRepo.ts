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
    // 開発時の env 強制経路 (CI / local dev) は MOCK_CURRENT_USER_EMAIL を優先。
    const mockEmail = process.env.MOCK_CURRENT_USER_EMAIL;
    const sbService = getServiceClient();
    if (mockEmail) {
      const { data, error } = await sbService
        .from("app_users")
        .select("*")
        .eq("email", mockEmail.toLowerCase())
        .maybeSingle();
      if (error) throw new Error(`app_users.getCurrent (mock): ${error.message}`);
      return data ? toUser(data as Row) : null;
    }

    // 本番: Supabase Auth セッションから auth.uid() を取得し、
    // app_users.auth_user_id で突き合わせる。
    let authUser: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null = null;
    try {
      const { cookies } = await import("next/headers");
      const { createServerClient } = await import("@supabase/ssr");
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !anon) return null;
      const cookieStore = await cookies();
      const sbAuth = createServerClient(url, anon, {
        cookies: {
          getAll() {
            return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
          },
          setAll() {
            /* Server Component からは cookie 書込みできないが認可だけなので OK */
          }
        }
      });
      const { data } = await sbAuth.auth.getUser();
      if (data?.user) {
        authUser = {
          id: data.user.id,
          email: data.user.email ?? undefined,
          user_metadata: data.user.user_metadata ?? undefined
        };
      }
    } catch {
      return null;
    }
    if (!authUser) return null;

    // 1) auth_user_id で直接ヒットする app_users
    {
      const { data, error } = await sbService
        .from("app_users")
        .select("*")
        .eq("auth_user_id", authUser.id)
        .maybeSingle();
      if (!error && data) return toUser(data as Row);
    }

    // 2) email マッチで auth_user_id を後付けリンク (seed 由来の app_user 等)
    if (authUser.email) {
      const { data: byEmail } = await sbService
        .from("app_users")
        .select("*")
        .eq("email", authUser.email.toLowerCase())
        .maybeSingle();
      if (byEmail) {
        await sbService
          .from("app_users")
          .update({ auth_user_id: authUser.id, is_active: true })
          .eq("id", (byEmail as Row).id);
        return toUser({ ...(byEmail as Row), auth_user_id: authUser.id, is_active: true });
      }
    }

    // 3) INITIAL_ADMIN_EMAIL と一致する初回ログインユーザは admin で自動登録
    const initialAdmin = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase();
    if (authUser.email && initialAdmin && authUser.email.toLowerCase() === initialAdmin) {
      const name =
        (typeof authUser.user_metadata?.name === "string"
          ? (authUser.user_metadata?.name as string)
          : null) ?? authUser.email;
      const orgRow = await sbService.from("organizations").select("id").limit(1).maybeSingle();
      const organizationId =
        (orgRow.data as { id: string } | null)?.id ?? "00000000-0000-0000-0000-000000000001";
      const { data: created } = await sbService
        .from("app_users")
        .insert({
          auth_user_id: authUser.id,
          email: authUser.email,
          name,
          role: "admin",
          is_active: true,
          organization_id: organizationId
        })
        .select()
        .single();
      if (created) return toUser(created as Row);
    }

    // 一致しない場合は app_user 未登録 — 管理者による招待待ち
    return null;
  },

  async create(input) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const email = input.email.trim().toLowerCase();
    const orgId =
      input.organizationId ?? ctx.actor.organizationId ?? "00000000-0000-0000-0000-000000000001";

    const { data: existing } = await sb
      .from("app_users")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existing) {
      throw new Error(`既に登録済みのメールアドレスです: ${input.email}`);
    }

    const { data, error } = await sb
      .from("app_users")
      .insert({
        organization_id: orgId,
        email,
        name: input.name,
        role: input.role,
        is_active: true,
        auth_user_id: null
      })
      .select("*")
      .single();
    if (error || !data) {
      throw new Error(`app_users.create: ${error?.message ?? "unknown"}`);
    }
    const created = toUser(data as Row);
    await runAfterWrite({
      entityType: "app_users",
      entityId: created.id,
      before: null,
      after: { email: created.email, name: created.name, role: created.role },
      action: "create",
      ctx
    });
    return created;
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
