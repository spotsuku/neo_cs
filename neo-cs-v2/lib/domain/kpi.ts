// KPI 算出ロジック (純関数 — health.ts / churn.ts と同じ設計思想)
//
// 設計原則:
//   - 副作用なし。Repository を引数で取らず、契約配列・解約配列・サーベイ等を受ける
//   - 全ての KPI は monetary type を `numeric(12,0) JPY` として整数で扱う (税抜)
//   - `breakdown` を必ず返す (UIで「計算根拠」モーダルが描けるように)
//   - 期間境界は from <= occurredAt < to の半開区間で統一
//   - 期間プリセット (thisMonth / thisQuarter / thisFY) は asOf を引数で受けて算出
//
// reviews/06_財務経理.md 主要指摘:
//   - Q1値とFY値が同一 → ここで periodFor() を分離して両者の窓を別物にする
//   - MRR/ARR/Churn/NRR の式が画面ハードコード → 全て本ファイルで定義
//
// reviews/01_経営者.md:
//   - 「同じ更新率が画面ごとに違う値」を撲滅。本ファイルが正本
//
// 用語:
//   - MRR (Monthly Recurring Revenue): その時点の active な継続型契約の月額合計
//   - ARR: MRR × 12
//   - Churn Rate: 期間内 churned MRR / 期初 MRR
//   - NRR (Net Revenue Retention): (期初 + expansion - downgrade - churn) / 期初
//   - At-Risk MRR: severity=high の churnSignal を持つ契約の MRR 合計

import type { Contract } from "@/lib/mock/contracts";
import type { ProductCode } from "@/lib/mock/data";
import type { ChurnSignalRecord } from "@/lib/repository";

// ── 期間プリセット ────────────────────────────────────────────────

export type PeriodKey = "thisMonth" | "thisQuarter" | "thisFY" | "last30d" | "last90d" | "last365d";

export type PeriodWindow = {
  key: PeriodKey | "custom";
  label: string;
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD exclusive
};

/** 会計年度: 4月始まり (FY26 = 2026/4/1〜2027/3/31) */
function fiscalStart(asOfDate: Date): Date {
  const y = asOfDate.getMonth() < 3 ? asOfDate.getFullYear() - 1 : asOfDate.getFullYear();
  return new Date(Date.UTC(y, 3, 1));
}

function fiscalQuarterIndex(asOfDate: Date): number {
  const fyStart = fiscalStart(asOfDate);
  const months =
    (asOfDate.getUTCFullYear() - fyStart.getUTCFullYear()) * 12 +
    (asOfDate.getUTCMonth() - fyStart.getUTCMonth());
  return Math.floor(months / 3); // 0..3
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(date: string, n: number): string {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function startOfNextMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

export function periodFor(key: PeriodKey, asOf: string): PeriodWindow {
  const asOfDate = new Date(`${asOf}T00:00:00Z`);
  if (key === "thisMonth") {
    const from = ymd(startOfMonth(asOfDate));
    const to = ymd(startOfNextMonth(asOfDate));
    return { key, label: `今月 (${from.slice(0, 7)})`, from, to };
  }
  if (key === "thisQuarter") {
    const fyStart = fiscalStart(asOfDate);
    const qIdx = fiscalQuarterIndex(asOfDate);
    const qStart = new Date(Date.UTC(fyStart.getUTCFullYear(), fyStart.getUTCMonth() + qIdx * 3, 1));
    const qEnd = new Date(Date.UTC(fyStart.getUTCFullYear(), fyStart.getUTCMonth() + qIdx * 3 + 3, 1));
    const fy = fyStart.getUTCFullYear() + 1; // FY ラベルは終端年
    return {
      key,
      label: `今四半期 (Q${qIdx + 1} FY${String(fy).slice(2)})`,
      from: ymd(qStart),
      to: ymd(qEnd)
    };
  }
  if (key === "thisFY") {
    const fyStart = fiscalStart(asOfDate);
    const fyEnd = new Date(Date.UTC(fyStart.getUTCFullYear() + 1, 3, 1));
    const fy = fyStart.getUTCFullYear() + 1;
    return { key, label: `今年度 (FY${String(fy).slice(2)})`, from: ymd(fyStart), to: ymd(fyEnd) };
  }
  if (key === "last30d") {
    return { key, label: "直近30日", from: addDays(asOf, -30), to: addDays(asOf, 1) };
  }
  if (key === "last90d") {
    return { key, label: "直近90日", from: addDays(asOf, -90), to: addDays(asOf, 1) };
  }
  // last365d
  return { key, label: "直近365日", from: addDays(asOf, -365), to: addDays(asOf, 1) };
}

// ── MRR / ARR ─────────────────────────────────────────────────────

export type MrrBreakdown = {
  totalMrr: number;
  byProduct: Record<ProductCode, number>;
  bySegment: { large: number; mid: number; small: number };
  contractCount: number;
  contributingContractIds: string[];
  asOf: string;
  formula: string;
};

const EMPTY_BY_PRODUCT: Record<ProductCode, number> = {
  academia: 0,
  hyogikai: 0,
  aiken: 0,
  commu: 0
};

function isActiveAt(c: Contract, asOf: string): boolean {
  if (c.status === "churned" || c.status === "renewed") return false;
  if (c.startDate > asOf) return false;
  if (c.endDate && c.endDate < asOf) return false;
  return true;
}

function segmentOf(mrr: number): "large" | "mid" | "small" {
  if (mrr >= 300_000) return "large";
  if (mrr >= 150_000) return "mid";
  return "small";
}

export function computeMrr(contracts: Contract[], asOf: string): MrrBreakdown {
  const byProduct: Record<ProductCode, number> = { ...EMPTY_BY_PRODUCT };
  const bySegment = { large: 0, mid: 0, small: 0 };
  const contributing: string[] = [];
  let total = 0;

  for (const c of contracts) {
    if (!isActiveAt(c, asOf)) continue;
    if (!c.mrr) continue; // 単発(aiken)は MRR 対象外
    total += c.mrr;
    byProduct[c.product] += c.mrr;
    bySegment[segmentOf(c.mrr)] += c.mrr;
    contributing.push(c.id);
  }

  return {
    totalMrr: total,
    byProduct,
    bySegment,
    contractCount: contributing.length,
    contributingContractIds: contributing,
    asOf,
    formula: "Σ contract.mrr WHERE active AND product.type='continuous'"
  };
}

export type ArrBreakdown = MrrBreakdown & { totalArr: number };

export function computeArr(contracts: Contract[], asOf: string): ArrBreakdown {
  const m = computeMrr(contracts, asOf);
  return { ...m, totalArr: m.totalMrr * 12, formula: "MRR × 12" };
}

// ── Churn Rate ────────────────────────────────────────────────────

export type ChurnRateBreakdown = {
  rate: number; // 0..1
  churnedMrr: number;
  startMrr: number;
  churnedContractIds: string[];
  period: PeriodWindow;
  formula: string;
};

export function computeChurnRate(
  contracts: Contract[],
  period: PeriodWindow
): ChurnRateBreakdown {
  // 期初の MRR (= from の前日時点で active)
  const startAsOf = addDays(period.from, -1);
  const startMrr = computeMrr(contracts, startAsOf).totalMrr;

  // 期間内に churned した契約の期初時点 MRR を合計
  // mock の Contract には churnedAt がない (status="churned" のみ) ので、endDate を churnedAt 相当で扱う
  let churnedMrr = 0;
  const churnedIds: string[] = [];
  for (const c of contracts) {
    if (c.status !== "churned") continue;
    const churnedAt = c.endDate ?? c.startDate;
    if (churnedAt < period.from || churnedAt >= period.to) continue;
    churnedMrr += c.mrr ?? 0;
    churnedIds.push(c.id);
  }

  const rate = startMrr > 0 ? churnedMrr / startMrr : 0;
  return {
    rate,
    churnedMrr,
    startMrr,
    churnedContractIds: churnedIds,
    period,
    formula: "churnedMrr (期間内) / startMrr (期初)"
  };
}

// ── NRR (Net Revenue Retention) ──────────────────────────────────

export type NrrBreakdown = {
  rate: number;
  startMrr: number;
  expansionMrr: number;
  downgradeMrr: number;
  churnedMrr: number;
  endMrr: number;
  period: PeriodWindow;
  formula: string;
};

export function computeNrr(contracts: Contract[], period: PeriodWindow): NrrBreakdown {
  const startAsOf = addDays(period.from, -1);
  const endAsOf = addDays(period.to, -1);
  const startMrr = computeMrr(contracts, startAsOf).totalMrr;
  const endMrr = computeMrr(contracts, endAsOf).totalMrr;

  // expansion / downgrade を previousContractId 経由で算出 (cycle 移行時の差分)
  let expansionMrr = 0;
  let downgradeMrr = 0;
  const byId = new Map(contracts.map((c) => [c.id, c]));
  for (const c of contracts) {
    if (!c.previousContractId) continue;
    if (c.startDate < period.from || c.startDate >= period.to) continue;
    const prev = byId.get(c.previousContractId);
    if (!prev) continue;
    const delta = (c.mrr ?? 0) - (prev.mrr ?? 0);
    if (delta > 0) expansionMrr += delta;
    else if (delta < 0) downgradeMrr += -delta;
  }

  // churn
  const ch = computeChurnRate(contracts, period);
  const churnedMrr = ch.churnedMrr;

  const numerator = startMrr + expansionMrr - downgradeMrr - churnedMrr;
  const rate = startMrr > 0 ? numerator / startMrr : 0;

  return {
    rate,
    startMrr,
    expansionMrr,
    downgradeMrr,
    churnedMrr,
    endMrr,
    period,
    formula: "(startMrr + expansion - downgrade - churn) / startMrr"
  };
}

// ── At-Risk MRR ───────────────────────────────────────────────────

export type AtRiskMrrBreakdown = {
  atRiskMrr: number;
  highSignalCount: number;
  contributingContractIds: string[];
  asOf: string;
  formula: string;
};

export function computeAtRiskMrr(
  contracts: Contract[],
  signals: ChurnSignalRecord[],
  asOf: string
): AtRiskMrrBreakdown {
  const byId = new Map(contracts.map((c) => [c.id, c]));
  const seen = new Set<string>();
  let total = 0;
  const ids: string[] = [];
  for (const s of signals) {
    if (s.severity !== "high") continue;
    if (s.resolvedAt) continue;
    if (seen.has(s.contractId)) continue;
    seen.add(s.contractId);
    const c = byId.get(s.contractId);
    if (!c) continue;
    if (!isActiveAt(c, asOf)) continue;
    if (!c.mrr) continue;
    total += c.mrr;
    ids.push(c.id);
  }
  return {
    atRiskMrr: total,
    highSignalCount: ids.length,
    contributingContractIds: ids,
    asOf,
    formula: "Σ contract.mrr WHERE EXISTS (churn_signal.severity='high' AND unresolved)"
  };
}

// ── 期間パフォーマンス (新規/更新/解約) ──────────────────────────

export type PeriodPerformanceBreakdown = {
  period: PeriodWindow;
  newContracts: number;
  newLogos: number; // ユニーク companyId
  renewedContracts: number;
  churnedContracts: number;
  grossMrrAtEnd: number;
  netMrrChange: number; // endMrr - startMrr
  formula: string;
};

export function computePeriodPerformance(
  contracts: Contract[],
  period: PeriodWindow
): PeriodPerformanceBreakdown {
  const startAsOf = addDays(period.from, -1);
  const endAsOf = addDays(period.to, -1);

  const newContracts = contracts.filter(
    (c) => c.startDate >= period.from && c.startDate < period.to
  );
  const newLogos = new Set(
    newContracts.filter((c) => !c.previousContractId).map((c) => c.companyId)
  ).size;

  const renewed = contracts.filter(
    (c) =>
      c.previousContractId &&
      c.startDate >= period.from &&
      c.startDate < period.to
  ).length;

  const churned = contracts.filter((c) => {
    if (c.status !== "churned") return false;
    const at = c.endDate ?? c.startDate;
    return at >= period.from && at < period.to;
  }).length;

  const startMrr = computeMrr(contracts, startAsOf).totalMrr;
  const endMrr = computeMrr(contracts, endAsOf).totalMrr;

  return {
    period,
    newContracts: newContracts.length,
    newLogos,
    renewedContracts: renewed,
    churnedContracts: churned,
    grossMrrAtEnd: endMrr,
    netMrrChange: endMrr - startMrr,
    formula:
      "newContracts/renewed/churned: contracts WHERE startDate or endDate ∈ [from, to). MRR は期初/期末スナップショット差分"
  };
}

// ── MRR月次トレンド ───────────────────────────────────────────────

export type MrrMonthlyPoint = { month: string; mrr: number };

export function computeMrrTrend(
  contracts: Contract[],
  monthsBack: number,
  asOf: string
): MrrMonthlyPoint[] {
  const out: MrrMonthlyPoint[] = [];
  const baseDate = new Date(`${asOf}T00:00:00Z`);
  for (let i = monthsBack - 1; i >= 0; i--) {
    const target = new Date(
      Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() - i + 1, 0)
    ); // 当該月末
    const month = target.toISOString().slice(0, 7);
    const m = computeMrr(contracts, ymd(target));
    out.push({ month, mrr: m.totalMrr });
  }
  return out;
}

// ── ユーティリティ ────────────────────────────────────────────────

export function formatYen(v: number): string {
  if (Math.abs(v) >= 100_000_000) return `${(v / 100_000_000).toFixed(2)}億円`;
  if (Math.abs(v) >= 10_000_000) return `${(v / 10_000_000).toFixed(1)}千万円`;
  if (Math.abs(v) >= 1_000_000) return `${(v / 10_000).toFixed(0)}万円`;
  return `¥${v.toLocaleString("ja-JP")}`;
}

export function formatPct(v: number, fractionDigits = 1): string {
  return `${(v * 100).toFixed(fractionDigits)}%`;
}
