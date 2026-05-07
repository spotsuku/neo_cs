// オンボテンプレの shape 変換ユーティリティ
//
// repo の OnboardingTemplateCategoryRecord[] を、既存 UI が期待する
// lib/mock/onboarding.ts の OnboardingCategory[] (key/label/order/items) に
// 変換する。filterTemplateByCourse 等の純関数群はこの shape を期待する。

import type {
  OnboardingTemplateCategoryRecord,
  OnboardingTemplateItemRecord
} from "@/lib/repository/types";
import type { OnboardingCategory, OnboardingTemplateItem } from "@/lib/mock/onboarding";

export function categoryRecordsToOnboardingCategories(
  cats: OnboardingTemplateCategoryRecord[]
): OnboardingCategory[] {
  return cats
    .map((c) => ({
      key: c.categoryKey,
      label: c.label,
      order: c.displayOrder,
      items: c.items.map(
        (i: OnboardingTemplateItemRecord): OnboardingTemplateItem => ({
          key: i.itemKey,
          name: i.name,
          dueOffsetDays: i.dueOffsetDays,
          required: i.required,
          defaultAssigneeRole: i.defaultAssigneeRole ?? undefined,
          courseKey: i.courseKey ?? null
        })
      )
    }))
    .sort((a, b) => a.order - b.order);
}
