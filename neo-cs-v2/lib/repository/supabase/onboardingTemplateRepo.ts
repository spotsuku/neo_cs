// オンボテンプレ Supabase 実装
// migration 0001 (テーブル) + 0036 (course_key + seed)

import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import type {
  OnboardingTemplateCategoryRecord,
  OnboardingTemplateItemRecord,
  OnboardingTemplateRepo
} from "../types";

type CatRow = {
  id: string;
  product_code: string;
  category_key: string;
  label: string;
  display_order: number;
};
type ItemRow = {
  id: string;
  category_id: string;
  item_key: string;
  name: string;
  due_offset_days: number;
  required: boolean;
  default_assignee_role: "cs" | "pr" | "ops" | "finance" | null;
  course_key: string | null;
  display_order: number;
};

const ITEM_COLS =
  "id, category_id, item_key, name, due_offset_days, required, default_assignee_role, course_key, display_order";

function toItem(r: ItemRow): OnboardingTemplateItemRecord {
  return {
    id: r.id,
    categoryId: r.category_id,
    itemKey: r.item_key,
    name: r.name,
    dueOffsetDays: r.due_offset_days,
    required: r.required,
    defaultAssigneeRole: r.default_assignee_role,
    courseKey: r.course_key,
    displayOrder: r.display_order ?? 0
  };
}

export const supabaseOnboardingTemplateRepo: OnboardingTemplateRepo = {
  async listByProduct(productCode) {
    const sb = getServiceClient();
    const [{ data: cats, error: catErr }, { data: items, error: itErr }] =
      await Promise.all([
        sb
          .from("onboarding_template_categories")
          .select("id, product_code, category_key, label, display_order")
          .eq("product_code", productCode)
          .order("display_order"),
        sb
          .from("onboarding_template_items")
          .select(
            `${ITEM_COLS}, onboarding_template_categories!inner(product_code)`
          )
          .eq("onboarding_template_categories.product_code", productCode)
          .order("display_order")
      ]);
    if (catErr)
      throw new Error(`onboarding_template_categories list: ${catErr.message}`);
    if (itErr) throw new Error(`onboarding_template_items list: ${itErr.message}`);
    const itemsByCat = new Map<string, OnboardingTemplateItemRecord[]>();
    for (const r of (items ?? []) as ItemRow[]) {
      const arr = itemsByCat.get(r.category_id) ?? [];
      arr.push(toItem(r));
      itemsByCat.set(r.category_id, arr);
    }
    return ((cats ?? []) as CatRow[]).map((c) => ({
      id: c.id,
      productCode: c.product_code,
      categoryKey: c.category_key,
      label: c.label,
      displayOrder: c.display_order,
      items: (itemsByCat.get(c.id) ?? []).sort(
        (a, b) => a.displayOrder - b.displayOrder
      )
    })) as OnboardingTemplateCategoryRecord[];
  },

  async upsertCategory(input) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: prev } = await sb
      .from("onboarding_template_categories")
      .select("id, product_code, category_key, label, display_order")
      .eq("product_code", input.productCode)
      .eq("category_key", input.categoryKey)
      .maybeSingle();
    const action = prev ? "update" : "create";
    const { data, error } = await sb
      .from("onboarding_template_categories")
      .upsert(
        {
          ...(input.id ? { id: input.id } : {}),
          product_code: input.productCode,
          category_key: input.categoryKey,
          label: input.label,
          display_order: input.displayOrder
        },
        { onConflict: "product_code,category_key" }
      )
      .select("id, product_code, category_key, label, display_order")
      .single();
    if (error || !data)
      throw new Error(
        `onboarding_template_categories upsert: ${error?.message ?? "no_row"}`
      );
    const result: OnboardingTemplateCategoryRecord = {
      id: (data as CatRow).id,
      productCode: (data as CatRow).product_code,
      categoryKey: (data as CatRow).category_key,
      label: (data as CatRow).label,
      displayOrder: (data as CatRow).display_order,
      items: []
    };
    await runAfterWrite({
      entityType: "onboarding_template_categories",
      entityId: result.id,
      before: prev,
      after: data,
      action,
      ctx
    });
    return result;
  },

  async deleteCategory(id) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: prev } = await sb
      .from("onboarding_template_categories")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const { error } = await sb
      .from("onboarding_template_categories")
      .delete()
      .eq("id", id);
    if (error)
      throw new Error(`onboarding_template_categories delete: ${error.message}`);
    await runAfterWrite({
      entityType: "onboarding_template_categories",
      entityId: id,
      before: prev,
      action: "delete",
      ctx
    });
  },

  async upsertItem(input) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: prev } = await sb
      .from("onboarding_template_items")
      .select(ITEM_COLS)
      .eq("category_id", input.categoryId)
      .eq("item_key", input.itemKey)
      .maybeSingle();
    const action = prev ? "update" : "create";
    // 新規追加時の display_order は同 category 内の末尾に置く
    let displayOrder = input.displayOrder;
    if (displayOrder === undefined) {
      if (prev) {
        displayOrder = (prev as ItemRow).display_order;
      } else {
        const { data: maxRow } = await sb
          .from("onboarding_template_items")
          .select("display_order")
          .eq("category_id", input.categoryId)
          .order("display_order", { ascending: false })
          .limit(1)
          .maybeSingle();
        displayOrder = ((maxRow as { display_order: number } | null)?.display_order ?? -10) + 10;
      }
    }
    const { data, error } = await sb
      .from("onboarding_template_items")
      .upsert(
        {
          ...(input.id ? { id: input.id } : {}),
          category_id: input.categoryId,
          item_key: input.itemKey,
          name: input.name,
          due_offset_days: input.dueOffsetDays,
          required: input.required,
          default_assignee_role: input.defaultAssigneeRole ?? null,
          course_key: input.courseKey ?? null,
          display_order: displayOrder
        },
        { onConflict: "category_id,item_key" }
      )
      .select(ITEM_COLS)
      .single();
    if (error || !data)
      throw new Error(
        `onboarding_template_items upsert: ${error?.message ?? "no_row"}`
      );
    const result = toItem(data as ItemRow);
    await runAfterWrite({
      entityType: "onboarding_template_items",
      entityId: result.id,
      before: prev,
      after: data,
      action,
      ctx
    });
    return result;
  },

  async reorderCategories(input) {
    if (input.orderedIds.length === 0) return;
    const sb = getServiceClient();
    // 既存行を取得して name/key を保持したまま display_order だけ書き換える
    const { data: rows, error: fErr } = await sb
      .from("onboarding_template_categories")
      .select("id, product_code, category_key, label, display_order")
      .in("id", input.orderedIds);
    if (fErr) throw new Error(`reorderCategories fetch: ${fErr.message}`);
    const byId = new Map((rows ?? []).map((r) => [(r as CatRow).id, r as CatRow]));
    const payload = input.orderedIds
      .map((id, i) => {
        const r = byId.get(id);
        if (!r) return null;
        return {
          id: r.id,
          product_code: r.product_code,
          category_key: r.category_key,
          label: r.label,
          display_order: (i + 1) * 10
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      product_code: string;
      category_key: string;
      label: string;
      display_order: number;
    }>;
    if (payload.length === 0) return;
    const { error } = await sb
      .from("onboarding_template_categories")
      .upsert(payload, { onConflict: "id" });
    if (error)
      throw new Error(`onboarding_template_categories reorder: ${error.message}`);
  },

  async reorderItems(input) {
    if (input.orderedIds.length === 0) return;
    const sb = getServiceClient();
    const { data: rows, error: fErr } = await sb
      .from("onboarding_template_items")
      .select(ITEM_COLS)
      .in("id", input.orderedIds);
    if (fErr) throw new Error(`reorderItems fetch: ${fErr.message}`);
    const byId = new Map((rows ?? []).map((r) => [(r as ItemRow).id, r as ItemRow]));
    const payload = input.orderedIds
      .map((id, i) => {
        const r = byId.get(id);
        if (!r) return null;
        return {
          id: r.id,
          category_id: r.category_id,
          item_key: r.item_key,
          name: r.name,
          due_offset_days: r.due_offset_days,
          required: r.required,
          default_assignee_role: r.default_assignee_role,
          course_key: r.course_key,
          display_order: (i + 1) * 10
        };
      })
      .filter(Boolean) as Array<Record<string, unknown>>;
    if (payload.length === 0) return;
    const { error } = await sb
      .from("onboarding_template_items")
      .upsert(payload, { onConflict: "id" });
    if (error)
      throw new Error(`onboarding_template_items reorder: ${error.message}`);
  },

  async deleteItem(id) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: prev } = await sb
      .from("onboarding_template_items")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const { error } = await sb
      .from("onboarding_template_items")
      .delete()
      .eq("id", id);
    if (error)
      throw new Error(`onboarding_template_items delete: ${error.message}`);
    await runAfterWrite({
      entityType: "onboarding_template_items",
      entityId: id,
      before: prev,
      action: "delete",
      ctx
    });
  }
};
