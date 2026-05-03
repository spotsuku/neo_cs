import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import type {
  VocComment,
  VocItemCreateInput,
  VocItemFilter,
  VocItemRecord,
  VocItemRepo,
  VocPriority,
  VocSourceType,
  VocStatus
} from "../types";

type ItemRow = {
  id: string;
  organization_id: string;
  source_type: VocSourceType;
  source_id: string;
  contract_id: string | null;
  company_id: string | null;
  excerpt: string;
  tags: string[];
  status: VocStatus;
  priority: VocPriority;
  linked_pr_url: string | null;
  assigned_to: string | null;
  created_by: string | null;
  triaged_by: string | null;
  triaged_at: string | null;
  shipped_at: string | null;
  customer_notified_at: string | null;
  notified_at: string | null;
  created_at: string;
  updated_at: string;
};

type CommentRow = {
  id: string;
  voc_item_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

function toComment(r: CommentRow): VocComment {
  return {
    id: r.id,
    authorUserId: r.author_id,
    body: r.body,
    createdAt: r.created_at
  };
}

function toItem(r: ItemRow, comments: VocComment[]): VocItemRecord {
  return {
    id: r.id,
    organizationId: r.organization_id,
    sourceType: r.source_type,
    sourceId: r.source_id,
    contractId: r.contract_id ?? undefined,
    companyId: r.company_id ?? undefined,
    excerpt: r.excerpt,
    tags: r.tags ?? [],
    status: r.status,
    priority: r.priority,
    linkedPrUrl: r.linked_pr_url ?? undefined,
    assignedTo: r.assigned_to ?? undefined,
    createdBy: r.created_by ?? undefined,
    triagedBy: r.triaged_by ?? undefined,
    triagedAt: r.triaged_at ?? undefined,
    shippedAt: r.shipped_at ?? undefined,
    customerNotifiedAt: r.customer_notified_at ?? undefined,
    notifiedAt: r.notified_at ?? undefined,
    comments,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

async function fetchComments(itemIds: string[]): Promise<Map<string, VocComment[]>> {
  if (itemIds.length === 0) return new Map();
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("voc_comments")
    .select("*")
    .in("voc_item_id", itemIds)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`voc_comments.list: ${error.message}`);
  const map = new Map<string, VocComment[]>();
  for (const r of (data ?? []) as CommentRow[]) {
    const arr = map.get(r.voc_item_id) ?? [];
    arr.push(toComment(r));
    map.set(r.voc_item_id, arr);
  }
  return map;
}

const PRIORITY_ORDER = "case priority when 'high' then 3 when 'med' then 2 else 1 end";

async function fetchById(id: string): Promise<VocItemRecord | null> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("voc_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`voc_items.fetch: ${error.message}`);
  if (!data) return null;
  const map = await fetchComments([id]);
  return toItem(data as ItemRow, map.get(id) ?? []);
}

function genId(): string {
  return `voc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function genCommentId(): string {
  return `vc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export const supabaseVocItemRepo: VocItemRepo = {
  async list(filter?: VocItemFilter) {
    const sb = getServiceClient();
    let q = sb.from("voc_items").select("*");
    if (filter?.organizationId) q = q.eq("organization_id", filter.organizationId);
    if (filter?.priority) q = q.eq("priority", filter.priority);
    if (filter?.contractId) q = q.eq("contract_id", filter.contractId);
    if (filter?.companyId) q = q.eq("company_id", filter.companyId);
    if (filter?.unNotifiedOnly) q = q.is("notified_at", null);
    if (filter?.status) {
      q = Array.isArray(filter.status)
        ? q.in("status", filter.status)
        : q.eq("status", filter.status);
    }
    if (filter?.tag) q = q.contains("tags", [filter.tag]);

    // priority desc → created_at desc は SQL 側で並び替えたいが、
    // PostgREST は CASE 式のソートを直接受け付けない。アプリ側でソート。
    const { data, error } = await q;
    if (error) throw new Error(`voc_items.list: ${error.message}`);
    const rows = (data ?? []) as ItemRow[];
    const commentsMap = await fetchComments(rows.map((r) => r.id));
    const items = rows.map((r) => toItem(r, commentsMap.get(r.id) ?? []));

    const rank: Record<VocPriority, number> = { high: 3, med: 2, low: 1 };
    items.sort((a, b) => {
      const r = rank[b.priority] - rank[a.priority];
      if (r !== 0) return r;
      return b.createdAt.localeCompare(a.createdAt);
    });
    return items;
    void PRIORITY_ORDER;
  },

  async getById(id) {
    return fetchById(id);
  },

  async create(input: VocItemCreateInput) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const id = input.id ?? genId();
    const now = new Date().toISOString();

    const row = {
      id,
      organization_id: input.organizationId,
      source_type: input.sourceType,
      source_id: input.sourceId,
      contract_id: input.contractId ?? null,
      company_id: input.companyId ?? null,
      excerpt: input.excerpt,
      tags: input.tags,
      status: input.status,
      priority: input.priority,
      created_by: input.createdBy ?? null,
      created_at: now,
      updated_at: now
    };

    const { data, error } = await sb.from("voc_items").insert(row).select().single();
    if (error) throw new Error(`voc_items.create: ${error.message}`);
    const created = toItem(data as ItemRow, []);
    await runAfterWrite({
      entityType: "voc_items",
      entityId: id,
      after: created,
      action: "create",
      ctx
    });
    return created;
  },

  async setStatus(id, opts) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const before = await fetchById(id);
    if (!before) throw new Error(`VocItem not found: ${id}`);

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status: opts.status };
    if (opts.status === "triaged" || opts.status === "backlog") {
      if (!before.triagedBy && opts.actorUserId) patch.triaged_by = opts.actorUserId;
      if (!before.triagedAt) patch.triaged_at = now;
    }
    if (opts.status === "shipped") {
      patch.shipped_at = opts.shippedAt ?? now;
      if (opts.customerNotifiedAt) patch.customer_notified_at = opts.customerNotifiedAt;
    }

    const { error } = await sb.from("voc_items").update(patch).eq("id", id);
    if (error) throw new Error(`voc_items.setStatus: ${error.message}`);
    const after = await fetchById(id);
    await runAfterWrite({
      entityType: "voc_items",
      entityId: id,
      before,
      after,
      action: "update",
      ctx
    });
    return after!;
  },

  async setPriority(id, priority) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const before = await fetchById(id);
    if (!before) throw new Error(`VocItem not found: ${id}`);
    const { error } = await sb.from("voc_items").update({ priority }).eq("id", id);
    if (error) throw new Error(`voc_items.setPriority: ${error.message}`);
    const after = await fetchById(id);
    await runAfterWrite({
      entityType: "voc_items",
      entityId: id,
      before,
      after,
      action: "update",
      ctx
    });
    return after!;
  },

  async setLinkedPrUrl(id, url) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const before = await fetchById(id);
    if (!before) throw new Error(`VocItem not found: ${id}`);
    const { error } = await sb
      .from("voc_items")
      .update({ linked_pr_url: url ?? null })
      .eq("id", id);
    if (error) throw new Error(`voc_items.setLinkedPrUrl: ${error.message}`);
    const after = await fetchById(id);
    await runAfterWrite({
      entityType: "voc_items",
      entityId: id,
      before,
      after,
      action: "update",
      ctx
    });
    return after!;
  },

  async setAssignedTo(id, userId) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const before = await fetchById(id);
    if (!before) throw new Error(`VocItem not found: ${id}`);
    const { error } = await sb
      .from("voc_items")
      .update({ assigned_to: userId ?? null })
      .eq("id", id);
    if (error) throw new Error(`voc_items.setAssignedTo: ${error.message}`);
    const after = await fetchById(id);
    await runAfterWrite({
      entityType: "voc_items",
      entityId: id,
      before,
      after,
      action: "update",
      ctx
    });
    return after!;
  },

  async appendComment(id, comment) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const before = await fetchById(id);
    if (!before) throw new Error(`VocItem not found: ${id}`);

    const cId = genCommentId();
    const now = new Date().toISOString();
    const { error: cErr } = await sb.from("voc_comments").insert({
      id: cId,
      voc_item_id: id,
      author_id: comment.authorUserId,
      body: comment.body,
      created_at: now
    });
    if (cErr) throw new Error(`voc_comments.insert: ${cErr.message}`);

    // 親 voc_items の updated_at を bump (set_updated_at トリガに任せる)
    const { error: uErr } = await sb
      .from("voc_items")
      .update({ updated_at: now })
      .eq("id", id);
    if (uErr) throw new Error(`voc_items.touch: ${uErr.message}`);

    const after = await fetchById(id);
    await runAfterWrite({
      entityType: "voc_items",
      entityId: id,
      before,
      after,
      action: "update",
      ctx
    });
    return after!;
  },

  async markNotified(id, notifiedAt) {
    const sb = getServiceClient();
    const { error } = await sb
      .from("voc_items")
      .update({ notified_at: notifiedAt ?? new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(`voc_items.markNotified: ${error.message}`);
    // 高頻度低監査価値のため runAfterWrite はスキップ
  }
};
