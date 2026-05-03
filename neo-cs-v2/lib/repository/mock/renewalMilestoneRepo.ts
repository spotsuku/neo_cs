// 更新マイルストン mock リポジトリ
// 自動 done を排除し、明示的な markDone/markSkipped で状態管理する (G項)

import { generateRenewalMilestones } from "@/lib/mock/cycles";
import { activeContracts } from "@/lib/mock/onboarding";
import { transitionMilestone } from "@/lib/domain/renewal";
import type {
  RenewalMilestone,
  RenewalMilestoneRepo
} from "../types";

// 起動時 seed: 全 active 契約に対して 4本のマイルストンを生成 (status=pending)
function seedMilestones(): RenewalMilestone[] {
  const out: RenewalMilestone[] = [];
  for (const c of activeContracts) {
    if (!c.endDate) continue;
    const ms = generateRenewalMilestones(c.id, c.endDate);
    for (const m of ms) out.push(m);
  }
  return out;
}

const store: RenewalMilestone[] = seedMilestones();

function clone(m: RenewalMilestone): RenewalMilestone {
  return {
    ...m,
    evidence: m.evidence ? { ...m.evidence } : undefined
  };
}

function findIndex(id: string): number {
  return store.findIndex((m) => m.id === id);
}

export const mockRenewalMilestoneRepo: RenewalMilestoneRepo = {
  async listByContract(contractId) {
    return store
      .filter((m) => m.contractId === contractId)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map(clone);
  },
  async markDone(id, opts) {
    const idx = findIndex(id);
    if (idx < 0) throw new Error(`RenewalMilestone not found: ${id}`);
    const result = transitionMilestone(store[idx], {
      kind: "to_done",
      completedBy: opts.completedBy,
      evidence: opts.evidence,
      completedAt: opts.completedAt
    });
    if (!result.ok) throw new Error(result.error);
    store[idx] = result.next;
    return clone(store[idx]);
  },
  async markSkipped(id, opts) {
    const idx = findIndex(id);
    if (idx < 0) throw new Error(`RenewalMilestone not found: ${id}`);
    const result = transitionMilestone(store[idx], {
      kind: "to_skipped",
      skippedReason: opts.reason,
      skippedAt: opts.skippedAt
    });
    if (!result.ok) throw new Error(result.error);
    store[idx] = result.next;
    return clone(store[idx]);
  },
  async markInProgress(id) {
    const idx = findIndex(id);
    if (idx < 0) throw new Error(`RenewalMilestone not found: ${id}`);
    const result = transitionMilestone(store[idx], { kind: "to_in_progress" });
    if (!result.ok) throw new Error(result.error);
    store[idx] = result.next;
    return clone(store[idx]);
  }
};
