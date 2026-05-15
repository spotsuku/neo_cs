"use server";

// オンボテンプレ編集 Server Actions
// admin 専用 (canManageUsers と同じ閾値)

import { revalidatePath } from "next/cache";
import {
  onboardingTemplateRepo,
  onboardingItemRepo,
  contractRepo
} from "@/lib/repository/server";
import { DEFAULT_ORG_ID } from "@/lib/repository/types";
import type { ContractOnboardingItem } from "@/lib/repository/types";
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

export async function reorderOnboardingCategoriesAction(input: {
  productCode: string;
  orderedIds: string[];
}): Promise<Result> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    await onboardingTemplateRepo.reorderCategories({
      productCode: input.productCode,
      orderedIds: input.orderedIds
    });
    revalidatePath(`/settings/products/${input.productCode}`);
    return { ok: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function reorderOnboardingItemsAction(input: {
  productCode: string;
  categoryId: string;
  orderedIds: string[];
}): Promise<Result> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    await onboardingTemplateRepo.reorderItems({
      categoryId: input.categoryId,
      orderedIds: input.orderedIds
    });
    revalidatePath(`/settings/products/${input.productCode}`);
    return { ok: true };
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

// ─────────────────────────────────────────────
// 既存契約への一括適用
// 指定 product の active 契約全件に対して、現テンプレ項目をタスクとして
// 投入する。既に存在する (contract_id, category_key, item_key) は skip。
// ─────────────────────────────────────────────
export async function applyTemplateToActiveContractsAction(input: {
  productCode: string;
}): Promise<
  | { ok: true; created: number; skipped: number; targetContracts: number }
  | { ok: false; message: string }
> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    const [categories, allContracts] = await Promise.all([
      onboardingTemplateRepo.listByProduct(input.productCode),
      contractRepo.list()
    ]);

    // active 契約 = renewed/churned 以外
    const targets = allContracts.filter(
      (c) =>
        c.product === input.productCode &&
        c.status !== "renewed" &&
        c.status !== "churned"
    );
    if (targets.length === 0) {
      return { ok: true, created: 0, skipped: 0, targetContracts: 0 };
    }

    // 既存項目 (重複防止)
    const existing = await onboardingItemRepo.listByContractIds(
      targets.map((c) => c.id)
    );
    const existingKey = new Set(
      existing.map((it) => `${it.contractId}::${it.categoryKey}::${it.itemKey}`)
    );

    const newItems: ContractOnboardingItem[] = [];
    for (const c of targets) {
      const startMs = Date.parse(c.startDate);
      for (const cat of categories) {
        for (const item of cat.items) {
          // courseKey 制約: null = 全コース共通、文字列 = 該当コースのみ
          if (item.courseKey && item.courseKey !== c.courseKey) continue;
          const key = `${c.id}::${cat.categoryKey}::${item.itemKey}`;
          if (existingKey.has(key)) continue;
          const dueMs = startMs + item.dueOffsetDays * 24 * 60 * 60 * 1000;
          const dueDate = Number.isNaN(startMs)
            ? ""
            : new Date(dueMs).toISOString().slice(0, 10);
          newItems.push({
            // id は repo 側で振り直されるため適当な仮値
            id: `${c.id}-${cat.categoryKey}-${item.itemKey}`,
            organizationId: DEFAULT_ORG_ID,
            contractId: c.id,
            templateItemId: item.id,
            categoryKey: cat.categoryKey,
            itemKey: item.itemKey,
            name: item.name,
            dueDate,
            assignee: "",
            status: "todo",
            required: item.required
          });
        }
      }
    }

    if (newItems.length > 0) {
      await onboardingItemRepo.createBatch(newItems);
    }
    const totalSlots = targets.length * categories.reduce((a, c) => a + c.items.length, 0);
    revalidatePath(`/settings/products/${input.productCode}`);
    revalidatePath(`/onboarding`);
    return {
      ok: true,
      created: newItems.length,
      skipped: totalSlots - newItems.length,
      targetContracts: targets.length
    };
  } catch (e) {
    return fail((e as Error).message);
  }
}
