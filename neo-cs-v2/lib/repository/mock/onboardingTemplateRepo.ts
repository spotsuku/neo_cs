// オンボテンプレ Mock 実装
// 既存の lib/mock/onboarding.ts:productOnboardingTemplates をスタートライン値として使う

import { productOnboardingTemplates } from "@/lib/mock/onboarding";
import type { ProductCode } from "@/lib/master";
import type {
  OnboardingTemplateCategoryRecord,
  OnboardingTemplateItemRecord,
  OnboardingTemplateRepo
} from "../types";
import { getOrInitGlobalStore } from "./_global-store";
import { mockMutate } from "./_mockMutate";

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function seed(): OnboardingTemplateCategoryRecord[] {
  const out: OnboardingTemplateCategoryRecord[] = [];
  for (const code of Object.keys(productOnboardingTemplates) as ProductCode[]) {
    const cats = productOnboardingTemplates[code];
    for (const cat of cats) {
      const catId = `cat_${code}_${cat.key}`;
      out.push({
        id: catId,
        productCode: code,
        categoryKey: cat.key,
        label: cat.label,
        displayOrder: cat.order,
        items: cat.items.map((it, idx) => ({
          id: `it_${code}_${cat.key}_${it.key}`,
          categoryId: catId,
          itemKey: it.key,
          name: it.name,
          dueOffsetDays: it.dueOffsetDays,
          required: it.required,
          defaultAssigneeRole: it.defaultAssigneeRole ?? null,
          courseKey: it.courseKey ?? null,
          displayOrder: (idx + 1) * 10
        }))
      });
    }
  }
  return out;
}

const store = getOrInitGlobalStore<OnboardingTemplateCategoryRecord[]>(
  "__onboardingTemplateStore",
  seed
);

function clone(c: OnboardingTemplateCategoryRecord): OnboardingTemplateCategoryRecord {
  return { ...c, items: c.items.map((i) => ({ ...i })) };
}

function findCategoryByItemId(itemId: string): {
  cat: OnboardingTemplateCategoryRecord;
  itemIdx: number;
} | null {
  for (const cat of store) {
    const idx = cat.items.findIndex((i) => i.id === itemId);
    if (idx >= 0) return { cat, itemIdx: idx };
  }
  return null;
}

export const mockOnboardingTemplateRepo: OnboardingTemplateRepo = {
  async listByProduct(productCode) {
    return store
      .filter((c) => c.productCode === productCode)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((c) => {
        const cloned = clone(c);
        cloned.items.sort((a, b) => a.displayOrder - b.displayOrder);
        return cloned;
      });
  },

  async upsertCategory(input) {
    const idx = input.id
      ? store.findIndex((c) => c.id === input.id)
      : store.findIndex(
          (c) =>
            c.productCode === input.productCode &&
            c.categoryKey === input.categoryKey
        );
    if (idx < 0) {
      const created: OnboardingTemplateCategoryRecord = {
        id: input.id ?? genId("cat"),
        productCode: input.productCode,
        categoryKey: input.categoryKey,
        label: input.label,
        displayOrder: input.displayOrder,
        items: []
      };
      store.push(created);
      await mockMutate({
        entityType: "onboarding_template_categories",
        entityId: created.id,
        action: "create",
        after: created,
        organizationId: null
      });
      return clone(created);
    }
    const before = clone(store[idx]);
    store[idx] = {
      ...store[idx],
      label: input.label,
      displayOrder: input.displayOrder
    };
    await mockMutate({
      entityType: "onboarding_template_categories",
      entityId: store[idx].id,
      action: "update",
      before,
      after: store[idx],
      organizationId: null
    });
    return clone(store[idx]);
  },

  async deleteCategory(id) {
    const idx = store.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const before = clone(store[idx]);
    store.splice(idx, 1);
    await mockMutate({
      entityType: "onboarding_template_categories",
      entityId: id,
      action: "delete",
      before,
      organizationId: null
    });
  },

  async upsertItem(input) {
    const cat = store.find((c) => c.id === input.categoryId);
    if (!cat) throw new Error(`category not found: ${input.categoryId}`);
    const existing = input.id
      ? cat.items.findIndex((i) => i.id === input.id)
      : cat.items.findIndex((i) => i.itemKey === input.itemKey);
    if (existing < 0) {
      const maxOrder = cat.items.reduce(
        (m, i) => Math.max(m, i.displayOrder ?? 0),
        0
      );
      const created: OnboardingTemplateItemRecord = {
        id: input.id ?? genId("it"),
        categoryId: cat.id,
        itemKey: input.itemKey,
        name: input.name,
        dueOffsetDays: input.dueOffsetDays,
        required: input.required,
        defaultAssigneeRole: input.defaultAssigneeRole ?? null,
        courseKey: input.courseKey ?? null,
        displayOrder: input.displayOrder ?? maxOrder + 10
      };
      cat.items.push(created);
      await mockMutate({
        entityType: "onboarding_template_items",
        entityId: created.id,
        action: "create",
        after: created,
        organizationId: null
      });
      return { ...created };
    }
    const before = { ...cat.items[existing] };
    cat.items[existing] = {
      ...cat.items[existing],
      itemKey: input.itemKey,
      name: input.name,
      dueOffsetDays: input.dueOffsetDays,
      required: input.required,
      defaultAssigneeRole: input.defaultAssigneeRole ?? null,
      courseKey: input.courseKey ?? null,
      displayOrder: input.displayOrder ?? cat.items[existing].displayOrder
    };
    await mockMutate({
      entityType: "onboarding_template_items",
      entityId: cat.items[existing].id,
      action: "update",
      before,
      after: cat.items[existing],
      organizationId: null
    });
    return { ...cat.items[existing] };
  },

  async reorderCategories(input) {
    const indexInOrder = new Map(input.orderedIds.map((id, i) => [id, i]));
    let i = 0;
    for (const cat of store) {
      if (cat.productCode !== input.productCode) continue;
      const pos = indexInOrder.get(cat.id);
      if (pos === undefined) continue;
      cat.displayOrder = (pos + 1) * 10;
      i++;
    }
    void i;
  },

  async reorderItems(input) {
    const cat = store.find((c) => c.id === input.categoryId);
    if (!cat) return;
    const indexInOrder = new Map(input.orderedIds.map((id, i) => [id, i]));
    for (const it of cat.items) {
      const pos = indexInOrder.get(it.id);
      if (pos === undefined) continue;
      it.displayOrder = (pos + 1) * 10;
    }
    cat.items.sort((a, b) => a.displayOrder - b.displayOrder);
  },

  async deleteItem(id) {
    const found = findCategoryByItemId(id);
    if (!found) return;
    const before = { ...found.cat.items[found.itemIdx] };
    found.cat.items.splice(found.itemIdx, 1);
    await mockMutate({
      entityType: "onboarding_template_items",
      entityId: id,
      action: "delete",
      before,
      organizationId: null
    });
  }
};
