// 契約エンティティ統一型
// CS運用上の契約ステータスとヘルススコアを集約

import { ProductCode } from "./data";

export type ContractStatus =
  | "handoff"          // 引き継ぎ受領、オンボ未着手
  | "onboarding"       // オンボ進行中
  | "active"           // 通常運用
  | "renewal_window"   // 期末90日以内
  | "renewed"          // 旧サイクル
  | "churned";         // 解約

export type HealthScore = {
  color: "green" | "yellow" | "red";
  score: number;
  factors: {
    attendance?: number;
    overdueOnboardingTasks?: number;
    weeksSinceLastTouch?: number;
    negativeSignalCount?: number;
  };
  computedAt: string;
};

export type Contract = {
  id: string;
  companyId: string;
  product: ProductCode;
  courseKey: string;
  planName?: string;
  startDate: string;
  endDate?: string;
  mrr?: number;
  revenue?: number;
  ownerName: string;
  participants: number;
  cycleNumber: number;
  previousContractId?: string;
  currentPhase?: string;
  phaseEnteredAt?: string;

  status: ContractStatus;
  healthScore?: HealthScore;
};

// status を派生で決定するヘルパー
export function deriveStatus(c: {
  onboardingStatus?: "in_progress" | "complete";
  cycleStatus?: "active" | "renewed" | "churned";
  endDate?: string;
}): ContractStatus {
  if (c.cycleStatus === "renewed") return "renewed";
  if (c.cycleStatus === "churned") return "churned";
  if (c.onboardingStatus === "in_progress") return "onboarding";
  if (c.endDate) {
    const diff = Date.parse(c.endDate) - Date.now();
    if (diff <= 90 * 86400 * 1000) return "renewal_window";
  }
  return "active";
}

// renewalStatus からヘルススコア派生
const SCORE_BY_COLOR: Record<"green" | "yellow" | "red", number> = {
  green: 90,
  yellow: 70,
  red: 40
};

export function deriveHealthScore(
  renewalStatus: "green" | "yellow" | "red" | undefined,
  computedAt: string
): HealthScore | undefined {
  if (!renewalStatus) return undefined;
  return {
    color: renewalStatus,
    score: SCORE_BY_COLOR[renewalStatus],
    factors: {},
    computedAt
  };
}
