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

// 表示中契約群の courseKey 集合に該当する項目（＋全コース共通）だけを残す。
// DB の OnboardingTemplateCategoryRecord を受けて同じ shape を返す。
// item.courseKey が null/undefined のものは常に残す。
export function filterTemplateRecordsByCourses(
  template: OnboardingTemplateCategoryRecord[],
  courseKeys: ReadonlyArray<string | null | undefined>
): OnboardingTemplateCategoryRecord[] {
  const set = new Set<string>();
  for (const k of courseKeys) if (k != null) set.add(k);
  return template
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((it) => it.courseKey == null || set.has(it.courseKey))
    }))
    .filter((cat) => cat.items.length > 0);
}

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
