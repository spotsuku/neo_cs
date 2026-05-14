// ダッシュボード /dashboard/[product] 用のドメイン集計
//
// 旧来は lib/mock/data.ts の `continuousSummary` / `oneShotSummary` /
// `health.byProduct` / `mrrTrend` 等の固定値で表示していたが、
// 本ファイルでは Repository の生データから純関数で集計する。
//
// すべて副作用なし。Server Component が repo から取得したデータを引数に渡す前提。

import type {
  Contract,
  HealthSnapshot,
  Survey,
  ProductCode
} from "@/lib/repository/types";
import { colorOfScore, type HealthColor } from "../health/health";

/** 有効契約 (renewed/churned 以外) を product で絞る */
export function activeContractsOf(
  contracts: Contract[],
  product: ProductCode
): Contract[] {
  return contracts.filter(
    (c) =>
      c.product === product &&
      c.status !== "renewed" &&
      c.status !== "churned"
  );
}

export type ContinuousProductSummary = {
  activeContracts: number;
  activeParticipants: number;
  mrr: number;
  upcomingRenewals: number;
  /** 過去90日で endDate に到達した契約のうち renewed の割合 */
  renewalRate90d: number | null;
  updatedAt: string;
};

/**
 * 継続型 (academia / hyogikai / commu) の研修別サマリーを実データから派生。
 * 算出根拠が無い値 (NRR / 出席率 / NPS など) はここでは null で返し、
 * 専用 repo (attendanceRepo / surveyRepo) を持つ呼び出し元で別途補う。
 */
export function deriveContinuousSummary(
  contracts: Contract[],
  product: ProductCode,
  asOf: string = new Date().toISOString().slice(0, 10)
): ContinuousProductSummary {
  const active = activeContractsOf(contracts, product);
  const mrr = active.reduce((s, c) => s + (c.mrr ?? 0), 0);
  const activeParticipants = active.reduce((s, c) => s + c.participants, 0);

  // 直近90日窓
  const today = new Date(asOf);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 90);
  const past90 = new Date(today);
  past90.setDate(past90.getDate() - 90);

  const upcomingRenewals = active.filter((c) => {
    if (!c.endDate) return false;
    const end = new Date(c.endDate);
    return end >= today && end <= horizon;
  }).length;

  // renewalRate: 過去90日に endDate を迎えた contracts のうち status=renewed の割合
  const matured = contracts.filter((c) => {
    if (c.product !== product || !c.endDate) return false;
    const end = new Date(c.endDate);
    return end >= past90 && end < today;
  });
  const renewedCount = matured.filter((c) => c.status === "renewed").length;
  const renewalRate90d =
    matured.length === 0 ? null : renewedCount / matured.length;

  return {
    activeContracts: active.length,
    activeParticipants,
    mrr,
    upcomingRenewals,
    renewalRate90d,
    updatedAt: asOf
  };
}

export type OneShotProductSummary = {
  activeCourses: number;
  currentParticipants: number;
  fyGmv: number;
  updatedAt: string;
};

/** 単発型 (aiken) のサマリーを派生。修了率/リピート率は別途 attendanceRepo 経由の計算に委ねる */
export function deriveOneShotSummary(
  contracts: Contract[],
  product: ProductCode,
  asOf: string = new Date().toISOString().slice(0, 10)
): OneShotProductSummary {
  const active = activeContractsOf(contracts, product);
  const currentParticipants = active.reduce((s, c) => s + c.participants, 0);

  // 今年度: 4/1 起点 (日本会計年度想定)
  const today = new Date(asOf);
  const fyStartYear = today.getMonth() + 1 >= 4 ? today.getFullYear() : today.getFullYear() - 1;
  const fyStart = `${fyStartYear}-04-01`;

  const fyContracts = contracts.filter(
    (c) => c.product === product && c.startDate >= fyStart && c.startDate <= asOf
  );
  const fyGmv = fyContracts.reduce((s, c) => s + (c.revenue ?? 0), 0);

  // active なコース (= courseKey の distinct 数)
  const activeCourses = new Set(active.map((c) => c.courseKey)).size;

  return {
    activeCourses,
    currentParticipants,
    fyGmv,
    updatedAt: asOf
  };
}

/** Health Snapshot を product 別に集計し、green/yellow/red 件数を返す */
export function deriveHealthDistributionByProduct(
  snapshots: HealthSnapshot[],
  contracts: Contract[]
): Record<ProductCode, { green: number; yellow: number; red: number }> {
  // contractId → product のマップ
  const productByContract = new Map<string, ProductCode>();
  for (const c of contracts) productByContract.set(c.id, c.product);

  // 契約ごとに最新スナップショットを採用
  const latestByContract = new Map<string, HealthSnapshot>();
  for (const s of snapshots) {
    const cur = latestByContract.get(s.contractId);
    if (!cur || s.asOf > cur.asOf) latestByContract.set(s.contractId, s);
  }

  const init: Record<ProductCode, { green: number; yellow: number; red: number }> = {
    academia: { green: 0, yellow: 0, red: 0 },
    hyogikai: { green: 0, yellow: 0, red: 0 },
    aiken: { green: 0, yellow: 0, red: 0 },
    commu: { green: 0, yellow: 0, red: 0 }
  };

  for (const [contractId, snap] of latestByContract) {
    const product = productByContract.get(contractId);
    if (!product) continue;
    const color = colorOfScore(snap.score);
    init[product][color]++;
  }
  return init;
}

/**
 * 企業 ID から最新ヘルススコアの色を返す。
 * 企業の active 契約のうち最も悪い (red > yellow > green) を採用。
 * 該当スナップショットが無ければ null。
 */
export function deriveCompanyHealthColor(
  companyId: string,
  contracts: Contract[],
  snapshots: HealthSnapshot[]
): HealthColor | null {
  const latestByContract = new Map<string, HealthSnapshot>();
  for (const s of snapshots) {
    const cur = latestByContract.get(s.contractId);
    if (!cur || s.asOf > cur.asOf) latestByContract.set(s.contractId, s);
  }
  const myContracts = contracts.filter(
    (c) =>
      c.companyId === companyId &&
      c.status !== "renewed" &&
      c.status !== "churned"
  );
  const colors: HealthColor[] = myContracts
    .map((c) => latestByContract.get(c.id))
    .filter((s): s is HealthSnapshot => Boolean(s))
    .map((s) => colorOfScore(s.score));
  if (colors.length === 0) return null;
  if (colors.includes("red")) return "red";
  if (colors.includes("yellow")) return "yellow";
  return "green";
}

/**
 * surveyRepo から取得した productSurveys と各 survey の集計済 NPS から
 * NPS 推移と過去90日平均を派生。集計関数は引数で受ける (DI)。
 */
export function deriveNpsTimeline(
  surveys: Survey[],
  aggregator: (surveyId: string) => { npsScore?: number },
  asOf: string = new Date().toISOString().slice(0, 10)
): { points: { surveyId: string; openedAt: string; nps: number }[]; recentAvg90d: number | null } {
  const aggs = surveys
    .map((s) => ({ s, agg: aggregator(s.id) }))
    .filter((x) => typeof x.agg.npsScore === "number")
    .sort((a, b) => (a.s.openedAt < b.s.openedAt ? -1 : 1));

  const points = aggs.map((x) => ({
    surveyId: x.s.id,
    openedAt: x.s.openedAt,
    nps: x.agg.npsScore as number
  }));

  // 過去90日平均
  const cutoff = new Date(asOf);
  cutoff.setDate(cutoff.getDate() - 90);
  const recent = aggs.filter((x) => new Date(x.s.openedAt) >= cutoff);
  const recentAvg90d =
    recent.length === 0
      ? null
      : Math.round(
          recent.reduce((sum, x) => sum + (x.agg.npsScore as number), 0) / recent.length
        );

  return { points, recentAvg90d };
}
