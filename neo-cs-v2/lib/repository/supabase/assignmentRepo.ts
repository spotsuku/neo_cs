import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import { DEFAULT_ORG_ID } from "../types";
import type {
  Assignment,
  AssignmentFilter,
  AssignmentRepo,
  AssignmentRole
} from "../types";

type Row = {
  id: string;
  organization_id: string;
  company_id: string;
  user_id: string;
  role: AssignmentRole;
  assigned_at: string;
  assigned_by: string | null;
  unassigned_at: string | null;
  note: string | null;
};

function toAssignment(r: Row): Assignment {
  return {
    id: r.id,
    organizationId: r.organization_id,
    companyId: r.company_id,
    userId: r.user_id,
    role: r.role,
    assignedAt: r.assigned_at,
    assignedBy: r.assigned_by ?? undefined,
    unassignedAt: r.unassigned_at ?? undefined,
    note: r.note ?? undefined
  };
}

export const supabaseAssignmentRepo: AssignmentRepo = {
  async list(filter?: AssignmentFilter) {
    const sb = getServiceClient();
    let q = sb.from("assignments").select("*");
    if (filter?.organizationId) q = q.eq("organization_id", filter.organizationId);
    if (filter?.companyId) q = q.eq("company_id", filter.companyId);
    if (filter?.userId) q = q.eq("user_id", filter.userId);
    if (filter?.role) q = q.eq("role", filter.role);
    if (filter?.activeOnly) q = q.is("unassigned_at", null);
    const { data, error } = await q;
    if (error) throw new Error(`assignments.list: ${error.message}`);
    return (data ?? []).map((r: Row) => toAssignment(r));
  },

  async listByCompany(companyId, opts) {
    return this.list({ companyId, activeOnly: opts?.activeOnly });
  },

  async listByUser(userId, opts) {
    return this.list({ userId, activeOnly: opts?.activeOnly });
  },

  async assign(input) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const row = {
      organization_id: input.organizationId ?? DEFAULT_ORG_ID,
      company_id: input.companyId,
      user_id: input.userId,
      role: input.role,
      assigned_at: input.assignedAt ?? new Date().toISOString(),
      assigned_by: input.assignedBy ?? null,
      note: input.note ?? null
    };
    const { data, error } = await sb.from("assignments").insert(row).select().single();
    if (error) throw new Error(`assignments.assign: ${error.message}`);
    const created = toAssignment(data as Row);
    await runAfterWrite({
      entityType: "assignments",
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
    const { data: before, error: beforeErr } = await sb
      .from("assignments")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (beforeErr) throw new Error(`assignments.update.before: ${beforeErr.message}`);
    if (!before) throw new Error(`Assignment not found: ${id}`);

    // primary / sales_owner 昇格時は同 company の同役割を自動 unassign
    // (partial unique index を踏まないため先に unassign)
    if (
      (patch.role === "primary" || patch.role === "sales_owner") &&
      patch.role !== (before as Row).role
    ) {
      const now = new Date().toISOString();
      const { error: uErr } = await sb
        .from("assignments")
        .update({ unassigned_at: now })
        .eq("company_id", (before as Row).company_id)
        .eq("role", patch.role)
        .is("unassigned_at", null)
        .neq("id", id);
      if (uErr) throw new Error(`assignments.update.demote: ${uErr.message}`);
    }

    const patchRow: Record<string, unknown> = {};
    if (patch.role !== undefined) patchRow.role = patch.role;
    if (patch.note !== undefined) patchRow.note = patch.note;

    const { data, error } = await sb
      .from("assignments")
      .update(patchRow)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(`assignments.update: ${error.message}`);
    const updated = toAssignment(data as Row);
    await runAfterWrite({
      entityType: "assignments",
      entityId: id,
      before,
      after: updated,
      action: "update",
      ctx
    });
    return updated;
  },

  async unassign(id, opts) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb
      .from("assignments")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const { error } = await sb
      .from("assignments")
      .update({ unassigned_at: opts?.unassignedAt ?? new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(`assignments.unassign: ${error.message}`);
    await runAfterWrite({
      entityType: "assignments",
      entityId: id,
      before,
      action: "update",
      ctx
    });
  }
};
