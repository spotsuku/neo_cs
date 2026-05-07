// ロール権限マトリクス Supabase リポジトリ
// マイグレーション: supabase/migrations/0035_role_permissions.sql

import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import type {
  AppUserRole,
  PermissionKey,
  RolePermission,
  RolePermissionRepo
} from "../types";

type Row = {
  permission_key: string;
  min_role: string;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
};

function rowToRecord(r: Row): RolePermission {
  return {
    permissionKey: r.permission_key as PermissionKey,
    minRole: r.min_role as AppUserRole,
    description: r.description,
    updatedBy: r.updated_by,
    updatedAt: r.updated_at
  };
}

export const supabaseRolePermissionRepo: RolePermissionRepo = {
  async list() {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("role_permissions")
      .select("permission_key, min_role, description, updated_by, updated_at")
      .order("permission_key");
    if (error) throw new Error(`role_permissions list failed: ${error.message}`);
    return ((data ?? []) as Row[]).map(rowToRecord);
  },

  async getByKey(key: PermissionKey) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("role_permissions")
      .select("permission_key, min_role, description, updated_by, updated_at")
      .eq("permission_key", key)
      .maybeSingle();
    if (error) throw new Error(`role_permissions getByKey failed: ${error.message}`);
    return data ? rowToRecord(data as Row) : null;
  },

  async upsert(input) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: prev } = await sb
      .from("role_permissions")
      .select("permission_key, min_role, description, updated_by, updated_at")
      .eq("permission_key", input.permissionKey)
      .maybeSingle();
    const { data, error } = await sb
      .from("role_permissions")
      .upsert(
        {
          permission_key: input.permissionKey,
          min_role: input.minRole,
          updated_by: input.updatedBy ?? ctx.actor.userId ?? null,
          updated_at: new Date().toISOString()
        },
        { onConflict: "permission_key" }
      )
      .select("permission_key, min_role, description, updated_by, updated_at")
      .single();
    if (error || !data) {
      throw new Error(`role_permissions upsert failed: ${error?.message ?? "no_row"}`);
    }
    const after = rowToRecord(data as Row);
    await runAfterWrite({
      entityType: "role_permissions",
      entityId: input.permissionKey,
      before: prev ? rowToRecord(prev as Row) : undefined,
      after,
      action: prev ? "update" : "create",
      ctx
    });
    return after;
  }
};
