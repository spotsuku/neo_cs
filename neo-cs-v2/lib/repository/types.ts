// リポジトリ層: Domain型 + Repositoryインターフェース定義
//
// 設計方針:
// - Domain型は lib/mock/entities.ts 等を正本に拡張 (organization_id 等を追加)
// - 画面側は本ファイルの型と Repository インターフェースのみを参照
// - 実装は mock/* と supabase/* で切替（lib/repository/index.ts 参照）
// - Server Components / Server Actions / Route Handler 内でのみ Repository を使用

import type {
  Company as MockCompany,
  Contact as MockContact,
  MeetingLog as MockMeetingLog,
  OnboardingTask as MockOnboardingTask
} from "@/lib/mock/entities";
import type { ContractOnboardingItem as MockContractOnboardingItem } from "@/lib/mock/onboarding";
import type {
  Contract as MockContract,
  ContractStatus,
  HealthScore
} from "@/lib/mock/contracts";
import type {
  WeeklyReview as MockWeeklyReview,
  WeeklyAction,
  WeeklyNextAction
} from "@/lib/mock/weekly";
import type { ProductCode } from "@/lib/mock/data";
import type {
  Stakeholder as MockStakeholder,
  AccountJourney,
  SuccessPlan,
  RenewalMilestone
} from "@/lib/mock/cycles";

// ─────────────────────────────────────────────
// テナント (organizations)
// ─────────────────────────────────────────────
export type Organization = {
  id: string;
  slug: string;
  name: string;
};

/** 既存 mock データ用デフォルト org（0001_init.sql の seed と一致） */
export const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

// ─────────────────────────────────────────────
// マルチテナント拡張: mock型に organization_id を加えた app-level 型
// ─────────────────────────────────────────────
export type Company = MockCompany & { organizationId: string };
export type Contact = MockContact & { organizationId: string };
export type Stakeholder = MockStakeholder & { organizationId: string };
export type Contract = MockContract & { organizationId: string };
export type MeetingLog = MockMeetingLog & { organizationId: string };
export type OnboardingTask = MockOnboardingTask & { organizationId: string };
export type WeeklyReview = MockWeeklyReview & { organizationId: string };
export type ContractOnboardingItem = MockContractOnboardingItem & { organizationId: string };

// 拡張不要な型は素通し
export type {
  ContractStatus,
  HealthScore,
  WeeklyAction,
  WeeklyNextAction,
  ProductCode,
  AccountJourney,
  SuccessPlan,
  RenewalMilestone
};

// ─────────────────────────────────────────────
// 追加Domain型（mock非依存）
// ─────────────────────────────────────────────

export type AppUserRole = "admin" | "manager" | "member" | "viewer";

export type AppUser = {
  id: string;
  organizationId: string;
  authUserId?: string;
  email: string;
  name: string;
  pictureUrl?: string;
  role: AppUserRole;
  isActive: boolean;
  disabledAt?: string;
  lastLoginAt?: string;
  /** lib/security/session.touchLastSeen() で更新される最終リクエスト時刻 */
  lastSeenAt?: string;
  createdAt: string;
};

/**
 * Assignment ロール
 * - primary    : CS 主担当 (1社1人、partial unique で担保)
 * - secondary  : CS 副担当
 * - observer   : 閲覧専用 (情報共有目的)
 * - sales_owner: 営業担当 (引き継ぎ後の営業オーナー、1社1人推奨)
 */
export type AssignmentRole = "primary" | "secondary" | "observer" | "sales_owner";

export type Assignment = {
  id: string;
  organizationId: string;
  companyId: string;
  userId: string;
  role: AssignmentRole;
  assignedAt: string;
  assignedBy?: string;
  unassignedAt?: string;
  note?: string;
};

export type OneOnOneLog = {
  id: string;
  organizationId: string;
  managerUserId: string;
  memberUserId: string;
  occurredAt: string;
  durationMin?: number;
  topic?: string;
  summary?: string;
  good?: string;
  more?: string;
  nextAction?: string;
  isPrivate: boolean;
  authorUserId?: string;
  createdAt: string;
  updatedAt: string;
};

export type HealthSnapshot = {
  organizationId: string;
  contractId: string;
  asOf: string; // YYYY-MM-DD
  score: number; // 0..100
  color: "green" | "yellow" | "red";
  factors: {
    attendance?: number;
    overdueOnboardingTasks?: number;
    weeksSinceLastTouch?: number;
    negativeSignalCount?: number;
  };
  computedAt: string;
};

/**
 * KPI 日次スナップショット (kpi_snapshots テーブル / 0005_kpi_snapshots.sql)
 * 日次バッチが lib/domain/kpi の純関数群を呼んで upsert する。
 * /reports と app/page.tsx は本テーブルから SELECT して描画。
 */
export type KpiSnapshot = {
  organizationId: string;
  asOf: string; // YYYY-MM-DD
  totalMrr: number;
  totalArr: number;
  activeContractCount: number;
  activeCompanyCount: number;
  churnRate30d?: number;  // 0..1
  churnRate90d?: number;
  nrr30d?: number;        // 1.0 = 100%
  nrr90d?: number;
  atRiskMrr?: number;
  byProduct: Record<string, number>;  // product_code → mrr
  bySegment: Record<string, number>;  // industry/segment → mrr
  computedAt: string;
};

export type KpiSnapshotFilter = {
  organizationId?: string;
  fromAsOf?: string;
  toAsOf?: string;
  limit?: number;
};

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "export"
  | "read_sensitive"
  | "consent_grant"
  | "consent_revoke"
  | "role_change"
  | "disable_user"
  | "enable_user";

export type AuditLog = {
  id: string;
  organizationId?: string;
  actorUserId?: string;
  actorEmail?: string;
  actorRole?: string;
  action: AuditAction;
  targetTable: string;
  targetId?: string;
  beforeData?: unknown;
  afterData?: unknown;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string; // 監査ログは created_at を時刻列とする (ストリーム04指定)
};

export type Draft = {
  id: string;
  organizationId: string;
  ownerUserId: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  updatedAt: string;
};

// ─────────────────────────────────────────────
// 共通フィルタ型
// ─────────────────────────────────────────────
export type CompanyFilter = {
  organizationId?: string;
  ownerUserId?: string;
  industry?: string;
  search?: string;
};

export type ContractFilter = {
  organizationId?: string;
  companyId?: string;
  product?: ProductCode;
  status?: ContractStatus | ContractStatus[];
  ownerUserId?: string;
  activeOnly?: boolean;
};

export type WeeklyReviewFilter = {
  organizationId?: string;
  companyId?: string;
  product?: ProductCode;
  weekStart?: string;
  weekStartFrom?: string;
  weekStartTo?: string;
};

export type AuditLogFilter = {
  organizationId?: string;
  actorUserId?: string;
  targetTable?: string;
  targetId?: string;
  action?: AuditAction;
  fromCreatedAt?: string;
  toCreatedAt?: string;
  limit?: number;
};

export type AssignmentFilter = {
  organizationId?: string;
  companyId?: string;
  userId?: string;
  role?: AssignmentRole;
  activeOnly?: boolean; // unassigned_at IS NULL
};

export type OneOnOneFilter = {
  organizationId?: string;
  managerUserId?: string;
  memberUserId?: string;
  fromOccurredAt?: string;
  toOccurredAt?: string;
};

// ─────────────────────────────────────────────
// Repository インターフェース
// ─────────────────────────────────────────────

/** organizationId は repo 側で DEFAULT_ORG_ID をフォールバック注入する */
export type CompanyCreateInput = Omit<Company, "id" | "organizationId"> & {
  organizationId?: string;
};

export interface CompanyRepo {
  list(filter?: CompanyFilter): Promise<Company[]>;
  getById(id: string): Promise<Company | null>;
  create(input: CompanyCreateInput): Promise<Company>;
  update(id: string, patch: Partial<Omit<Company, "id">>): Promise<Company>;
  delete(id: string): Promise<void>;
}

export type ContractCreateInput = Omit<Contract, "id" | "organizationId"> & {
  organizationId?: string;
};

export interface ContractRepo {
  list(filter?: ContractFilter): Promise<Contract[]>;
  getById(id: string): Promise<Contract | null>;
  listByCompany(companyId: string, opts?: { activeOnly?: boolean }): Promise<Contract[]>;
  create(input: ContractCreateInput): Promise<Contract>;
  update(id: string, patch: Partial<Omit<Contract, "id">>): Promise<Contract>;
}

export type WeeklyReviewUpsert = Omit<
  WeeklyReview,
  "id" | "weekLabel" | "weekEnd" | "updatedAt" | "organizationId"
> & {
  id?: string;
  organizationId?: string;
};

export interface WeeklyReviewRepo {
  list(filter?: WeeklyReviewFilter): Promise<WeeklyReview[]>;
  getById(id: string): Promise<WeeklyReview | null>;
  getByKey(companyId: string, product: ProductCode, weekStart: string): Promise<WeeklyReview | null>;
  upsert(input: WeeklyReviewUpsert): Promise<WeeklyReview>;
  setLocked(id: string, locked: boolean): Promise<void>;
}

export interface UserRepo {
  list(opts?: { organizationId?: string; activeOnly?: boolean }): Promise<AppUser[]>;
  getById(id: string): Promise<AppUser | null>;
  getByEmail(email: string): Promise<AppUser | null>;
  /** 現在のセッションユーザ。Server Components / Route Handler 内で使用 */
  getCurrent(): Promise<AppUser | null>;
  setRole(id: string, role: AppUserRole): Promise<void>;
  setActive(id: string, isActive: boolean): Promise<void>;
}

export interface HealthSnapshotRepo {
  listByContract(contractId: string, opts?: { from?: string; to?: string }): Promise<HealthSnapshot[]>;
  latestAll(opts?: { organizationId?: string; asOf?: string }): Promise<HealthSnapshot[]>;
  upsert(snap: HealthSnapshot): Promise<void>;
}

export interface KpiSnapshotRepo {
  /** 期間を指定して日次スナップショットを取得 (asOf 古い順) */
  list(filter?: KpiSnapshotFilter): Promise<KpiSnapshot[]>;
  /** 直近の1件を取得 (= app/page.tsx のサマリー) */
  latest(opts?: { organizationId?: string; asOf?: string }): Promise<KpiSnapshot | null>;
  /** 日次バッチ用 upsert (org + asOf 一意) */
  upsert(snap: KpiSnapshot): Promise<void>;
}

export interface AuditLogRepo {
  list(filter?: AuditLogFilter): Promise<AuditLog[]>;
  /**
   * 直接 append は Server 側専用 (service_role)。
   * 通常のフローは _base.ts の MutationHook (auditHook) 経由で記録される。
   */
  append(input: Omit<AuditLog, "id" | "createdAt"> & { createdAt?: string }): Promise<void>;
}

export interface DraftRepo {
  get(ownerUserId: string, entityType: string, entityId: string): Promise<Draft | null>;
  upsert(input: Omit<Draft, "id" | "updatedAt"> & { id?: string }): Promise<Draft>;
  delete(ownerUserId: string, entityType: string, entityId: string): Promise<void>;
  listByOwner(ownerUserId: string): Promise<Draft[]>;
}

export type AssignmentUpdatePatch = {
  role?: AssignmentRole;
  note?: string | null;
};

export interface AssignmentRepo {
  list(filter?: AssignmentFilter): Promise<Assignment[]>;
  listByCompany(companyId: string, opts?: { activeOnly?: boolean }): Promise<Assignment[]>;
  listByUser(userId: string, opts?: { activeOnly?: boolean }): Promise<Assignment[]>;
  assign(input: Omit<Assignment, "id" | "assignedAt" | "unassignedAt"> & {
    assignedAt?: string;
  }): Promise<Assignment>;
  /** role / note の変更。primary 昇格時は他の primary を unassign する */
  update(id: string, patch: AssignmentUpdatePatch): Promise<Assignment>;
  unassign(id: string, opts?: { unassignedAt?: string }): Promise<void>;
}

export interface OneOnOneLogRepo {
  list(filter?: OneOnOneFilter): Promise<OneOnOneLog[]>;
  getById(id: string): Promise<OneOnOneLog | null>;
  create(
    input: Omit<OneOnOneLog, "id" | "createdAt" | "updatedAt">
  ): Promise<OneOnOneLog>;
  update(
    id: string,
    patch: Partial<Omit<OneOnOneLog, "id" | "createdAt" | "updatedAt">>
  ): Promise<OneOnOneLog>;
  delete(id: string): Promise<void>;
}

// ─────────────────────────────────────────────
// 解約予兆シグナル (D項)
// ─────────────────────────────────────────────
export type ChurnSignalRule =
  | "score_drop"
  | "score_low_streak"
  | "consecutive_absence"
  | "milestone_overdue"
  | "usage_drop"
  | "survey_detractor";

export type ChurnSignalSeverity = "low" | "medium" | "high";

export type ChurnSignalRecord = {
  id: string;
  organizationId: string;
  contractId: string;
  companyId: string;
  product: ProductCode;
  rule: ChurnSignalRule;
  severity: ChurnSignalSeverity;
  weight: number;
  reason: string;
  evidence: Record<string, unknown>;
  detectedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
  notifiedAt?: string; // Slack通知済みのタイムスタンプ (重複防止)
};

export type ChurnSignalFilter = {
  organizationId?: string;
  contractId?: string;
  companyId?: string;
  rule?: ChurnSignalRule;
  severity?: ChurnSignalSeverity;
  resolvedOnly?: boolean;
  unresolvedOnly?: boolean;
  unNotifiedOnly?: boolean;
};

export type ChurnSignalUpsertInput = Omit<ChurnSignalRecord, "id" | "resolvedAt" | "resolvedBy" | "resolutionNote" | "notifiedAt"> & {
  id?: string;
};

export interface ChurnSignalRepo {
  list(filter?: ChurnSignalFilter): Promise<ChurnSignalRecord[]>;
  listByContract(contractId: string, opts?: { unresolvedOnly?: boolean }): Promise<ChurnSignalRecord[]>;
  upsert(input: ChurnSignalUpsertInput): Promise<ChurnSignalRecord>;
  resolve(id: string, opts: { resolvedBy?: string; note?: string; resolvedAt?: string }): Promise<void>;
  markNotified(id: string, notifiedAt?: string): Promise<void>;
}

// ─────────────────────────────────────────────
// N+1 走査対応 Repo (申し送り l〜q)
// companies/[id]/page.tsx などで Promise.all 並列取得を可能にするため、
// 子テーブル単位で listByCompany / listByContractIds を提供する。
// 受け側は配列を contractId / companyId で `.filter()` して使う。
// ─────────────────────────────────────────────

export type MeetingLogListOpts = {
  /** "date desc" 等。指定なし = 取得順保持 */
  sort?: string;
  limit?: number;
};

export interface ContactRepo {
  listByCompany(companyId: string): Promise<Contact[]>;
}

export interface MeetingLogRepo {
  listByCompany(companyId: string, opts?: MeetingLogListOpts): Promise<MeetingLog[]>;
}

export interface StakeholderRepo {
  listByCompany(companyId: string): Promise<Stakeholder[]>;
}

export interface AccountJourneyRepo {
  listByCompany(companyId: string): Promise<AccountJourney[]>;
}

export interface OnboardingItemRepo {
  /** 指定された複数 contractId に紐づくオンボ項目を一括取得 */
  listByContractIds(contractIds: string[]): Promise<ContractOnboardingItem[]>;
}

export interface SuccessPlanRepo {
  /** 指定された複数 contractId に紐づく Success Plan を一括取得 */
  listByContractIds(contractIds: string[]): Promise<SuccessPlan[]>;
}

// ─────────────────────────────────────────────
// エクスパンション機会 (F項)
// ─────────────────────────────────────────────
export type ExpansionKind =
  | "upsell_higher_plan"
  | "cross_sell_other_product"
  | "seat_expansion"
  | "renewal_uplift";

export type ExpansionRule =
  | "healthy_streak"
  | "survey_signal"
  | "seat_at_capacity"
  | "champion_promoted"
  | "renewal_window_green";

export type ExpansionOpportunityRecord = {
  id: string;
  organizationId: string;
  contractId: string;
  companyId: string;
  product: ProductCode;
  kind: ExpansionKind;
  rule: ExpansionRule;
  score: number;
  reason: string;
  evidence: Record<string, unknown>;
  suggestedAction: string;
  estimatedUpsellJpy?: number;
  detectedAt: string;
  /** 営業引き継ぎ済みなら handed_off_at が立つ */
  handedOffAt?: string;
  handedOffTo?: string;
  handedOffNote?: string;
  closedAt?: string;
  closedReason?: "won" | "lost" | "deferred" | "duplicate";
  notifiedAt?: string;
};

export type ExpansionOpportunityFilter = {
  organizationId?: string;
  contractId?: string;
  companyId?: string;
  kind?: ExpansionKind;
  rule?: ExpansionRule;
  openOnly?: boolean; // closedAt が null
  unNotifiedOnly?: boolean;
  minScore?: number;
};

export type ExpansionOpportunityUpsertInput = Omit<
  ExpansionOpportunityRecord,
  "id" | "handedOffAt" | "handedOffTo" | "handedOffNote" | "closedAt" | "closedReason" | "notifiedAt"
> & { id?: string };

export interface ExpansionOpportunityRepo {
  list(filter?: ExpansionOpportunityFilter): Promise<ExpansionOpportunityRecord[]>;
  listByContract(contractId: string, opts?: { openOnly?: boolean }): Promise<ExpansionOpportunityRecord[]>;
  upsert(input: ExpansionOpportunityUpsertInput): Promise<ExpansionOpportunityRecord>;
  handOff(
    id: string,
    opts: { handedOffTo: string; note?: string; handedOffAt?: string }
  ): Promise<void>;
  close(
    id: string,
    opts: { reason: "won" | "lost" | "deferred" | "duplicate"; closedAt?: string }
  ): Promise<void>;
  markNotified(id: string, notifiedAt?: string): Promise<void>;
}

// ─────────────────────────────────────────────
// VOC (Voice of Customer) 要望管理 (H項)
// ─────────────────────────────────────────────
export type VocSourceType = "survey_response" | "meeting_log" | "weekly_review";
export type VocStatus = "new" | "triaged" | "backlog" | "shipped" | "wontfix";
export type VocPriority = "low" | "med" | "high";

export type VocItemRecord = {
  id: string;
  organizationId: string;
  sourceType: VocSourceType;
  sourceId: string;
  contractId?: string;
  companyId?: string;
  excerpt: string;
  tags: string[];
  status: VocStatus;
  priority: VocPriority;
  linkedPrUrl?: string;
  assignedTo?: string; // app_users.id
  createdBy?: string;
  triagedBy?: string;
  triagedAt?: string;
  shippedAt?: string;
  customerNotifiedAt?: string;
  notifiedAt?: string; // Slack通知済 (重複防止)
  comments: VocComment[];
  createdAt: string;
  updatedAt: string;
};

export type VocComment = {
  id: string;
  authorUserId: string;
  body: string;
  createdAt: string;
};

export type VocItemFilter = {
  organizationId?: string;
  status?: VocStatus | VocStatus[];
  priority?: VocPriority;
  tag?: string;
  contractId?: string;
  companyId?: string;
  unNotifiedOnly?: boolean;
};

export type VocItemCreateInput = Omit<
  VocItemRecord,
  "id" | "createdAt" | "updatedAt" | "comments" | "triagedBy" | "triagedAt" | "shippedAt" | "customerNotifiedAt" | "notifiedAt" | "assignedTo" | "linkedPrUrl"
> & { id?: string };

export interface VocItemRepo {
  list(filter?: VocItemFilter): Promise<VocItemRecord[]>;
  getById(id: string): Promise<VocItemRecord | null>;
  create(input: VocItemCreateInput): Promise<VocItemRecord>;
  setStatus(
    id: string,
    opts: {
      status: VocStatus;
      actorUserId?: string;
      shippedAt?: string;
      customerNotifiedAt?: string;
    }
  ): Promise<VocItemRecord>;
  setPriority(id: string, priority: VocPriority): Promise<VocItemRecord>;
  setLinkedPrUrl(id: string, url: string | undefined): Promise<VocItemRecord>;
  setAssignedTo(id: string, userId: string | undefined): Promise<VocItemRecord>;
  appendComment(id: string, comment: Omit<VocComment, "id" | "createdAt">): Promise<VocItemRecord>;
  markNotified(id: string, notifiedAt?: string): Promise<void>;
}

// ─────────────────────────────────────────────
// 更新マイルストン (G項)
// 自動done を廃止し、CS担当者の明示完了 + 証跡で管理する
// ─────────────────────────────────────────────
export interface RenewalMilestoneRepo {
  listByContract(contractId: string): Promise<RenewalMilestone[]>;
  /** 担当者が明示完了マーク。証跡 (note または attachmentUrl) のいずれかが必須 */
  markDone(
    id: string,
    opts: {
      completedBy: string;
      evidence: { note?: string; attachmentUrl?: string };
      completedAt?: string;
    }
  ): Promise<RenewalMilestone>;
  /** スキップ。reason が必須 */
  markSkipped(
    id: string,
    opts: { reason: string; skippedAt?: string; skippedBy?: string }
  ): Promise<RenewalMilestone>;
  /** 「対応中」へ遷移 (任意操作) */
  markInProgress(id: string): Promise<RenewalMilestone>;
}

// ─────────────────────────────────────────────
// Repository集約
// ─────────────────────────────────────────────
export interface Repository {
  companies: CompanyRepo;
  contracts: ContractRepo;
  weeklyReviews: WeeklyReviewRepo;
  users: UserRepo;
  healthSnapshots: HealthSnapshotRepo;
  kpiSnapshots: KpiSnapshotRepo;
  auditLogs: AuditLogRepo;
  drafts: DraftRepo;
  assignments: AssignmentRepo;
  oneOnOneLogs: OneOnOneLogRepo;
  churnSignals: ChurnSignalRepo;
  expansionOpportunities: ExpansionOpportunityRepo;
  renewalMilestones: RenewalMilestoneRepo;
  vocItems: VocItemRepo;
  // 申し送り l〜q
  contacts: ContactRepo;
  meetingLogs: MeetingLogRepo;
  stakeholders: StakeholderRepo;
  accountJourneys: AccountJourneyRepo;
  onboardingItems: OnboardingItemRepo;
  successPlans: SuccessPlanRepo;
}
