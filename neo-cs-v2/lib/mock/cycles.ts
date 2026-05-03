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
  { id: "sh-aeon-3", companyId: "c-aeon", name: "佐藤 花子", role: "経営企画課長", type: "user", products: ["academia"], activeFrom: "2024-09-01", note: "稼働逼迫で参加頻度低下", engagement: "low" },
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

// reviews/02_CS責任者.md 指摘 (G項):
// 旧設計では「日付経過 → 自動 done」としていたため、形骸化していた。
// 担当 CS が明示的に completed をマークし、証跡 (note / attachmentUrl) を残す
// 設計に変更。日付超過した未着手は overdue として **派生表示** する。
//
// status:
//   - pending      未着手 (旧 "todo")
//   - in_progress  着手中 (担当者が「対応中」マーク)
//   - done         完了 (担当者が証跡付きで完了マーク)
//   - skipped      スキップ (理由必須)
// overdue は status とは別概念で、(status=pending|in_progress) AND (dueDate < today) で派生
export type RenewalMilestoneStatus = "pending" | "in_progress" | "done" | "skipped";

export type RenewalMilestoneEvidence = {
  note?: string;
  attachmentUrl?: string;
};

export type RenewalMilestone = {
  id: string;
  contractId: string;
  type: RenewalMilestoneType;
  dueDate: string;
  status: RenewalMilestoneStatus;
  /** done 時に必須。誰が完了マークしたか */
  completedBy?: string; // app_users.id
  completedAt?: string; // ISO
  /** 完了時の証跡 (CS監査用) */
  evidence?: RenewalMilestoneEvidence;
  /** skipped 時に必須 */
  skippedReason?: string;
  note?: string; // 旧フィールド互換
};

function offsetDate(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * 契約のendDateから逆算して4マイルストーンを自動生成 (status は全て "pending")。
 *
 * **重要**: 旧バージョンは日付経過で自動 "done" にしていたが、これを廃止した。
 * 完了は担当 CS が `markDone(id, evidence)` を明示的に呼ぶこと。
 * 日付超過は `isOverdue(milestone, today)` で派生判定する (lib/domain/renewal.ts)。
 */
export function generateRenewalMilestones(contractId: string, endDate: string): RenewalMilestone[] {
  return renewalMilestoneSpec.map((spec) => ({
    id: `${contractId}-${spec.type}`,
    contractId,
    type: spec.type,
    dueDate: offsetDate(endDate, spec.offsetDays),
    status: "pending"
  }));
}
