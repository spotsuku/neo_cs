// 企業ビジョン (NEO参画動機 / 中長期目標 / 今年度目標 / 活用方針) mock 実装
//
// 4つのナラティブ項目を企業単位で保持。in-memory ストア。
// upsert 時に変更前スナップショットを logs ストアに自動保存（年度更新等の履歴閲覧用）。
// 本番では company_visions / company_vision_logs テーブルに対応。

import type {
  CompanyVision,
  CompanyVisionRepo,
  CompanyVisionLog
} from "../types";
import { getOrInitGlobalStore } from "./_global-store";

const store = getOrInitGlobalStore<Map<string, CompanyVision>>(
  "__companyVisionStore",
  () => new Map()
);

const logsStore = getOrInitGlobalStore<CompanyVisionLog[]>(
  "__companyVisionLogStore",
  () => []
);

type Field = "joinMotivation" | "longTermGoal" | "thisYearGoal" | "usagePolicy";
const FIELDS: Field[] = [
  "joinMotivation",
  "longTermGoal",
  "thisYearGoal",
  "usagePolicy"
];

export const mockCompanyVisionRepo: CompanyVisionRepo = {
  async get(companyId) {
    const v = store.get(companyId);
    return v ? { ...v } : null;
  },

  async upsert(input) {
    const exist = store.get(input.companyId);

    // 変更検知 (新値が指定されていて、既存値と異なる場合)
    const changedFields: Field[] = [];
    if (exist) {
      for (const f of FIELDS) {
        const newVal = input[f];
        if (newVal === undefined) continue; // 未指定はスルー
        const trimmed = newVal.trim() || undefined;
        if (trimmed !== exist[f]) changedFields.push(f);
      }
      // 変更があれば、変更前のスナップショットを log として残す
      if (changedFields.length > 0) {
        logsStore.push({
          id: `cvl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          companyId: input.companyId,
          joinMotivation: exist.joinMotivation,
          longTermGoal: exist.longTermGoal,
          thisYearGoal: exist.thisYearGoal,
          usagePolicy: exist.usagePolicy,
          changedFields,
          recordedAt: new Date().toISOString(),
          recordedBy: input.updatedBy
        });
      }
    }

    const next: CompanyVision = {
      companyId: input.companyId,
      joinMotivation: input.joinMotivation ?? exist?.joinMotivation,
      longTermGoal: input.longTermGoal ?? exist?.longTermGoal,
      thisYearGoal: input.thisYearGoal ?? exist?.thisYearGoal,
      usagePolicy: input.usagePolicy ?? exist?.usagePolicy,
      updatedAt: new Date().toISOString(),
      updatedBy: input.updatedBy
    };
    store.set(input.companyId, next);
    return { ...next };
  },

  async listLogs(companyId) {
    return logsStore
      .filter((l) => l.companyId === companyId)
      .sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1))
      .map((l) => ({ ...l }));
  }
};
