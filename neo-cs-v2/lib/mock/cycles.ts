// CSモデル拡張：関係者 / アカウントジャーニー / Success Plan / 更新マイルストーン
// ポイント：
//  - Account層（サイクル非依存）：Stakeholder, AccountJourney
//  - Cycle層（契約単位）：SuccessPlan, RenewalMilestone

import { ProductCode } from "./data";

// ─────────────────────────────────────────────
// Stakeholder（関係者）— Account紐づき、サイクル跨いで継続
// ─────────────────────────────────────────────
// reviews/10_顧客.md の指摘により、個人を "離脱リスク" でラベル付けする
// at_risk 型は廃止。リスクは法人 (Company) 単位の Health Score で表現する。
// 個人については engagement (参加頻度低下など) を別フィールドで保持する。
export type StakeholderType = "decision_maker" | "champion" | "user";

export type StakeholderEngagement = "active" | "low" | "disengaged";

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
  /** 個人の関与度。低下時に CS が把握するための事実情報 (個人へのリスクラベルではない) */
  engagement?: StakeholderEngagement;
  /** 接点頻度 tier の手動上書き値 (Phase2-#4) */
  engagementTier?: "core" | "active" | "casual" | "at_risk" | null;
  engagementTierOverriddenBy?: string;
  engagementTierOverriddenAt?: string;
  engagementNote?: string;
};

export const stakeholderTypeLabel: Record<StakeholderType, string> = {
  decision_maker: "意思決定者",
  champion: "チャンピオン",
  user: "受講者"
};

export const engagementLabel: Record<StakeholderEngagement, string> = {
  active: "活発",
  low: "頻度低下",
  disengaged: "ほぼ不参加"
};

export const stakeholders: Stakeholder[] = [
  { id: "sh-aeon-1", companyId: "c-aeon", name: "山田 次郎", role: "副社長", type: "decision_maker", products: ["academia", "hyogikai"], activeFrom: "2024-09-01", note: "更新可否の最終判断者" },
  { id: "sh-aeon-2", companyId: "c-aeon", name: "田中 太郎", role: "人事部長", type: "champion", products: ["academia", "aiken", "hyogikai"], activeFrom: "2024-09-01", note: "取り組みを社内で推進" },
  // 旧 at_risk → user (受講者) + engagement: low に置換 (法人ヘルスへの影響は health_score_snapshots で表現)
  { id: "sh-aeon-3", companyId: "c-aeon", name: "佐藤 花子", role: "経営企画課長", type: "user", products: ["academia"], activeFrom: "2024-09-01", note: "稼働逼迫で参加頻度低下", engagement: "low", engagementTier: "at_risk", engagementNote: "3ヶ月接点なし。代替要員へ引き継ぎ検討" },
  { id: "sh-jrq-1", companyId: "c-jrq", name: "（人事部長）", role: "人事部長", type: "decision_maker", products: ["academia", "hyogikai"], activeFrom: "2024-08-01", engagementTier: "casual" },
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
// 旧 RenewalMilestone (T-120/90/60/30) は廃止
//   期日付きの更新タスクは事業別ToDo (program_company_tasks) に統合
//   ステージ進捗は事業ジャーニー + JourneyCheckpoint に統合
// ─────────────────────────────────────────────

// 旧 RenewalMilestone 型・generateRenewalMilestones 関数は削除済み。
// 期日付きの更新タスクが必要な場合は program_company_tasks (事業別ToDo) を使うこと。
