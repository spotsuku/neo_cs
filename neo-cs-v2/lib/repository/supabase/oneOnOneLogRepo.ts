import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import { DEFAULT_ORG_ID } from "../types";
import type { OneOnOneLog, OneOnOneFilter, OneOnOneLogRepo } from "../types";

type Row = {
  id: string;
  organization_id: string;
  manager_user_id: string;
  member_user_id: string;
  occurred_at: string;
  duration_min: number | null;
  topic: string | null;
  summary: string | null;
  good: string | null;
  more: string | null;
  next_action: string | null;
  is_private: boolean;
  author_user_id: string | null;
  created_at: string;
  updated_at: string;
};

function toLog(r: Row): OneOnOneLog {
  return {
    id: r.id,
    organizationId: r.organization_id,
    managerUserId: r.manager_user_id,
    memberUserId: r.member_user_id,
    occurredAt: r.occurred_at,
    durationMin: r.duration_min ?? undefined,
    topic: r.topic ?? undefined,
    summary: r.summary ?? undefined,
    good: r.good ?? undefined,
    more: r.more ?? undefined,
    nextAction: r.next_action ?? undefined,
    isPrivate: r.is_private,
    authorUserId: r.author_user_id ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

function toRow(input: Partial<OneOnOneLog>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.organizationId !== undefined) out.organization_id = input.organizationId;
  if (input.managerUserId !== undefined) out.manager_user_id = input.managerUserId;
  if (input.memberUserId !== undefined) out.member_user_id = input.memberUserId;
  if (input.occurredAt !== undefined) out.occurred_at = input.occurredAt;
  if (input.durationMin !== undefined) out.duration_min = input.durationMin ?? null;
  if (input.topic !== undefined) out.topic = input.topic ?? null;
  if (input.summary !== undefined) out.summary = input.summary ?? null;
  if (input.good !== undefined) out.good = input.good ?? null;
  if (input.more !== undefined) out.more = input.more ?? null;
  if (input.nextAction !== undefined) out.next_action = input.nextAction ?? null;
  if (input.isPrivate !== undefined) out.is_private = input.isPrivate;
  if (input.authorUserId !== undefined) out.author_user_id = input.authorUserId ?? null;
  return out;
}

export const supabaseOneOnOneLogRepo: OneOnOneLogRepo = {
  async list(filter?: OneOnOneFilter) {
    const sb = getServiceClient();
    let q = sb.from("one_on_one_logs").select("*").order("occurred_at", { ascending: false });
    if (filter?.organizationId) q = q.eq("organization_id", filter.organizationId);
    if (filter?.managerUserId) q = q.eq("manager_user_id", filter.managerUserId);
    if (filter?.memberUserId) q = q.eq("member_user_id", filter.memberUserId);
    if (filter?.fromOccurredAt) q = q.gte("occurred_at", filter.fromOccurredAt);
    if (filter?.toOccurredAt) q = q.lte("occurred_at", filter.toOccurredAt);
    const { data, error } = await q;
    if (error) throw new Error(`one_on_one_logs.list: ${error.message}`);
    return (data ?? []).map((r: Row) => toLog(r));
  },

  async getById(id) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("one_on_one_logs")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`one_on_one_logs.getById: ${error.message}`);
    return data ? toLog(data as Row) : null;
  },

  async create(input) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const row = toRow({ ...input, organizationId: input.organizationId ?? DEFAULT_ORG_ID });
    const { data, error } = await sb.from("one_on_one_logs").insert(row).select().single();
    if (error) throw new Error(`one_on_one_logs.create: ${error.message}`);
    const created = toLog(data as Row);
    await runAfterWrite({
      entityType: "one_on_one_logs",
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
      .from("one_on_one_logs")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const { data, error } = await sb
      .from("one_on_one_logs")
      .update(toRow(patch))
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(`one_on_one_logs.update: ${error.message}`);
    const updated = toLog(data as Row);
    await runAfterWrite({
      entityType: "one_on_one_logs",
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
    const { data: before } = await sb
      .from("one_on_one_logs")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const { error } = await sb.from("one_on_one_logs").delete().eq("id", id);
    if (error) throw new Error(`one_on_one_logs.delete: ${error.message}`);
    await runAfterWrite({
      entityType: "one_on_one_logs",
      entityId: id,
      before,
      action: "delete",
      ctx
    });
  }
};
