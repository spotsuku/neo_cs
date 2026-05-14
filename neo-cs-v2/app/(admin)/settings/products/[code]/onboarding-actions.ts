"use server";

// オンボテンプレ編集 Server Actions
// admin 専用 (canManageUsers と同じ閾値)

import { revalidatePath } from "next/cache";
import { onboardingTemplateRepo } from "@/lib/repository/server";
import { getPermissionContext } from "@/lib/auth/server";
import { canManageUsers } from "@/lib/auth/permissions";

type Result<T = void> = (T extends void ? { ok: true } : { ok: true } & T) | { ok: false; message: string };

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

async function gate(): Promise<{ ok: true } | { ok: false; message: string }> {
  const ctx = await getPermissionContext();
  if (!canManageUsers(ctx)) return fail("管理者のみが編集できます");
  return { ok: true };
}

export async function upsertOnboardingCategoryAction(input: {
  productCode: string;
  id?: string;
  categoryKey: string;
  label: string;
  displayOrder: number;
}): Promise<Result<{ id: string }>> {
  const g = await gate();
  if (!g.ok) return g;
  if (!input.label.trim()) return fail("ラベルは必須です");
  if (!input.categoryKey.trim()) return fail("category_key は必須です");
  try {
    const cat = await onboardingTemplateRepo.upsertCategory({
      id: input.id,
      productCode: input.productCode,
      categoryKey: input.categoryKey.trim(),
      label: input.label.trim(),
      displayOrder: input.displayOrder
    });
    revalidatePath(`/settings/products/${input.productCode}`);
    return { ok: true, id: cat.id };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function deleteOnboardingCategoryAction(input: {
  productCode: string;
  id: string;
}): Promise<Result> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    await onboardingTemplateRepo.deleteCategory(input.id);
    revalidatePath(`/settings/products/${input.productCode}`);
    return { ok: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function upsertOnboardingItemAction(input: {
  productCode: string;
  id?: string;
  categoryId: string;
  itemKey: string;
  name: string;
  dueOffsetDays: number;
  required: boolean;
  defaultAssigneeRole?: "cs" | "pr" | "ops" | "finance" | null;
  courseKey?: string | null;
}): Promise<Result<{ id: string }>> {
  const g = await gate();
  if (!g.ok) return g;
  if (!input.name.trim()) return fail("項目名は必須です");
  if (!input.itemKey.trim()) return fail("item_key は必須です");
  if (!Number.isFinite(input.dueOffsetDays)) return fail("dueOffsetDays は数値で入力してください");
  try {
    const item = await onboardingTemplateRepo.upsertItem({
      id: input.id,
      categoryId: input.categoryId,
      itemKey: input.itemKey.trim(),
      name: input.name.trim(),
      dueOffsetDays: input.dueOffsetDays,
      required: input.required,
      defaultAssigneeRole: input.defaultAssigneeRole ?? null,
      courseKey: input.courseKey?.trim() ? input.courseKey.trim() : null
    });
    revalidatePath(`/settings/products/${input.productCode}`);
    return { ok: true, id: item.id };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function deleteOnboardingItemAction(input: {
  productCode: string;
  id: string;
}): Promise<Result> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    await onboardingTemplateRepo.deleteItem(input.id);
    revalidatePath(`/settings/products/${input.productCode}`);
    return { ok: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}
