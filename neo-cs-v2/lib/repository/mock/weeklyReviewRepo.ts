import { weeklyReviews, getWeekRange } from "@/lib/mock/weekly";
import { DEFAULT_ORG_ID } from "../types";
import type {
  WeeklyReview,
  WeeklyReviewFilter,
  WeeklyReviewRepo,
  WeeklyReviewUpsert
} from "../types";
import { getOrInitGlobalStore } from "./_global-store";
import { mockMutate } from "./_mockMutate";

const store = getOrInitGlobalStore<WeeklyReview[]>("__weeklyReviewStore", () =>
  weeklyReviews.map((r) => ({
    ...r,
    organizationId: DEFAULT_ORG_ID,
    actions: r.actions.map((a) => ({ ...a })),
    nextActions: r.nextActions.map((n) => ({ ...n }))
  }))
);

function genId(companyId: string, product: string, weekStart: string): string {
  return `w-${companyId}-${product}-${weekStart}`;
}

function applyFilter(list: WeeklyReview[], f?: WeeklyReviewFilter): WeeklyReview[] {
  if (!f) return list;
  return list.filter((r) => {
    if (f.organizationId && r.organizationId !== f.organizationId) return false;
    if (f.companyId && r.companyId !== f.companyId) return false;
    if (f.product && r.product !== f.product) return false;
    if (f.weekStart && r.weekStart !== f.weekStart) return false;
    if (f.weekStartFrom && r.weekStart < f.weekStartFrom) return false;
    if (f.weekStartTo && r.weekStart > f.weekStartTo) return false;
    return true;
  });
}

function clone(r: WeeklyReview): WeeklyReview {
  return {
    ...r,
    actions: r.actions.map((a) => ({ ...a })),
    nextActions: r.nextActions.map((n) => ({ ...n }))
  };
}

export const mockWeeklyReviewRepo: WeeklyReviewRepo = {
  async list(filter) {
    return applyFilter(store, filter).map(clone);
  },
  async getById(id) {
    const r = store.find((x) => x.id === id);
    return r ? clone(r) : null;
  },
  async getByKey(companyId, product, weekStart) {
    const r = store.find(
      (x) => x.companyId === companyId && x.product === product && x.weekStart === weekStart
    );
    return r ? clone(r) : null;
  },
  async upsert(input: WeeklyReviewUpsert) {
    const range = getWeekRange(input.weekStart);
    const idx = store.findIndex(
      (r) =>
        r.companyId === input.companyId &&
        r.product === input.product &&
        r.weekStart === input.weekStart
    );
    const now = new Date().toISOString();
    const id = input.id ?? genId(input.companyId, input.product, input.weekStart);

    const merged: WeeklyReview = {
      id,
      organizationId: input.organizationId ?? DEFAULT_ORG_ID,
      companyId: input.companyId,
      product: input.product,
      weekStart: range.start,
      weekEnd: range.end,
      weekLabel: range.label,
      actions: input.actions.map((a) => ({ ...a })),
      good: input.good,
      more: input.more,
      nextActions: input.nextActions.map((n) => ({ ...n })),
      authorName: input.authorName,
      locked: input.locked,
      updatedAt: now
    };

    let before: WeeklyReview | undefined;
    if (idx >= 0) {
      before = clone(store[idx]);
      store[idx] = merged;
    } else {
      store.push(merged);
    }

    await mockMutate({
      entityType: "weekly_reviews",
      entityId: id,
      action: idx >= 0 ? "update" : "create",
      before,
      after: merged,
      organizationId: merged.organizationId
    });

    return clone(merged);
  },
  async setLocked(id, locked) {
    const idx = store.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const before = clone(store[idx]);
    store[idx] = { ...store[idx], locked };
    await mockMutate({
      entityType: "weekly_reviews",
      entityId: id,
      action: "update",
      before,
      after: store[idx],
      organizationId: store[idx].organizationId
    });
  }
};
