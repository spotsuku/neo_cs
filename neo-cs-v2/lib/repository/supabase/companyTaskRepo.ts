import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import { DEFAULT_ORG_ID } from "../types";
import type {
  CompanyTask,
  CompanyTaskCreateInput,
  CompanyTaskFilter,
  CompanyTaskRepo,
  CompanyTaskUpdatePatch
} from "../types";

type Row = {
  id: string;
  organization_id: string;
  company_id: string;
  contract_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  notify_at: string | null;
  assigned_to: string | null;
  created_by: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
};

function toTask(r: Row): CompanyTask {
  return {
    id: r.id,
    organizationId: r.organization_id,
    companyId: r.company_id,
    contractId: r.contract_id ?? undefined,
    title: r.title,
    description: r.description ?? undefined,
    category: (r.category ?? undefined) as CompanyTask["category"],
    status: r.status as CompanyTask["status"],
    priority: r.priority as CompanyTask["priority"],
    dueDate: r.due_date ?? undefined,
    notifyAt: r.notify_at ?? undefined,
    assignedTo: r.assigned_to ?? undefined,
    createdBy: r.created_by ?? undefined,
    completedAt: r.completed_at ?? undefined,
    completedBy: r.completed_by ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

function toRow(input: Partial<CompanyTask>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.organizationId !== undefined) out.organization_id = input.organizationId;
  if (input.companyId !== undefined) out.company_id = input.companyId;
  if (input.contractId !== undefined) out.contract_id = input.contractId ?? null;
  if (input.title !== undefined) out.title = input.title;
  if (input.description !== undefined) out.description = input.description ?? null;
  if (input.category !== undefined) out.category = input.category ?? null;
  if (input.status !== undefined) out.status = input.status;
  if (input.priority !== undefined) out.priority = input.priority;
  if (input.dueDate !== undefined) out.due_date = input.dueDate ?? null;
  if (input.notifyAt !== undefined) out.notify_at = input.notifyAt ?? null;
  if (input.assignedTo !== undefined) out.assigned_to = input.assignedTo ?? null;
  if (input.createdBy !== undefined) out.created_by = input.createdBy ?? null;
  if (input.completedAt !== undefined) out.completed_at = input.completedAt ?? null;
  if (input.completedBy !== undefined) out.completed_by = input.completedBy ?? null;
  return out;
}

export const supabaseCompanyTaskRepo: CompanyTaskRepo = {
  async list(filter?: CompanyTaskFilter) {
    const sb = getServiceClient();
    let q = sb
      .from("company_tasks")
      .select("*")
      .order("due_date", { ascending: true, nullsFirst: false });
    if (filter?.organizationId) q = q.eq("organization_id", filter.organizationId);
    if (filter?.companyId) q = q.eq("company_id", filter.companyId);
    if (filter?.contractId) q = q.eq("contract_id", filter.contractId);
    if (filter?.assignedTo) q = q.eq("assigned_to", filter.assignedTo);
    if (filter?.priority) q = q.eq("priority", filter.priority);
    if (filter?.status) {
      const arr = Array.isArray(filter.status) ? filter.status : [filter.status];
      q = q.in("status", arr);
    }
    if (filter?.openOnly) q = q.in("status", ["pending", "in_progress"]);
    if (filter?.overdueOnly) {
      const today = new Date().toISOString().slice(0, 10);
      q = q.lt("due_date", today).in("status", ["pending", "in_progress"]);
    }
    if (filter?.dueOnOrBefore) {
      q = q.lte("due_date", filter.dueOnOrBefore).in("status", ["pending", "in_progress"]);
    }
    const { data, error } = await q;
    if (error) throw new Error(`company_tasks.list: ${error.message}`);
    return (data ?? []).map((r: Row) => toTask(r));
  },

  async getById(id) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("company_tasks")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`company_tasks.getById: ${error.message}`);
    return data ? toTask(data as Row) : null;
  },

  async create(input) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const row = toRow({
      ...input,
      organizationId: input.organizationId ?? DEFAULT_ORG_ID,
      status: input.status ?? "pending"
    });
    const { data, error } = await sb.from("company_tasks").insert(row).select().single();
    if (error) throw new Error(`company_tasks.create: ${error.message}`);
    const created = toTask(data as Row);
    await runAfterWrite({
      entityType: "company_tasks",
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
      .from("company_tasks")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const { data, error } = await sb
      .from("company_tasks")
      .update(toRow(patch))
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(`company_tasks.update: ${error.message}`);
    const updated = toTask(data as Row);
    await runAfterWrite({
      entityType: "company_tasks",
      entityId: id,
      before,
      after: updated,
      action: "update",
      ctx
    });
    return updated;
  },

  async markDone(id, opts) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const now = opts.completedAt ?? new Date().toISOString();
    const { data: before } = await sb
      .from("company_tasks")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const { data, error } = await sb
      .from("company_tasks")
      .update({
        status: "done",
        completed_at: now,
        completed_by: opts.completedBy ?? null
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(`company_tasks.markDone: ${error.message}`);
    const updated = toTask(data as Row);
    await runAfterWrite({
      entityType: "company_tasks",
      entityId: id,
      before,
      after: updated,
      action: "update",
      ctx
    });
    return updated;
  },

  async markSkipped(id) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb
      .from("company_tasks")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const { data, error } = await sb
      .from("company_tasks")
      .update({ status: "skipped" })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(`company_tasks.markSkipped: ${error.message}`);
    const updated = toTask(data as Row);
    await runAfterWrite({
      entityType: "company_tasks",
      entityId: id,
      before,
      after: updated,
      action: "update",
      ctx
    });
    return updated;
  },

  async markCancelled(id) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb
      .from("company_tasks")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const { data, error } = await sb
      .from("company_tasks")
      .update({ status: "cancelled" })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(`company_tasks.markCancelled: ${error.message}`);
    const updated = toTask(data as Row);
    await runAfterWrite({
      entityType: "company_tasks",
      entityId: id,
      before,
      after: updated,
      action: "update",
      ctx
    });
    return updated;
  }
};
