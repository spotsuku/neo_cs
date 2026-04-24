// CSモデル拡張：関係者 / アカウントジャーニー / Success Plan / 更新マイルストーン
// ポイント：
//  - Account層（サイクル非依存）：Stakeholder, AccountJourney
//  - Cycle層（契約単位）：SuccessPlan, RenewalMilestone

import { ProductCode } from "./data";

// ─────────────────────────────────────────────
// Stakeholder（関係者）— Account紐づき、サイクル跨いで継続
// ─────────────────────────────────────────────
export type StakeholderType = "decision_maker" | "champion" | "user" | "at_risk";

export type Stakeholder = {
  id: string;
  companyId: string;
  name: string;
  role: string;           // 役職
  department?: string;
  type: StakeholderType;
  products: ProductCode[]; // 接点のある研修
  activeFrom: string;
  activeTo?: string;       // 離任時に埋まる
  note?: string;
};

export const stakeholderTypeLabel: Record<StakeholderType, string> = {
  decision_maker: "意思決定者",
  champion: "チャンピオン",
  user: "受講者",
  at_risk: "離脱リスク"
};

export const stakeholders: Stakeholder[] = [
  { id: "sh-aeon-1", companyId: "c-aeon", name: "山田 次郎", role: "副社長", type: "decision_maker", products: ["academia", "hyogikai"], activeFrom: "2024-09-01", note: "更新可否の最終判断者" },
  { id: "sh-aeon-2", companyId: "c-aeon", name: "田中 太郎", role: "人事部長", type: "champion", products: ["academia", "aiken", "hyogikai"], activeFrom: "2024-09-01", note: "取り組みを社内で推進" },
  { id: "sh-aeon-3", companyId: "c-aeon", name: "佐藤 花子", role: "経営企画課長", type: "at_risk", products: ["academia"], activeFrom: "2024-09-01", note: "稼働逼迫で参加頻度低下" },
  { id: "sh-jrq-1", companyId: "c-jrq", name: "（人事部長）", role: "人事部長", type: "decision_maker", products: ["academia", "hyogikai"], activeFrom: "2024-08-01" },
  { id: "sh-kyudenko-1", companyId: "c-kyudenko", name: "（研修担当）", role: "人材開発課長", type: "champion", products: ["commu", "aiken"], activeFrom: "2025-08-15" }
];

// ─────────────────────────────────────────────
// AccountJourney（アカウント×プロダクトの成熟度）— サイクル非依存
// ─────────────────────────────────────────────
export type JourneyStage = "onboarding" | "adoption" | "value" | "expansion";

export const journeyStageLabel: Record<JourneyStage, string> = {
  onboarding: "導入",
  adoption: "定着",
  value: "活用",
  expansion: "拡大"
};

export const journeyStageOrder: JourneyStage[] = ["onboarding", "adoption", "value", "expansion"];

export type AccountJourney = {
  companyId: string;
  product: ProductCode;
  currentStage: JourneyStage;
  stageEnteredAt: string;
  history: { stage: JourneyStage; enteredAt: string }[];
};

export const accountJourneys: AccountJourney[] = [
  {
    companyId: "c-aeon", product: "academia",
    currentStage: "value", stageEnteredAt: "2025-12-01",
    history: [
      { stage: "onboarding", enteredAt: "2024-09-01" },
      { stage: "adoption", enteredAt: "2024-12-01" },
      { stage: "value", enteredAt: "2025-12-01" }
    ]
  },
  {
    companyId: "c-aeon", product: "hyogikai",
    currentStage: "adoption", stageEnteredAt: "2025-01-15",
    history: [
      { stage: "onboarding", enteredAt: "2024-08-01" },
      { stage: "adoption", enteredAt: "2025-01-15" }
    ]
  },
  {
    companyId: "c-kyudenko", product: "commu",
    currentStage: "value", stageEnteredAt: "2025-12-01",
    history: [
      { stage: "onboarding", enteredAt: "2025-08-15" },
      { stage: "adoption", enteredAt: "2025-10-01" },
      { stage: "value", enteredAt: "2025-12-01" }
    ]
  }
];

// ─────────────────────────────────────────────
// SuccessPlan（契約＝サイクル単位）
// ─────────────────────────────────────────────
export type SuccessPlanGoal = {
  key: string;
  title: string;
  targetMetric?: string;    // 例：「出席率85%以上」
  achievement: number;      // 0..1
  note?: string;
};

export type SuccessPlan = {
  contractId: string;
  goals: SuccessPlanGoal[];
  overallAchievement: number;  // 0..1
  updatedAt: string;
};

export const successPlans: SuccessPlan[] = [
  {
    contractId: "k-aeon-academia",
    overallAchievement: 0.58,
    updatedAt: "2026-04-15",
    goals: [
      { key: "attendance", title: "受講者の出席率", targetMetric: "85%以上", achievement: 0.72 },
      { key: "project", title: "共創PJT 1本の社内実装", targetMetric: "1件以上", achievement: 0.40, note: "副社長レビュー待ち" },
      { key: "nps", title: "修了時NPS", targetMetric: "+40以上", achievement: 0.62 }
    ]
  },
  {
    contractId: "k-kyudenko-commu",
    overallAchievement: 0.80,
    updatedAt: "2026-04-20",
    goals: [
      { key: "attendance", title: "出席率", targetMetric: "90%以上", achievement: 0.95 },
      { key: "practice", title: "学びの社内実践", targetMetric: "1件/人", achievement: 0.75 },
      { key: "expand", title: "次期受講者の拡大", targetMetric: "3名以上", achievement: 0.67 }
    ]
  }
];

// ─────────────────────────────────────────────
// RenewalMilestone（更新マイルストーン T-120/90/60/30）
// ─────────────────────────────────────────────
export type RenewalMilestoneType = "T-120" | "T-90" | "T-60" | "T-30";

export const renewalMilestoneSpec: { type: RenewalMilestoneType; offsetDays: number; label: string; description: string }[] = [
  { type: "T-120", offsetDays: -120, label: "価値実現レビュー", description: "Success Plan達成度の初期確認" },
  { type: "T-90",  offsetDays: -90,  label: "更新意向ヒアリング", description: "Green/Yellow/Red判定" },
  { type: "T-60",  offsetDays: -60,  label: "更新提案", description: "提案書・拡大提案の提示" },
  { type: "T-30",  offsetDays: -30,  label: "クロージング", description: "契約書送付・最終合意" }
];

export type RenewalMilestone = {
  id: string;
  contractId: string;
  type: RenewalMilestoneType;
  dueDate: string;
  status: "todo" | "done" | "skipped";
  note?: string;
};

function offsetDate(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// 契約のendDateから逆算して4マイルストーンを自動生成
export function generateRenewalMilestones(contractId: string, endDate: string): RenewalMilestone[] {
  const TODAY = "2026-04-24";
  return renewalMilestoneSpec.map((spec) => {
    const dueDate = offsetDate(endDate, spec.offsetDays);
    const done = new Date(dueDate) < new Date(TODAY);
    return {
      id: `${contractId}-${spec.type}`,
      contractId,
      type: spec.type,
      dueDate,
      status: done ? "done" : "todo"
    };
  });
}
