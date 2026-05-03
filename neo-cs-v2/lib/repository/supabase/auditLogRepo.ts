import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import type { AuditLog, AuditLogFilter, AuditLogRepo } from "../types";

type Row = {
  id: number;
  organization_id: string | null;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  target_table: string;
  target_id: string | null;
  before_data: unknown;
  after_data: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

function toAuditLog(r: Row): AuditLog {
  return {
    id: String(r.id),
    organizationId: r.organization_id ?? undefined,
    actorUserId: r.actor_user_id ?? undefined,
    actorEmail: r.actor_email ?? undefined,
    actorRole: r.actor_role ?? undefined,
    action: r.action as AuditLog["action"],
    targetTable: r.target_table,
    targetId: r.target_id ?? undefined,
    beforeData: r.before_data,
    afterData: r.after_data,
    ipAddress: r.ip_address ?? undefined,
    userAgent: r.user_agent ?? undefined,
    createdAt: r.created_at
  };
}

export const supabaseAuditLogRepo: AuditLogRepo = {
  async list(filter?: AuditLogFilter) {
    const sb = getServiceClient();
    let q = sb.from("audit_logs").select("*").order("created_at", { ascending: false });
    if (filter?.organizationId) q = q.eq("organization_id", filter.organizationId);
    if (filter?.actorUserId) q = q.eq("actor_user_id", filter.actorUserId);
    if (filter?.targetTable) q = q.eq("target_table", filter.targetTable);
    if (filter?.targetId) q = q.eq("target_id", filter.targetId);
    if (filter?.action) q = q.eq("action", filter.action);
    if (filter?.fromCreatedAt) q = q.gte("created_at", filter.fromCreatedAt);
    if (filter?.toCreatedAt) q = q.lte("created_at", filter.toCreatedAt);
    if (filter?.limit) q = q.limit(filter.limit);
    const { data, error } = await q;
    if (error) throw new Error(`audit_logs.list: ${error.message}`);
    return (data ?? []).map((r: Row) => toAuditLog(r));
  },

  /**
   * 直接呼ばずに _base.ts の MutationHook 経由を推奨。
   * lib/repository/audit.ts の auditHook が既に同等のINSERTを行うため、
   * 通常のwriteフローでは本メソッドを使う必要はない。
   */
  async append(input) {
    const sb = getServiceClient();
    const { error } = await sb.from("audit_logs").insert({
      organization_id: input.organizationId ?? null,
      actor_user_id: input.actorUserId ?? null,
      actor_email: input.actorEmail ?? null,
      actor_role: input.actorRole ?? null,
      action: input.action,
      target_table: input.targetTable,
      target_id: input.targetId ?? null,
      before_data: input.beforeData ?? null,
      after_data: input.afterData ?? null,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null
    });
    if (error) throw new Error(`audit_logs.append: ${error.message}`);
  }
};
