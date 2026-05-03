// Mock kpi_snapshots — 直近12ヶ月の月次トレンド + 直近30日の日次を生成
// 算出ロジックは lib/domain/kpi.ts の純関数を使う

import { allContracts } from "@/lib/mock/onboarding";
import {
  computeMrr,
  computeChurnRate,
  computeNrr,
  computeAtRiskMrr,
  periodFor
} from "@/lib/domain/kpi";
import { mockChurnSignalRepo } from "./churnSignalRepo";
import { DEFAULT_ORG_ID } from "../types";
import type { KpiSnapshot, KpiSnapshotFilter, KpiSnapshotRepo } from "../types";

const TODAY = "2026-04-24";
const DAYS_BACK = 30;

function daysAgo(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

async function buildSnapshot(asOf: string): Promise<KpiSnapshot> {
  const mrr = computeMrr(allContracts, asOf);
  const last30 = periodFor("last30d", asOf);
  const last90 = periodFor("last90d", asOf);
  const churn30 = computeChurnRate(allContracts, last30);
  const churn90 = computeChurnRate(allContracts, last90);
  const nrr30 = computeNrr(allContracts, last30);
  const nrr90 = computeNrr(allContracts, last90);
  const signals = await mockChurnSignalRepo.list({ unresolvedOnly: true });
  const atRisk = computeAtRiskMrr(allContracts, signals, asOf);

  const byCompanyId = new Set(
    allContracts
      .filter((c) => c.status !== "renewed" && c.status !== "churned")
      .map((c) => c.companyId)
  );

  return {
    organizationId: DEFAULT_ORG_ID,
    asOf,
    totalMrr: mrr.totalMrr,
    totalArr: mrr.totalMrr * 12,
    activeContractCount: mrr.contributingContractIds.length,
    activeCompanyCount: byCompanyId.size,
    churnRate30d: churn30.rate,
    churnRate90d: churn90.rate,
    nrr30d: nrr30.rate,
    nrr90d: nrr90.rate,
    atRiskMrr: atRisk.atRiskMrr,
    byProduct: mrr.byProduct,
    bySegment: mrr.bySegment ?? {},
    computedAt: `${asOf}T00:00:00Z`
  };
}

let cached: KpiSnapshot[] | null = null;

async function getStore(): Promise<KpiSnapshot[]> {
  if (cached) return cached;
  const out: KpiSnapshot[] = [];
  for (let i = DAYS_BACK; i >= 0; i--) {
    out.push(await buildSnapshot(daysAgo(TODAY, i)));
  }
  cached = out;
  return out;
}

function clone(s: KpiSnapshot): KpiSnapshot {
  return {
    ...s,
    byProduct: { ...s.byProduct },
    bySegment: { ...s.bySegment }
  };
}

function applyFilter(list: KpiSnapshot[], f?: KpiSnapshotFilter): KpiSnapshot[] {
  if (!f) return list;
  let out = list;
  if (f.organizationId) out = out.filter((s) => s.organizationId === f.organizationId);
  if (f.fromAsOf) out = out.filter((s) => s.asOf >= f.fromAsOf!);
  if (f.toAsOf) out = out.filter((s) => s.asOf <= f.toAsOf!);
  if (f.limit) out = out.slice(-f.limit);
  return out;
}

export const mockKpiSnapshotRepo: KpiSnapshotRepo = {
  async list(filter) {
    const store = await getStore();
    return applyFilter(store, filter)
      .sort((a, b) => a.asOf.localeCompare(b.asOf))
      .map(clone);
  },
  async latest(opts) {
    const store = await getStore();
    const target = opts?.asOf ?? TODAY;
    const filtered = store
      .filter((s) => (opts?.organizationId ? s.organizationId === opts.organizationId : true))
      .filter((s) => s.asOf <= target);
    if (filtered.length === 0) return null;
    return clone(filtered[filtered.length - 1]);
  },
  async upsert(snap) {
    const store = await getStore();
    const idx = store.findIndex(
      (s) => s.organizationId === snap.organizationId && s.asOf === snap.asOf
    );
    const merged = clone(snap);
    if (idx >= 0) store[idx] = merged;
    else store.push(merged);
  }
};
