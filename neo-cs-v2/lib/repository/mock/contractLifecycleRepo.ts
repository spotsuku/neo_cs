// 契約ライフサイクル スナップショット (mock)
//
// 解約 / 更新成功 / 期満了の時点で凍結される読み取り中心のレポ。
// 本番では contract_lifecycle_snapshots テーブルに対応。

import type {
  ContractLifecycleRepo,
  ContractLifecycleSnapshot
} from "../types";
import { useGlobalStore } from "./_global-store";
import { allContracts } from "@/lib/mock/onboarding";

// 過去サイクル契約 (renewed/churned) から自動でスナップショットを生成
function seedSnapshots(): ContractLifecycleSnapshot[] {
  const out: ContractLifecycleSnapshot[] = [];
  for (const c of allContracts) {
    if (c.status !== "renewed" && c.status !== "churned") continue;
    out.push({
      contractId: c.id,
      organizationId:
        // organizationId は契約に直接保持されないため DEFAULT を使用
        "00000000-0000-0000-0000-000000000001",
      endedAs: c.status === "renewed" ? "renewed" : "churned",
      endedAt: c.endDate ? `${c.endDate}T00:00:00+09:00` : new Date().toISOString(),
      finalStageKey: c.status === "renewed" ? "consent" : "renewal_consideration",
      finalLifecycleState: c.status === "renewed" ? "active" : "churned",
      metrics: {
        finalMrr: c.mrr,
        // 出席率は sessionAttendance / churn メトリクスから引きたいが mock では
        // ヘルスから粗く推定
        attendanceRate:
          c.healthScore?.color === "green"
            ? 0.92
            : c.healthScore?.color === "yellow"
            ? 0.78
            : c.healthScore?.color === "red"
            ? 0.55
            : undefined,
        healthColor: c.healthScore?.color
      },
      churnReason: c.status === "churned" ? "更新意向見送り (mock)" : undefined,
      createdAt: new Date().toISOString()
    });
  }
  return out;
}

const store = useGlobalStore<ContractLifecycleSnapshot[]>(
  "__contractLifecycleStore",
  seedSnapshots
);

export const mockContractLifecycleRepo: ContractLifecycleRepo = {
  async listByCompany(companyId) {
    const myContractIds = new Set(
      allContracts.filter((c) => c.companyId === companyId).map((c) => c.id)
    );
    return store
      .filter((s) => myContractIds.has(s.contractId))
      .sort((a, b) => (a.endedAt < b.endedAt ? 1 : -1))
      .map((s) => ({ ...s }));
  },

  async getByContract(contractId) {
    const found = store.find((s) => s.contractId === contractId);
    return found ? { ...found } : null;
  },

  async freeze(input) {
    const exist = store.findIndex((s) => s.contractId === input.contractId);
    const next: ContractLifecycleSnapshot = {
      ...input,
      createdAt: new Date().toISOString()
    };
    if (exist >= 0) store[exist] = next;
    else store.push(next);
    return { ...next };
  },

  async unfreeze(contractId) {
    const idx = store.findIndex((s) => s.contractId === contractId);
    if (idx >= 0) store.splice(idx, 1);
  }
};
