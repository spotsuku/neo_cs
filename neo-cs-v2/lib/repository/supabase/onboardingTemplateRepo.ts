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
};

function toItem(r: ItemRow): OnboardingTemplateItemRecord {
  return {
    id: r.id,
    categoryId: r.category_id,
    itemKey: r.item_key,
    name: r.name,
    dueOffsetDays: r.due_offset_days,
    required: r.required,
    defaultAssigneeRole: r.default_assignee_role,
    courseKey: r.course_key
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
            "id, category_id, item_key, name, due_offset_days, required, default_assignee_role, course_key, onboarding_template_categories!inner(product_code)"
          )
          .eq("onboarding_template_categories.product_code", productCode)
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
      items: (itemsByCat.get(c.id) ?? []).sort((a, b) =>
        a.itemKey.localeCompare(b.itemKey)
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
      .select(
        "id, category_id, item_key, name, due_offset_days, required, default_assignee_role, course_key"
      )
      .eq("category_id", input.categoryId)
      .eq("item_key", input.itemKey)
      .maybeSingle();
    const action = prev ? "update" : "create";
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
          course_key: input.courseKey ?? null
        },
        { onConflict: "category_id,item_key" }
      )
      .select(
        "id, category_id, item_key, name, due_offset_days, required, default_assignee_role, course_key"
      )
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
