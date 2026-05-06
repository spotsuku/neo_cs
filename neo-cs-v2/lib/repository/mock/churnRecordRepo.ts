// 解約レコード mock リポジトリ
// lib/mock/churn.ts の churnRecords (ChurnRecord[]) を seed データとして読み、
// 以降は in-memory に書き戻す。
// 解約予兆シグナル (churnSignalRepo) とは別物 — こちらは「実際の解約」を扱う。

import { churnRecords as initialChurnRecords } from "@/lib/mock/churn";
import { activeContracts } from "@/lib/mock/onboarding";
import type {
  ChurnRecord,
  ChurnRecordRepo,
  ChurnRecordUpsertInput
} from "../types";
import { useGlobalStore } from "./_global-store";

// contractId → companyId の解決 (listByCompany 用)
function resolveCompanyId(contractId: string): string | undefined {
  return activeContracts.find((c) => c.id === contractId)?.companyId;
}

const state = useGlobalStore<{ store: ChurnRecord[] }>(
  "__churnRecordState",
  () => ({ store: initialChurnRecords.map((r) => ({ ...r })) })
);
const store = state.store;

function clone(r: ChurnRecord): ChurnRecord {
  return { ...r };
}

export const mockChurnRecordRepo: ChurnRecordRepo = {
  async listByCompany(companyId) {
    return store
      .filter((r) => resolveCompanyId(r.contractId) === companyId)
      .sort((a, b) => b.churnedAt.localeCompare(a.churnedAt))
      .map(clone);
  },
  async getByContract(contractId) {
    const found = store.find((r) => r.contractId === contractId);
    return found ? clone(found) : null;
  },
  async upsert(input: ChurnRecordUpsertInput) {
    const idx = store.findIndex((r) => r.contractId === input.contractId);
    const merged: ChurnRecord = {
      contractId: input.contractId,
      churnedAt: input.churnedAt,
      reasonCategory: input.reasonCategory,
      reasonNote: input.reasonNote ?? "",
      verifiedByCustomer: input.verifiedByCustomer ?? false,
      verifiedAt: input.verifiedAt,
      verificationNote: input.verificationNote,
      nextActionDate: input.nextActionDate,
      nextActionNote: input.nextActionNote,
      notified: input.notified ?? false
    };
    if (idx >= 0) {
      // 既存の verification 情報は input が undefined の時のみ維持
      const prev = store[idx];
      if (input.verifiedByCustomer === undefined) merged.verifiedByCustomer = prev.verifiedByCustomer;
      if (input.verifiedAt === undefined) merged.verifiedAt = prev.verifiedAt;
      if (input.verificationNote === undefined) merged.verificationNote = prev.verificationNote;
      if (input.notified === undefined) merged.notified = prev.notified;
      store[idx] = merged;
    } else {
      store.push(merged);
    }
    return clone(merged);
  },
  async setVerification(contractId, input) {
    const idx = store.findIndex((r) => r.contractId === contractId);
    if (idx < 0) {
      throw new Error(`churn_record not found: contractId=${contractId}`);
    }
    const verifiedAt = input.verifiedAt ?? new Date().toISOString();
    store[idx] = {
      ...store[idx],
      verifiedByCustomer: true,
      verifiedAt,
      verificationNote: input.verificationNote ?? store[idx].verificationNote
    };
    return clone(store[idx]);
  }
};
