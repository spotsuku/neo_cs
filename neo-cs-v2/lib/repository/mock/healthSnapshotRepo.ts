// Mock health_score_snapshots — 直近12週分の時系列を生成
// 算出ロジックは lib/domain/health.ts の純関数を使う

import { activeContracts } from "@/lib/mock/onboarding";
import { computeHealthScore, deriveMockFactors } from "@/lib/domain/health/health";
import { DEFAULT_ORG_ID } from "../types";
import type { HealthSnapshot, HealthSnapshotRepo } from "../types";

const TODAY = "2026-04-24";
const WEEKS_BACK = 12;

function dateNDaysAgo(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function jitter(seed: number, amp: number): number {
  // -amp..+amp の決定論的揺らぎ
  const v = ((seed * 9301 + 49297) % 233280) / 233280; // 0..1
  return (v - 0.5) * 2 * amp;
}

function seedSnapshots(): HealthSnapshot[] {
  const out: HealthSnapshot[] = [];
  for (const c of activeContracts) {
    if (!c.healthScore) continue;
    // 直近のターゲットスコア (mock の color から)
    const baselineColor = c.healthScore.color;
    const factorsLatest = deriveMockFactors({
      contractId: c.id,
      product: c.product,
      baselineColor,
      endDate: c.endDate
    });
    const breakdownLatest = computeHealthScore(factorsLatest);
    out.push({
      organizationId: DEFAULT_ORG_ID,
      contractId: c.id,
      asOf: TODAY,
      score: breakdownLatest.score,
      color: breakdownLatest.color,
      factors: factorsLatest,
      computedAt: breakdownLatest.computedAt
    });

    // 過去12週: 同じ baseline からスタートし、週ごとに緩やかに変動させる
    let h = 0;
    for (let w = 1; w <= WEEKS_BACK; w++) {
      h = (h * 17 + c.id.charCodeAt(0) + w) | 0;
      const j = jitter(Math.abs(h) + w, 12); // ±12点
      const score = Math.max(0, Math.min(100, breakdownLatest.score + j));
      const color = score >= 75 ? "green" : score >= 55 ? "yellow" : "red";
      const asOf = dateNDaysAgo(TODAY, w * 7);
      out.push({
        organizationId: DEFAULT_ORG_ID,
        contractId: c.id,
        asOf,
        score: Math.round(score),
        color,
        factors: factorsLatest, // 過去 factor も同じ近似で保持
        computedAt: `${asOf}T00:00:00Z`
      });
    }
  }
  return out;
}

const store: HealthSnapshot[] = seedSnapshots();

export const mockHealthSnapshotRepo: HealthSnapshotRepo = {
  async listByContract(contractId, opts) {
    return store
      .filter((s) => s.contractId === contractId)
      .filter((s) => (opts?.from ? s.asOf >= opts.from : true))
      .filter((s) => (opts?.to ? s.asOf <= opts.to : true))
      .sort((a, b) => a.asOf.localeCompare(b.asOf))
      .map((s) => ({ ...s, factors: { ...s.factors } }));
  },
  async latestAll(opts) {
    const target = opts?.asOf ?? TODAY;
    // 各 contractId の as_of <= target で最大のものを採用
    const filtered = store
      .filter((s) => s.asOf <= target)
      .filter((s) => (opts?.organizationId ? s.organizationId === opts.organizationId : true));
    const byContract = new Map<string, HealthSnapshot>();
    for (const s of filtered) {
      const cur = byContract.get(s.contractId);
      if (!cur || s.asOf > cur.asOf) byContract.set(s.contractId, s);
    }
    return Array.from(byContract.values()).map((s) => ({
      ...s,
      factors: { ...s.factors }
    }));
  },
  async upsert(snap) {
    const idx = store.findIndex(
      (s) => s.contractId === snap.contractId && s.asOf === snap.asOf
    );
    const merged: HealthSnapshot = { ...snap, factors: { ...snap.factors } };
    if (idx >= 0) store[idx] = merged;
    else store.push(merged);
  }
};
