import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import { getWeekRange } from "@/lib/mock/weekly";
import { DEFAULT_ORG_ID } from "../types";
import type {
  ProductCode,
  WeeklyReview,
  WeeklyReviewFilter,
  WeeklyReviewRepo,
  WeeklyReviewUpsert,
  WeeklyAction,
  WeeklyNextAction
} from "../types";

type ReviewRow = {
  id: string;
  organization_id: string;
  company_id: string;
  product_code: ProductCode;
  week_start: string;
  week_end: string;
  week_label: string;
  good: string | null;
  more: string | null;
  author_user_id: string | null;
  locked: boolean;
  updated_at: string;
};

type ActionRow = {
  id: string;
  organization_id: string;
  weekly_review_id: string;
  text: string;
  done: boolean;
  from_prev_week: boolean;
  carried_from_week: string | null;
  assignee_user_id: string | null;
  completed_at: string | null;
  display_order: number;
};

type NextRow = {
  id: string;
  organization_id: string;
  weekly_review_id: string;
  text: string;
  assignee_user_id: string | null;
  due_date: string | null;
  display_order: number;
};

function toReview(
  r: ReviewRow,
  actions: ActionRow[],
  nexts: NextRow[],
  authorName = ""
): WeeklyReview {
  return {
    id: r.id,
    organizationId: r.organization_id,
    companyId: r.company_id,
    product: r.product_code,
    weekStart: r.week_start,
    weekEnd: r.week_end,
    weekLabel: r.week_label,
    good: r.good ?? "",
    more: r.more ?? "",
    locked: r.locked,
    authorName,
    updatedAt: r.updated_at,
    actions: actions
      .sort((a, b) => a.display_order - b.display_order)
      .map<WeeklyAction>((a) => ({
        id: a.id,
        text: a.text,
        done: a.done,
        fromPrevWeek: a.from_prev_week,
        carriedFromWeek: a.carried_from_week ?? undefined,
        assigneeName: a.assignee_user_id ?? undefined,
        completedAt: a.completed_at ?? undefined
      })),
    nextActions: nexts
      .sort((a, b) => a.display_order - b.display_order)
      .map<WeeklyNextAction>((n) => ({
        id: n.id,
        text: n.text,
        assigneeName: n.assignee_user_id ?? "",
        dueDate: n.due_date ?? undefined
      }))
  };
}

async function fetchChildren(reviewIds: string[]) {
  if (reviewIds.length === 0) return { actions: [], nexts: [] };
  const sb = getServiceClient();
  const [aRes, nRes] = await Promise.all([
    sb.from("weekly_actions").select("*").in("weekly_review_id", reviewIds),
    sb.from("weekly_next_actions").select("*").in("weekly_review_id", reviewIds)
  ]);
  if (aRes.error) throw new Error(`weekly_actions.list: ${aRes.error.message}`);
  if (nRes.error) throw new Error(`weekly_next_actions.list: ${nRes.error.message}`);
  return { actions: (aRes.data ?? []) as ActionRow[], nexts: (nRes.data ?? []) as NextRow[] };
}

export const supabaseWeeklyReviewRepo: WeeklyReviewRepo = {
  async list(filter?: WeeklyReviewFilter) {
    const sb = getServiceClient();
    let q = sb.from("weekly_reviews").select("*");
    if (filter?.organizationId) q = q.eq("organization_id", filter.organizationId);
    if (filter?.companyId) q = q.eq("company_id", filter.companyId);
    if (filter?.product) q = q.eq("product_code", filter.product);
    if (filter?.weekStart) q = q.eq("week_start", filter.weekStart);
    if (filter?.weekStartFrom) q = q.gte("week_start", filter.weekStartFrom);
    if (filter?.weekStartTo) q = q.lte("week_start", filter.weekStartTo);
    const { data, error } = await q;
    if (error) throw new Error(`weekly_reviews.list: ${error.message}`);
    const reviews = (data ?? []) as ReviewRow[];
    const { actions, nexts } = await fetchChildren(reviews.map((r) => r.id));
    return reviews.map((r) =>
      toReview(
        r,
        actions.filter((a) => a.weekly_review_id === r.id),
        nexts.filter((n) => n.weekly_review_id === r.id)
      )
    );
  },

  async getById(id) {
    const sb = getServiceClient();
    const { data, error } = await sb.from("weekly_reviews").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`weekly_reviews.getById: ${error.message}`);
    if (!data) return null;
    const { actions, nexts } = await fetchChildren([id]);
    return toReview(data as ReviewRow, actions, nexts);
  },

  async getByKey(companyId, product, weekStart) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("weekly_reviews")
      .select("*")
      .eq("company_id", companyId)
      .eq("product_code", product)
      .eq("week_start", weekStart)
      .maybeSingle();
    if (error) throw new Error(`weekly_reviews.getByKey: ${error.message}`);
    if (!data) return null;
    const { actions, nexts } = await fetchChildren([(data as ReviewRow).id]);
    return toReview(data as ReviewRow, actions, nexts);
  },

  async upsert(input: WeeklyReviewUpsert) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const range = getWeekRange(input.weekStart);
    const orgId = input.organizationId ?? DEFAULT_ORG_ID;
    const id = input.id ?? `w-${input.companyId}-${input.product}-${input.weekStart}`;

    // 既存レコードの取得 (audit before)
    const { data: before } = await sb
      .from("weekly_reviews")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    const reviewRow: ReviewRow = {
      id,
      organization_id: orgId,
      company_id: input.companyId,
      product_code: input.product,
      week_start: range.start,
      week_end: range.end,
      week_label: range.label,
      good: input.good,
      more: input.more,
      author_user_id: null, // authorName は app_users から逆引き、後段で対応
      locked: input.locked,
      updated_at: new Date().toISOString()
    };

    const { error: revErr } = await sb
      .from("weekly_reviews")
      .upsert(reviewRow, { onConflict: "id" });
    if (revErr) throw new Error(`weekly_reviews.upsert: ${revErr.message}`);

    // 子テーブルは差し替え (delete+insert)。トランザクションは Postgres
    // 関数化が望ましいが本実装では2クエリに留める
    await sb.from("weekly_actions").delete().eq("weekly_review_id", id);
    await sb.from("weekly_next_actions").delete().eq("weekly_review_id", id);

    if (input.actions.length > 0) {
      const aRows: Omit<ActionRow, "weekly_review_id">[] & { weekly_review_id: string }[] =
        input.actions.map((a, i) => ({
          id: a.id,
          organization_id: orgId,
          weekly_review_id: id,
          text: a.text,
          done: a.done,
          from_prev_week: a.fromPrevWeek ?? false,
          carried_from_week: a.carriedFromWeek ?? null,
          assignee_user_id: null,
          completed_at: a.completedAt ?? null,
          display_order: i
        }));
      const { error } = await sb.from("weekly_actions").insert(aRows);
      if (error) throw new Error(`weekly_actions.insert: ${error.message}`);
    }
    if (input.nextActions.length > 0) {
      const nRows = input.nextActions.map((n, i) => ({
        id: n.id,
        organization_id: orgId,
        weekly_review_id: id,
        text: n.text,
        assignee_user_id: null,
        due_date: n.dueDate ?? null,
        display_order: i
      }));
      const { error } = await sb.from("weekly_next_actions").insert(nRows);
      if (error) throw new Error(`weekly_next_actions.insert: ${error.message}`);
    }

    const { actions, nexts } = await fetchChildren([id]);
    const result = toReview(reviewRow, actions, nexts, input.authorName);

    await runAfterWrite({
      entityType: "weekly_reviews",
      entityId: id,
      before: before ?? undefined,
      after: result,
      action: before ? "update" : "create",
      ctx
    });

    return result;
  },

  async setLocked(id, locked) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { error } = await sb.from("weekly_reviews").update({ locked }).eq("id", id);
    if (error) throw new Error(`weekly_reviews.setLocked: ${error.message}`);
    await runAfterWrite({
      entityType: "weekly_reviews",
      entityId: id,
      after: { locked },
      action: "update",
      ctx
    });
  }
};
