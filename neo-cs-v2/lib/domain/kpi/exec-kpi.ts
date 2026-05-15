// 経営ダッシュボード用 KPI (継続型 = academia/hyogikai, 単発型 = aiken/commu)
//
// 既存の computeMrr/computeNrr は月次SaaS前提だが、本プロダクトの継続商材は
// 年間更新型 (academia/hyogikai)。年契約サイクルに合った 更新率 / GRR / 更新パイプライン
// を別関数で算出する。単発商材 (aiken/commu) はリピート率・平均単価などのスループット指標。

import type { Contract, ContractStatus } from "@/lib/mock/contracts";
import type { ProductCode } from "@/lib/master";

export const CONTINUOUS_PRODUCTS: ProductCode[] = ["academia", "hyogikai"];
export const ONESHOT_PRODUCTS: ProductCode[] = ["aiken", "commu"];

export const PRODUCT_LABEL: Record<ProductCode, string> = {
  academia: "ACADEMIA",
  hyogikai: "評議会",
  aiken: "AI研修",
  commu: "コミュマネ"
};

const ACTIVE_STATUSES: ContractStatus[] = [
  "handoff",
  "onboarding",
  "active",
  "renewal_window"
];

function isActive(c: Contract): boolean {
  return ACTIVE_STATUSES.includes(c.status);
}

function daysBetween(fromYmd: string, toYmd: string): number {
  return (Date.parse(toYmd) - Date.parse(fromYmd)) / (1000 * 60 * 60 * 24);
}

// ── 継続型 (年間更新) ─────────────────────────────────────

export type ContinuousKpis = {
  /** アクティブ契約の年額合計 (= MRR × 12) */
  totalArr: number;
  /** アクティブ契約数 */
  activeContracts: number;
  /** ユニーク企業数 (継続型のみ) */
  activeCompanies: number;
  /** 90日以内に期末日が到来する契約の ARR 合計 */
  pipelineArr: number;
  pipelineCount: number;
  /** 直近1年で期末日を迎えた契約のうち、後続契約 (renewed) があるものの割合 */
  renewalRate: number; // 0..1
  renewalDecided: number; // 母数
  renewalRetained: number; // 分子
  /** GRR = 維持できた既存ARR / 1年前ARR (downgrade も差し引く) */
  grossRetention: number; // 0..1
};

export function computeContinuousKpis(
  contracts: Contract[],
  asOf: string
): ContinuousKpis {
  const continuous = contracts.filter((c) => CONTINUOUS_PRODUCTS.includes(c.product));
  const active = continuous.filter(isActive);

  const totalMrr = active.reduce((s, c) => s + (c.mrr ?? 0), 0);
  const totalArr = totalMrr * 12;
  const activeCompanies = new Set(active.map((c) => c.companyId)).size;

  // 更新パイプライン: 期末日 ≤ 90日後
  const pipeline = active.filter((c) => {
    if (!c.endDate) return false;
    const days = daysBetween(asOf, c.endDate);
    return days >= 0 && days <= 90;
  });
  const pipelineArr = pipeline.reduce((s, c) => s + (c.mrr ?? 0), 0) * 12;

  // 更新率: 直近365日以内に期末を迎えた契約のうち、後続が存在するもの
  const oneYearAgo = new Date(asOf);
  oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);
  const oneYearAgoYmd = oneYearAgo.toISOString().slice(0, 10);

  const decidedContracts = continuous.filter(
    (c) => c.endDate && c.endDate >= oneYearAgoYmd && c.endDate <= asOf
  );
  const successorIds = new Set(
    continuous
      .filter((c) => c.previousContractId)
      .map((c) => c.previousContractId as string)
  );
  const retained = decidedContracts.filter((c) => successorIds.has(c.id));

  const renewalRate = decidedContracts.length === 0 ? 0 : retained.length / decidedContracts.length;

  // GRR: 1年前時点で active だった ARR に対し、現在も active (=同社継続) の割合
  const startedActive = continuous.filter((c) => {
    if (!c.startDate || c.startDate > oneYearAgoYmd) return false;
    if (!c.endDate) return true;
    return c.endDate >= oneYearAgoYmd;
  });
  const startArr = startedActive.reduce((s, c) => s + (c.mrr ?? 0), 0) * 12;
  // 1年前 active だった会社が、いま active か
  const startCompanies = new Set(startedActive.map((c) => c.companyId));
  const stillActiveCompanies = new Set(
    active.filter((c) => startCompanies.has(c.companyId)).map((c) => c.companyId)
  );
  const stillActiveArr = active
    .filter((c) => stillActiveCompanies.has(c.companyId))
    .reduce((s, c) => s + (c.mrr ?? 0), 0) * 12;
  const grossRetention = startArr === 0 ? 0 : Math.min(1, stillActiveArr / startArr);

  return {
    totalArr,
    activeContracts: active.length,
    activeCompanies,
    pipelineArr,
    pipelineCount: pipeline.length,
    renewalRate,
    renewalDecided: decidedContracts.length,
    renewalRetained: retained.length,
    grossRetention
  };
}

// ── 単発型 (AI研修 / コミュマネ) ────────────────────────

export type OneShotKpis = {
  /** 直近窓内の売上 (revenue 合計) */
  periodRevenue: number;
  /** 直近窓内の開催 (契約) 数 */
  periodCount: number;
  /** 直近窓内に発注した社数 (ユニーク) */
  periodCompanies: number;
  /** 平均単価 */
  averagePrice: number;
  /** リピート率: 期間内発注社のうち、それ以前にも発注実績がある社数の割合 */
  repeatRate: number;
  repeatCompanies: number;
  /** クロスセル: 単発発注社のうち、継続契約も持つ社数 */
  crossSellCount: number;
};

export function computeOneShotKpis(
  contracts: Contract[],
  asOf: string,
  windowDays = 90
): OneShotKpis {
  const oneShot = contracts.filter((c) => ONESHOT_PRODUCTS.includes(c.product));

  const fromDate = new Date(asOf);
  fromDate.setUTCDate(fromDate.getUTCDate() - windowDays);
  const fromYmd = fromDate.toISOString().slice(0, 10);

  const inWindow = oneShot.filter(
    (c) => c.startDate >= fromYmd && c.startDate <= asOf
  );
  const beforeWindow = oneShot.filter((c) => c.startDate < fromYmd);

  const periodRevenue = inWindow.reduce(
    (s, c) => s + (c.revenue ?? c.mrr ?? 0),
    0
  );
  const periodCount = inWindow.length;
  const periodCompaniesSet = new Set(inWindow.map((c) => c.companyId));
  const beforeCompaniesSet = new Set(beforeWindow.map((c) => c.companyId));
  const repeatCompanies = [...periodCompaniesSet].filter((id) =>
    beforeCompaniesSet.has(id)
  ).length;
  const repeatRate =
    periodCompaniesSet.size === 0 ? 0 : repeatCompanies / periodCompaniesSet.size;
  const averagePrice = periodCount === 0 ? 0 : Math.round(periodRevenue / periodCount);

  // クロスセル: 同社が継続契約 (active) も持っているか
  const continuousCompanies = new Set(
    contracts
      .filter((c) => CONTINUOUS_PRODUCTS.includes(c.product) && isActive(c))
      .map((c) => c.companyId)
  );
  const crossSellCount = [...periodCompaniesSet].filter((id) =>
    continuousCompanies.has(id)
  ).length;

  return {
    periodRevenue,
    periodCount,
    periodCompanies: periodCompaniesSet.size,
    averagePrice,
    repeatRate,
    repeatCompanies,
    crossSellCount
  };
}

// ── 事業別アクティブ社数 ─────────────────────────────

export type ProductActivity = {
  product: ProductCode;
  activeCompanies: number;
  activeContracts: number;
  totalMrrOrRevenue: number;
  isContinuous: boolean;
};

export function computeProductActivity(
  contracts: Contract[],
  asOf: string,
  oneShotWindowDays = 90
): ProductActivity[] {
  const fromDate = new Date(asOf);
  fromDate.setUTCDate(fromDate.getUTCDate() - oneShotWindowDays);
  const fromYmd = fromDate.toISOString().slice(0, 10);

  const products: ProductCode[] = ["academia", "hyogikai", "aiken", "commu"];
  return products.map((p) => {
    const isContinuous = CONTINUOUS_PRODUCTS.includes(p);
    if (isContinuous) {
      const list = contracts.filter((c) => c.product === p && isActive(c));
      return {
        product: p,
        activeCompanies: new Set(list.map((c) => c.companyId)).size,
        activeContracts: list.length,
        totalMrrOrRevenue: list.reduce((s, c) => s + (c.mrr ?? 0), 0),
        isContinuous: true
      };
    }
    // 単発: 直近 windowDays に発生したもの
    const list = contracts.filter(
      (c) => c.product === p && c.startDate >= fromYmd && c.startDate <= asOf
    );
    return {
      product: p,
      activeCompanies: new Set(list.map((c) => c.companyId)).size,
      activeContracts: list.length,
      totalMrrOrRevenue: list.reduce((s, c) => s + (c.revenue ?? c.mrr ?? 0), 0),
      isContinuous: false
    };
  });
}
