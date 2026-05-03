import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import type {
  RenewalMilestone,
  RenewalMilestoneRepo
} from "../types";

type Row = {
  id: string;
  organization_id: string;
  contract_id: string;
  milestone_type: "T-120" | "T-90" | "T-60" | "T-30";
  due_date: string;
  status: "pending" | "in_progress" | "done" | "skipped";
  completed_by: string | null;
  completed_at: string | null;
  evidence: { note?: string; attachmentUrl?: string } | null;
  skipped_reason: string | null;
  note: string | null;
};

function toMilestone(r: Row): RenewalMilestone {
  return {
    id: r.id,
    contractId: r.contract_id,
    type: r.milestone_type,
    dueDate: r.due_date,
    status: r.status,
    completedBy: r.completed_by ?? undefined,
    completedAt: r.completed_at ?? undefined,
    evidence: r.evidence ?? undefined,
    skippedReason: r.skipped_reason ?? undefined,
    note: r.note ?? undefined
  };
}

async function fetchById(id: string): Promise<Row | null> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("renewal_milestones")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`renewal_milestones.fetch: ${error.message}`);
  return (data as Row | null) ?? null;
}

export const supabaseRenewalMilestoneRepo: RenewalMilestoneRepo = {
  async listByContract(contractId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("renewal_milestones")
      .select("*")
      .eq("contract_id", contractId)
      .order("due_date", { ascending: true });
    if (error) throw new Error(`renewal_milestones.listByContract: ${error.message}`);
    return (data ?? []).map((r: Row) => toMilestone(r));
  },

  async markDone(id, opts) {
    // 0009 の CHECK 制約: completed_by + evidence(note|attachmentUrl) 必須
    if (!opts.evidence?.note && !opts.evidence?.attachmentUrl) {
      throw new Error("evidence (note または attachmentUrl) が必要です");
    }
    const sb = getServiceClient();
    const ctx = getActorContext();
    const before = await fetchById(id);
    if (!before) throw new Error(`RenewalMilestone not found: ${id}`);

    const { data, error } = await sb
      .from("renewal_milestones")
      .update({
        status: "done",
        completed_by: opts.completedBy,
        completed_at: opts.completedAt ?? new Date().toISOString(),
        evidence: opts.evidence,
        // skipped から復帰する場合は skipped_reason をクリア
        skipped_reason: null
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(`renewal_milestones.markDone: ${error.message}`);

    const updated = toMilestone(data as Row);
    await runAfterWrite({
      entityType: "renewal_milestones",
      entityId: id,
      before,
      after: updated,
      action: "update",
      ctx
    });
    return updated;
  },

  async markSkipped(id, opts) {
    if (!opts.reason || !opts.reason.trim()) {
      throw new Error("skipped 時は reason が必須です");
    }
    const sb = getServiceClient();
    const ctx = getActorContext();
    const before = await fetchById(id);
    if (!before) throw new Error(`RenewalMilestone not found: ${id}`);

    const { data, error } = await sb
      .from("renewal_milestones")
      .update({
        status: "skipped",
        skipped_reason: opts.reason,
        completed_at: opts.skippedAt ?? new Date().toISOString(),
        // done フィールドはクリア
        completed_by: opts.skippedBy ?? null,
        evidence: null
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(`renewal_milestones.markSkipped: ${error.message}`);

    const updated = toMilestone(data as Row);
    await runAfterWrite({
      entityType: "renewal_milestones",
      entityId: id,
      before,
      after: updated,
      action: "update",
      ctx
    });
    return updated;
  },

  async markInProgress(id) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const before = await fetchById(id);
    if (!before) throw new Error(`RenewalMilestone not found: ${id}`);
    if (before.status !== "pending") {
      throw new Error(
        `markInProgress は pending からのみ可能 (current=${before.status})`
      );
    }

    const { data, error } = await sb
      .from("renewal_milestones")
      .update({ status: "in_progress" })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(`renewal_milestones.markInProgress: ${error.message}`);

    const updated = toMilestone(data as Row);
    await runAfterWrite({
      entityType: "renewal_milestones",
      entityId: id,
      before,
      after: updated,
      action: "update",
      ctx
    });
    return updated;
  }
};
