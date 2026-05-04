// product_courses (mock 実装)
//
// /lib/mock/data.ts の productCourses と /lib/mock/contracts.ts の allContracts
// を seed として in-memory に保持し、契約紐付き影響を返す。
//
// 注意: mock は process メモリ常駐なので HMR で再評価されると初期化される。
// 本番 (Supabase 実装) では DB の真値を参照する。

import { productCourses } from "@/lib/mock/data";
import { allContracts } from "@/lib/mock/onboarding";
import type {
  ProductCourse,
  ProductCourseDeleteResult,
  ProductCourseRepo,
  ProductCourseUpsertInput
} from "../types";

type Store = ProductCourse[];

const store: Store = (() => {
  const out: Store = [];
  for (const [productCode, courses] of Object.entries(productCourses)) {
    courses.forEach((c, idx) => {
      out.push({
        productCode,
        courseKey: c.key,
        name: c.name,
        shortName: c.shortName,
        description: c.description,
        displayOrder: idx + 1
      });
    });
  }
  return out;
})();

function findIdx(productCode: string, courseKey: string): number {
  return store.findIndex(
    (c) => c.productCode === productCode && c.courseKey === courseKey
  );
}

export const mockProductCourseRepo: ProductCourseRepo = {
  async listByProduct(productCode) {
    return store
      .filter((c) => c.productCode === productCode)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((c) => ({ ...c }));
  },

  async countContractsByCourse(productCode, courseKey) {
    return allContracts.filter(
      (c) => c.product === productCode && c.courseKey === courseKey
    ).length;
  },

  async upsert(input: ProductCourseUpsertInput) {
    const prevKey = input.previousCourseKey ?? input.courseKey;
    const prevIdx = findIdx(input.productCode, prevKey);

    // ユニーク制約: 同一 productCode 配下で courseKey 重複は別レコードでは不可
    const dupIdx = findIdx(input.productCode, input.courseKey);
    if (dupIdx >= 0 && dupIdx !== prevIdx) {
      throw new Error(
        `course_key '${input.courseKey}' は既に ${input.productCode} 配下に存在します`
      );
    }

    const next: ProductCourse = {
      productCode: input.productCode,
      courseKey: input.courseKey,
      name: input.name,
      shortName: input.shortName ?? undefined,
      description: input.description ?? undefined,
      displayOrder:
        input.displayOrder ??
        (prevIdx >= 0
          ? store[prevIdx].displayOrder
          : store.filter((c) => c.productCode === input.productCode).length + 1)
    };

    if (prevIdx >= 0) {
      // rename も含む update
      store[prevIdx] = next;
      // course_key 変更なら mock 上の契約も追従させて整合性を保つ
      if (prevKey !== input.courseKey) {
        for (const ct of allContracts) {
          if (ct.product === input.productCode && ct.courseKey === prevKey) {
            ct.courseKey = input.courseKey;
          }
        }
      }
    } else {
      store.push(next);
    }
    return { ...next };
  },

  async delete(productCode, courseKey) {
    const affected = await this.countContractsByCourse(productCode, courseKey);
    const idx = findIdx(productCode, courseKey);
    if (idx >= 0) store.splice(idx, 1);
    return { affectedContracts: affected } satisfies ProductCourseDeleteResult;
  }
};
