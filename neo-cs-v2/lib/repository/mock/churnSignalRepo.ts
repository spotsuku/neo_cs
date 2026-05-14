// 解約予兆シグナル mock リポジトリ
// 検知バッチ (lib/domain/churn.detectChurnSignals) の結果を保持する
// 起動時 seed として既存 mock データから一度全契約をスキャンして埋める

import { activeContracts } from "@/lib/mock/onboarding";
import { weeklyReviews, CURRENT_WEEK_MONDAY } from "@/lib/mock/weekly";
import { meetingLogs } from "@/lib/mock/entities";
import { detectChurnSignals } from "@/lib/domain/churn/churn";
import { mockHealthSnapshotRepo } from "./healthSnapshotRepo";
import { DEFAULT_ORG_ID } from "../types";
import type {
  ChurnSignalFilter,
  ChurnSignalRecord,
  ChurnSignalRepo
} from "../types";

const TODAY = "2026-04-24";
const FOUR_WEEKS_AGO = "2026-03-27";
const TWELVE_WEEKS_AGO = "2026-01-30";

// activeContracts から決定論的に "ミーティング履歴 (出席/欠席)" を生成
// 既存 weekly_reviews / meeting_logs から件数を測り、Health red の契約は欠席多めに
function deriveRecentMeetings(contractId: string, companyId: string, healthColor: string | undefined) {
  const baseSeed = contractId.charCodeAt(0) + contractId.length;
  // 直近の面談ログ + 週次レビューから occurredAt を抜く (面談=出席, 週次=出席相当)
  const dates = [
    ...meetingLogs.filter((m) => m.companyId === companyId).map((m) => m.date),
    ...weeklyReviews.filter((r) => r.companyId === companyId).map((r) => r.weekStart)
  ]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 4);
  return dates.map((d, i) => {
    // red 契約は直近2回欠席を強制 (検知ルール consecutive_absence のテスト)
    const forceAbsent = healthColor === "red" && i < 2;
    const r = (baseSeed + i) % 5;
    return {
      occurredAt: d,
      attended: forceAbsent ? false : r !== 0
    };
  });
}

function deriveActivity(companyId: string) {
  const recent = weeklyReviews.filter(
    (r) => r.companyId === companyId && r.weekStart >= FOUR_WEEKS_AGO
  ).length + meetingLogs.filter(
    (m) => m.companyId === companyId && m.date >= FOUR_WEEKS_AGO
  ).length;
  const baseline = (weeklyReviews.filter(
    (r) => r.companyId === companyId && r.weekStart >= TWELVE_WEEKS_AGO
  ).length + meetingLogs.filter(
    (m) => m.companyId === companyId && m.date >= TWELVE_WEEKS_AGO
  ).length) / 3; // 12週/4 = 3 で平均化して4週相当に
  return { recent, baseline };
}

async function seedSignals(): Promise<ChurnSignalRecord[]> {
  const out: ChurnSignalRecord[] = [];
  for (const c of activeContracts) {
    const snapshots = await mockHealthSnapshotRepo.listByContract(c.id);
    // 旧 RenewalMilestone は廃止 → 検知ルール milestone_overdue は当面スキップ
    // (program_company_tasks 連携は Phase 2 で対応)
    const milestones: never[] = [];
    const meetings = deriveRecentMeetings(c.id, c.companyId, c.healthScore?.color);
    const activity = deriveActivity(c.companyId);
    // mock NPS: red→detractor、yellow→passive、green→promoter
    const latestNpsScore =
      c.healthScore?.color === "red" ? 4 :
      c.healthScore?.color === "yellow" ? 7 :
      c.healthScore?.color === "green" ? 9 :
      undefined;

    const detected = detectChurnSignals({
      contractId: c.id,
      companyId: c.companyId,
      product: c.product,
      snapshots: snapshots.map((s) => ({ asOf: s.asOf, score: s.score })),
      recentMeetings: meetings,
      milestones,
      activityRecent: activity.recent,
      activityBaseline: activity.baseline,
      latestNpsScore,
      asOf: `${TODAY}T09:00:00Z`
    });

    for (const sig of detected) {
      out.push({
        id: sig.id,
        organizationId: DEFAULT_ORG_ID,
        contractId: sig.contractId,
        companyId: sig.companyId,
        product: sig.product,
        rule: sig.rule,
        severity: sig.severity,
        weight: sig.weight,
        reason: sig.reason,
        evidence: sig.evidence,
        detectedAt: sig.detectedAt
      });
    }
  }
  return out;
}

import { useGlobalStore } from "./_global-store";
import { mockMutate } from "./_mockMutate";
const state = useGlobalStore<{ store: ChurnSignalRecord[]; seeded: boolean }>(
  "__churnSignalState",
  () => ({ store: [], seeded: false })
);
async function ensureSeeded(): Promise<void> {
  if (state.seeded) return;
  const seeded = await seedSignals();
  state.store.length = 0;
  state.store.push(...seeded);
  state.seeded = true;
}
const store = state.store;

function applyFilter(list: ChurnSignalRecord[], f?: ChurnSignalFilter): ChurnSignalRecord[] {
  if (!f) return list;
  return list.filter((s) => {
    if (f.organizationId && s.organizationId !== f.organizationId) return false;
    if (f.contractId && s.contractId !== f.contractId) return false;
    if (f.companyId && s.companyId !== f.companyId) return false;
    if (f.rule && s.rule !== f.rule) return false;
    if (f.severity && s.severity !== f.severity) return false;
    if (f.resolvedOnly && !s.resolvedAt) return false;
    if (f.unresolvedOnly && s.resolvedAt) return false;
    if (f.unNotifiedOnly && s.notifiedAt) return false;
    return true;
  });
}

function clone(s: ChurnSignalRecord): ChurnSignalRecord {
  return { ...s, evidence: { ...s.evidence } };
}

export const mockChurnSignalRepo: ChurnSignalRepo = {
  async list(filter) {
    await ensureSeeded();
    return applyFilter(store, filter)
      .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))
      .map(clone);
  },
  async listByContract(contractId, opts) {
    await ensureSeeded();
    return store
      .filter((s) => s.contractId === contractId)
      .filter((s) => (opts?.unresolvedOnly ? !s.resolvedAt : true))
      .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))
      .map(clone);
  },
  async upsert(input) {
    await ensureSeeded();
    const id = input.id ?? `cs-${input.contractId}-${input.rule}`;
    const idx = store.findIndex((s) => s.id === id);
    const merged: ChurnSignalRecord = {
      id,
      organizationId: input.organizationId,
      contractId: input.contractId,
      companyId: input.companyId,
      product: input.product,
      rule: input.rule,
      severity: input.severity,
      weight: input.weight,
      reason: input.reason,
      evidence: { ...input.evidence },
      detectedAt: input.detectedAt
    };
    let before: ChurnSignalRecord | undefined;
    if (idx >= 0) {
      // 既存 resolved/notified 情報は維持
      const prev = store[idx];
      before = clone(prev);
      merged.resolvedAt = prev.resolvedAt;
      merged.resolvedBy = prev.resolvedBy;
      merged.resolutionNote = prev.resolutionNote;
      merged.notifiedAt = prev.notifiedAt;
      store[idx] = merged;
    } else {
      store.push(merged);
    }
    await mockMutate({
      entityType: "churn_signals",
      entityId: id,
      action: idx >= 0 ? "update" : "create",
      before,
      after: merged,
      organizationId: merged.organizationId
    });
    return clone(merged);
  },
  async resolve(id, opts) {
    await ensureSeeded();
    const idx = store.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const before = clone(store[idx]);
    store[idx] = {
      ...store[idx],
      resolvedAt: opts.resolvedAt ?? new Date().toISOString(),
      resolvedBy: opts.resolvedBy,
      resolutionNote: opts.note
    };
    await mockMutate({
      entityType: "churn_signals",
      entityId: id,
      action: "update",
      before,
      after: store[idx],
      organizationId: store[idx].organizationId
    });
  },
  async markNotified(id, notifiedAt) {
    await ensureSeeded();
    const idx = store.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const before = clone(store[idx]);
    store[idx] = {
      ...store[idx],
      notifiedAt: notifiedAt ?? new Date().toISOString()
    };
    await mockMutate({
      entityType: "churn_signals",
      entityId: id,
      action: "update",
      before,
      after: store[idx],
      organizationId: store[idx].organizationId
    });
  }
};

// 暗黙の参照: CURRENT_WEEK_MONDAY を tree-shaking で消されないよう (ESM静的解析)
void CURRENT_WEEK_MONDAY;
