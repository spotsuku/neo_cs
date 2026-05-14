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
  SuccessPlan
} from "@/lib/mock/cycles";
import type {
  JourneyType,
  JourneyStageDefinition as MockJourneyStageDefinition,
  CompanyJourney as MockCompanyJourney,
  BusinessJourney as MockBusinessJourney,
  JourneyEvent as MockJourneyEvent,
  JourneyCheckpointStatus as MockJourneyCheckpointStatus,
  ContractLifecycleSnapshot as MockContractLifecycleSnapshot,
  BusinessLifecycleState as MockBusinessLifecycleState
} from "@/lib/mock/journeys";
import type {
  Participant as MockParticipant,
  Session as MockSession,
  AttendanceRecord as MockAttendanceRecord
} from "@/lib/mock/participants";
import type {
  Survey as MockSurvey,
  SurveyResponse as MockSurveyResponse,
  SurveySchedule as MockSurveySchedule
} from "@/lib/mock/surveys";

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
export type Company = MockCompany & {
  organizationId: string;
  /** 本番運用前のダミーデータかどうか (0019_is_demo_flag.sql) */
  isDemo?: boolean;
  /** companies.created_at (ISO8601) — デモデータ管理ページの期間フィルタで参照 */
  createdAt?: string;
};
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
  JourneyType
};

// Journey 系: organizationId 必須化
export type JourneyStageDefinition = MockJourneyStageDefinition;
export type CompanyJourney = MockCompanyJourney;
export type BusinessJourney = MockBusinessJourney;
export type JourneyEvent = MockJourneyEvent;
export type JourneyCheckpointStatus = MockJourneyCheckpointStatus;
export type ContractLifecycleSnapshot = MockContractLifecycleSnapshot;
export type BusinessLifecycleState = MockBusinessLifecycleState;

// ─────────────────────────────────────────────
// 追加Domain型（mock非依存）
// ─────────────────────────────────────────────

/**
 * グローバルロール
 * - admin    : NEO 全体の編集権限。ユーザー追加削除・全社共通マスタの変更が可能
 * - manager  : 担当事業内の全体把握・横断分析。マネージャー専用画面が見える
 * - member   : 担当事業内の実務担当
 * - viewer   : （旧）閲覧専用。後方互換のため残置
 * - external : 外部ユーザー。user_company_access に登録された企業のみ閲覧/進捗編集可
 */
export type AppUserRole = "admin" | "manager" | "member" | "viewer" | "external";

/**
 * 事業（program / productCode）スコープ内でのロール
 * - viewer          : 閲覧のみ
 * - editor          : 進捗更新・週次入力など項目編集
 * - template_editor : 列名・テンプレート編集まで可
 */
export type ProgramScopeRole = "viewer" | "editor" | "template_editor";

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
 * ユーザーが担当する事業（productCode）とそのスコープ内ロール
 * admin は全事業に暗黙アクセスするため、このテーブルにレコードを持たなくてよい
 */
export type UserProgramRole = {
  userId: string;
  organizationId: string;
  productCode: string;
  scopeRole: ProgramScopeRole;
  assignedAt: string;
  assignedBy?: string;
};

/**
 * external ユーザーが閲覧可能な企業
 * external 以外のロールでは参照されない
 */
export type UserCompanyAccess = {
  userId: string;
  organizationId: string;
  companyId: string;
  grantedAt: string;
  grantedBy?: string;
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
  | "enable_user"
  | "demo_wipe"
  | "impersonate_start"
  | "impersonate_stop";

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
  /** true: is_demo=true のみ / false: is_demo=false のみ / undefined: 制約なし */
  isDemo?: boolean;
};

export type DemoWipeRange = "24h" | "7d" | "all";

export type DemoWipeResult = {
  /** 削除した companies の件数 (CASCADE で関連も削除される) */
  deletedCompanies: number;
  /** 削除対象の company_id 一覧 (audit ログ用) */
  deletedIds: string[];
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
  /**
   * カルテ No. を変更。同一 organization_id 内で重複不可
   * 重複時は code="KARUTE_NO_CONFLICT" のエラーをthrow
   */
  setKaruteNo(id: string, newNo: number): Promise<Company>;
  delete(id: string): Promise<void>;
  /** Phase4-#5: Google Drive 自動連携で生成したフォルダIDとURLを保存 */
  setDriveFolder(
    id: string,
    drive: { folderId: string; folderUrl: string }
  ): Promise<void>;
  /** is_demo=true な企業を抽出。range で createdAt フィルタを掛ける */
  listDemo(opts?: {
    organizationId?: string;
    range?: DemoWipeRange;
  }): Promise<Company[]>;
  /** is_demo=true 件数を高速カウント (UI 表示用) */
  countDemo(opts?: { organizationId?: string }): Promise<number>;
  /** is_demo=true な企業 (とCASCADE関連) を一括削除し audit_logs に記録 */
  wipeDemoData(opts: {
    range?: DemoWipeRange;
    organizationId?: string;
    actorUserId?: string;
    actorEmail?: string;
  }): Promise<DemoWipeResult>;
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

export type UserCreateInput = {
  email: string;
  name: string;
  role: AppUserRole;
  organizationId?: string;
};

export interface UserRepo {
  list(opts?: { organizationId?: string; activeOnly?: boolean }): Promise<AppUser[]>;
  getById(id: string): Promise<AppUser | null>;
  getByEmail(email: string): Promise<AppUser | null>;
  /** 現在のセッションユーザ。Server Components / Route Handler 内で使用 */
  getCurrent(): Promise<AppUser | null>;
  /**
   * 事前登録された app_users 行を作成する (auth_user_id は null)。
   * Google 認証で同じ email でログインしたとき、middleware / getCurrent が
   * auth_user_id を後付けリンクして「同じユーザー」として扱う。
   */
  create(input: UserCreateInput): Promise<AppUser>;
  setRole(id: string, role: AppUserRole): Promise<void>;
  setActive(id: string, isActive: boolean): Promise<void>;
}

export interface UserProgramRoleRepo {
  /** ユーザー単位で担当事業 + スコープロールを取得 */
  listByUser(userId: string): Promise<UserProgramRole[]>;
  /** 事業単位で担当ユーザーを取得 */
  listByProduct(productCode: string, opts?: { organizationId?: string }): Promise<UserProgramRole[]>;
  /** 全件（管理画面用） */
  list(opts?: { organizationId?: string }): Promise<UserProgramRole[]>;
  /** スコープロールを upsert（同一 userId×productCode は上書き） */
  upsert(input: Omit<UserProgramRole, "assignedAt"> & { assignedAt?: string }): Promise<UserProgramRole>;
  remove(userId: string, productCode: string): Promise<void>;
}

export interface UserCompanyAccessRepo {
  listByUser(userId: string): Promise<UserCompanyAccess[]>;
  listByCompany(companyId: string): Promise<UserCompanyAccess[]>;
  grant(input: Omit<UserCompanyAccess, "grantedAt"> & { grantedAt?: string }): Promise<UserCompanyAccess>;
  revoke(userId: string, companyId: string): Promise<void>;
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
// 解約レコード (churn_events / churn_event_reasons)
// マイグレーション: supabase/migrations/0001_init.sql (526行付近)
// ChurnSignalRecord (解約予兆) とは別物 — こちらは「実際の解約」を記録する
// ─────────────────────────────────────────────
import type { ChurnRecord as MockChurnRecord, ChurnReasonCategory } from "@/lib/mock/churn";

export type { ChurnReasonCategory };
export type ChurnRecord = MockChurnRecord;

/** 解約決定時に呼び出される upsert 入力 (contractId 単位で一意) */
export type ChurnRecordUpsertInput = {
  contractId: string;
  organizationId?: string;
  churnedAt: string;
  reasonCategory: ChurnReasonCategory;
  reasonNote?: string;
  nextActionDate?: string;
  nextActionNote?: string;
  notified?: boolean;
  /**
   * TODO: DB schema (churn_events) に verifiedByCustomer / verifiedAt /
   * verificationNote 列が無いため、現状は無視される。
   * 将来 migration で列追加するか、jsonb 列に格納するかを別途検討。
   */
  verifiedByCustomer?: boolean;
  verifiedAt?: string;
  verificationNote?: string;
};

export interface ChurnRecordRepo {
  listByCompany(companyId: string): Promise<ChurnRecord[]>;
  getByContract(contractId: string): Promise<ChurnRecord | null>;
  /** 解約決定時に呼び出される (contractId で upsert) */
  upsert(input: ChurnRecordUpsertInput): Promise<ChurnRecord>;
  /** 顧客に確認した内容を更新
   *  TODO: 現状 DB 列が無いため値は永続化されず、in-memory レイヤでのみ反映される
   */
  setVerification(
    contractId: string,
    input: { verificationNote?: string; verifiedAt?: string }
  ): Promise<ChurnRecord>;
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

export type ContactCreateInput = Omit<Contact, "id" | "organizationId"> & {
  organizationId?: string;
};

export interface ContactRepo {
  listByCompany(companyId: string): Promise<Contact[]>;
  create(input: ContactCreateInput): Promise<Contact>;
}

export type MeetingLogCreateInput = Omit<MeetingLog, "id" | "organizationId"> & {
  organizationId?: string;
};

export interface MeetingLogRepo {
  listByCompany(companyId: string, opts?: MeetingLogListOpts): Promise<MeetingLog[]>;
  create(input: MeetingLogCreateInput): Promise<MeetingLog>;
}

export type EngagementTierValue = "core" | "active" | "casual" | "at_risk";

export type SetEngagementTierInput = {
  tier: EngagementTierValue | null;
  note?: string;
  actorUserId?: string;
};

export interface StakeholderRepo {
  listByCompany(companyId: string): Promise<Stakeholder[]>;
  list(filter?: { organizationId?: string }): Promise<Stakeholder[]>;
  setEngagementTier(id: string, input: SetEngagementTierInput): Promise<Stakeholder>;
}

export interface AccountJourneyRepo {
  listByCompany(companyId: string): Promise<AccountJourney[]>;
}

export type OnboardingItemEditableStatus =
  | "todo"
  | "doing"
  | "done"
  | "not_applicable";

export type OnboardingItemPatch = {
  status?: OnboardingItemEditableStatus;
  dueDate?: string | null;
  assignee?: string | null;
  note?: string | null;
};

export interface OnboardingItemRepo {
  /** 指定された複数 contractId に紐づくオンボ項目を一括取得 */
  listByContractIds(contractIds: string[]): Promise<ContractOnboardingItem[]>;
  /** 単一項目を更新 (status / dueDate / assignee / note) */
  update(id: string, patch: OnboardingItemPatch): Promise<ContractOnboardingItem>;
  /** 新規契約のチェックリストなどを一括投入 */
  createBatch(items: ContractOnboardingItem[]): Promise<ContractOnboardingItem[]>;
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
export type VocStatus = "open" | "in_progress" | "done" | "wontfix";
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
  setTags(id: string, tags: string[]): Promise<VocItemRecord>;
  setLinkedPrUrl(id: string, url: string | undefined): Promise<VocItemRecord>;
  setAssignedTo(id: string, userId: string | undefined): Promise<VocItemRecord>;
  appendComment(id: string, comment: Omit<VocComment, "id" | "createdAt">): Promise<VocItemRecord>;
  markNotified(id: string, notifiedAt?: string): Promise<void>;
}

// 旧 RenewalMilestone は廃止 (事業ジャーニー × 事業別ToDo に統合)
// 期日付きの更新タスクは program_company_tasks へ、
// ステージ進捗は journey_stage_definitions.checkpoints + journey_checkpoint_status へ移行

// ─────────────────────────────────────────────
// プロダクトコース (product_courses)
// 研修プロダクト配下の「コース区分」マスタ。1プロダクト=複数コース、
// 契約 (contracts.course_key) と FK で紐付く。code (course_key) 変更時は
// 既存契約の影響を呼び出し側で警告表示する。
// ─────────────────────────────────────────────
export type ProductCourse = {
  productCode: string;
  courseKey: string;
  name: string;
  shortName?: string;
  description?: string;
  displayOrder: number;
};

export type ProductCourseUpsertInput = {
  productCode: string;
  /** 既存レコード変更時の旧 course_key (rename 検出用)。未指定なら courseKey と同一 */
  previousCourseKey?: string;
  courseKey: string;
  name: string;
  shortName?: string | null;
  description?: string | null;
  displayOrder?: number;
};

export type ProductCourseDeleteResult = {
  affectedContracts: number;
};

export interface ProductCourseRepo {
  listByProduct(productCode: string): Promise<ProductCourse[]>;
  /** 同一 product_code 配下の既存契約数（course_key 一致）。code 変更前の影響範囲表示に使用 */
  countContractsByCourse(productCode: string, courseKey: string): Promise<number>;
  upsert(input: ProductCourseUpsertInput): Promise<ProductCourse>;
  delete(productCode: string, courseKey: string): Promise<ProductCourseDeleteResult>;
}

// ─────────────────────────────────────────────
// 業務 ToDo (company_tasks) — オンボとは別の汎用タスク
// マイグレーション: supabase/migrations/0014_company_tasks.sql
// 純関数群: lib/domain/task.ts
// ─────────────────────────────────────────────
import type {
  CompanyTaskCategory,
  CompanyTaskPriority,
  CompanyTaskStatus
} from "@/lib/domain/task";

export type { CompanyTaskCategory, CompanyTaskPriority, CompanyTaskStatus };

export type CompanyTask = {
  id: string;
  organizationId: string;
  companyId: string;
  contractId?: string;
  title: string;
  description?: string;
  category?: CompanyTaskCategory;
  status: CompanyTaskStatus;
  priority: CompanyTaskPriority;
  dueDate?: string; // YYYY-MM-DD
  notifyAt?: string; // 将来通知連携用 (本実装では未使用)
  assignedTo?: string;
  createdBy?: string;
  completedAt?: string;
  completedBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type CompanyTaskFilter = {
  organizationId?: string;
  companyId?: string;
  contractId?: string;
  assignedTo?: string;
  status?: CompanyTaskStatus | CompanyTaskStatus[];
  priority?: CompanyTaskPriority;
  /** YYYY-MM-DD 以下の dueDate を抽出 (未完了のみ対象) */
  dueOnOrBefore?: string;
  /** true: due_date IS NOT NULL かつ < today */
  overdueOnly?: boolean;
  /** true: status in ('pending','in_progress') */
  openOnly?: boolean;
};

export type CompanyTaskCreateInput = Omit<
  CompanyTask,
  "id" | "createdAt" | "updatedAt" | "organizationId" | "status" | "completedAt" | "completedBy"
> & {
  id?: string;
  organizationId?: string;
  status?: CompanyTaskStatus;
};

export type CompanyTaskUpdatePatch = Partial<
  Omit<CompanyTask, "id" | "organizationId" | "createdAt" | "updatedAt" | "createdBy">
>;

export interface CompanyTaskRepo {
  list(filter?: CompanyTaskFilter): Promise<CompanyTask[]>;
  getById(id: string): Promise<CompanyTask | null>;
  create(input: CompanyTaskCreateInput): Promise<CompanyTask>;
  update(id: string, patch: CompanyTaskUpdatePatch): Promise<CompanyTask>;
  markDone(id: string, opts: { completedBy?: string; completedAt?: string }): Promise<CompanyTask>;
  markSkipped(id: string, opts?: { actorUserId?: string }): Promise<CompanyTask>;
  markCancelled(id: string, opts?: { actorUserId?: string }): Promise<CompanyTask>;
}

// ─────────────────────────────────────────────
// 事業内ToDo (program_terms / program_task_templates / program_company_tasks)
// マイグレーション: supabase/migrations/0020_program_tasks.sql
// 純関数群: lib/domain/program.ts
// ─────────────────────────────────────────────
import type {
  ProgramCellStatus,
  ProgramTaskCategory,
  ProgramTermStatus
} from "@/lib/domain/program";

export type { ProgramCellStatus, ProgramTaskCategory, ProgramTermStatus };

export type ProgramTerm = {
  id: string;
  organizationId: string;
  productCode: string;
  courseKey?: string | null;
  cycleNo?: number | null;
  label: string;
  startedAt?: string;
  closedAt?: string;
  status: ProgramTermStatus;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProgramTaskTemplate = {
  id: string;
  programTermId: string;
  orderNo: number;
  label: string;
  description?: string;
  category?: ProgramTaskCategory;
  defaultDueOffsetDays?: number;
  /** 列単位の期日 (set されている場合、open セルにも一括反映) */
  defaultDueDate?: string;
  /** 列単位の既定担当 (set されている場合、open セルにも一括反映) */
  defaultAssigneeTo?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProgramCompanyTask = {
  id: string;
  organizationId: string;
  programTermId: string;
  templateId: string;
  companyId: string;
  contractId?: string;
  status: ProgramCellStatus;
  dueDate?: string;
  assignedTo?: string;
  note?: string;
  completedAt?: string;
  completedBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProgramTermCreateInput = {
  productCode: string;
  courseKey?: string | null;
  cycleNo?: number | null;
  label: string;
  startedAt?: string;
  closedAt?: string;
  status?: ProgramTermStatus;
  createdBy?: string;
};

export type ProgramTaskTemplateInput = {
  programTermId: string;
  orderNo: number;
  label: string;
  description?: string;
  category?: ProgramTaskCategory;
  defaultDueOffsetDays?: number;
};

export type ProgramCellPatch = {
  status?: ProgramCellStatus;
  dueDate?: string | null;
  assignedTo?: string | null;
  note?: string | null;
};

export interface ProgramRepo {
  listTerms(filter?: { status?: ProgramTermStatus | ProgramTermStatus[] }): Promise<ProgramTerm[]>;
  getTerm(id: string): Promise<ProgramTerm | null>;
  createTerm(input: ProgramTermCreateInput): Promise<ProgramTerm>;
  closeTerm(id: string): Promise<ProgramTerm>;
  /** 期の基本情報 (label / startedAt / closedAt / status) を更新 */
  updateTerm(
    id: string,
    patch: Partial<Pick<ProgramTerm, "label" | "startedAt" | "closedAt" | "status">>
  ): Promise<ProgramTerm>;
  /** 期を完全削除する (テンプレ・セル・関連データもまとめて消える) */
  deleteTerm(id: string): Promise<void>;

  listTemplates(programTermId: string): Promise<ProgramTaskTemplate[]>;
  upsertTemplate(input: ProgramTaskTemplateInput & { id?: string }): Promise<ProgramTaskTemplate>;
  deleteTemplate(id: string): Promise<void>;
  /** 列の期日を設定し、open セル (pending/in_progress) にも一括反映する */
  setTemplateDueDate(templateId: string, dueDate: string | null): Promise<ProgramTaskTemplate>;
  /** 列の既定担当 (= 列の責任者) を設定する。propagate=true の時のみ open セルへ反映 */
  setTemplateAssignee(
    templateId: string,
    userId: string | null,
    opts?: { propagate?: boolean }
  ): Promise<ProgramTaskTemplate>;
  /** テンプレ全体 (label / description / order_no / category 等) を編集 */
  updateTemplateMeta(
    templateId: string,
    patch: Partial<Pick<ProgramTaskTemplateInput, "label" | "description" | "category" | "orderNo" | "defaultDueOffsetDays">>
  ): Promise<ProgramTaskTemplate>;

  /** term のスコープにマッチする契約中企業から、未生成の (template×company) セルを生成 */
  syncCompanies(programTermId: string): Promise<{ created: number }>;

  /** 別の term からテンプレ (列) を複製する。defaultDueDate は複製しない (期固有のため) */
  copyTemplates(fromTermId: string, toTermId: string): Promise<{ copied: number }>;

  listCells(programTermId: string): Promise<ProgramCompanyTask[]>;
  updateCell(id: string, patch: ProgramCellPatch): Promise<ProgramCompanyTask>;
}

// ─────────────────────────────────────────────
// 企業ジャーニー / 事業ジャーニー (Phase: account-journey-v2)
// ─────────────────────────────────────────────

export type JourneyStageUpsertInput = {
  organizationId?: string;
  journeyType: JourneyType;
  /** 既存編集時は元の stageKey (rename 対応)。未指定なら stageKey と同一 */
  previousStageKey?: string;
  stageKey: string;
  displayOrder: number;
  name: string;
  description: string;
  color?: string;
  keyActions?: string;
};

export type SetCompanyJourneyStageInput = {
  organizationId?: string;
  companyId: string;
  toStageKey: string;
  /** UI 側で「後退ですが本当に変更しますか?」確認後に true で渡す */
  acknowledgeRegression?: boolean;
  note?: string;
  changedBy?: string;
};

export type SetBusinessJourneyStageInput = {
  organizationId?: string;
  contractId: string;
  toStageKey: string;
  acknowledgeRegression?: boolean;
  note?: string;
  changedBy?: string;
};

export interface JourneyStageDefinitionRepo {
  list(opts: {
    organizationId?: string;
    journeyType: JourneyType;
  }): Promise<JourneyStageDefinition[]>;
  upsert(input: JourneyStageUpsertInput): Promise<JourneyStageDefinition>;
  delete(opts: {
    organizationId?: string;
    journeyType: JourneyType;
    stageKey: string;
  }): Promise<void>;
  /** 既定値で初期化 (組織新規作成時用) */
  resetToDefaults(opts: {
    organizationId?: string;
    journeyType: JourneyType;
  }): Promise<JourneyStageDefinition[]>;
}

export interface CompanyJourneyRepo {
  getByCompany(companyId: string): Promise<CompanyJourney | null>;
  list(opts?: { organizationId?: string }): Promise<CompanyJourney[]>;
  setStage(input: SetCompanyJourneyStageInput): Promise<CompanyJourney>;
  listEvents(companyId: string): Promise<JourneyEvent[]>;
}

export interface BusinessJourneyRepo {
  getByContract(contractId: string): Promise<BusinessJourney | null>;
  listByCompany(companyId: string): Promise<BusinessJourney[]>;
  listByContractIds(contractIds: string[]): Promise<BusinessJourney[]>;
  setStage(input: SetBusinessJourneyStageInput): Promise<BusinessJourney>;
  /** 解約軸 (lifecycleState) を更新する。stage は変えない */
  setLifecycleState(input: {
    contractId: string;
    state: import("@/lib/mock/journeys").BusinessLifecycleState;
    reason?: string;
    changedBy?: string;
  }): Promise<BusinessJourney>;
  listEvents(contractId: string): Promise<JourneyEvent[]>;
}

// ─────────────────────────────────────────────
// Repository集約
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// チャット (DM / 事業部 / メールスレッド統合)
// 0025_chat.sql の chat_channels / chat_messages / chat_channel_members に対応
// ─────────────────────────────────────────────
export type ChatChannelKind = "dm" | "program" | "email_thread";

export type ChatChannel = {
  id: string;
  organizationId: string;
  kind: ChatChannelKind;
  title: string;
  /** kind='program' の場合の事業コード */
  productCode?: ProductCode;
  /** kind='email_thread' の場合の参照先 email_threads.id */
  emailThreadId?: string;
  /** kind='dm' の場合の参加メンバー名（簡易: 名前文字列。Supabase 実装では user_id を解決） */
  members?: string[];
  lastMessageAt: string;
};

export type ChatMessage = {
  id: string;
  channelId: string;
  authorName: string;
  body: string;
  mentions: string[];
  createdAt: string;
};

export interface ChatRepo {
  /** 当該ユーザーが見えるチャンネル一覧（DM はメンバーのみ、program/email_thread は組織全員） */
  listChannels(opts: { organizationId: string; userName: string }): Promise<ChatChannel[]>;
  listMessages(channelId: string): Promise<ChatMessage[]>;
  postMessage(input: {
    channelId: string;
    authorName: string;
    body: string;
    mentions: string[];
  }): Promise<ChatMessage>;
  /** 2者間 DM を取得 or 作成 */
  ensureDm(input: {
    organizationId: string;
    userA: string;
    userB: string;
  }): Promise<ChatChannel>;
}

// ─────────────────────────────────────────────
// ジャーニーチェックポイント完了状態
// 0026_journey_checkpoint.sql の journey_checkpoint_status に対応
// ─────────────────────────────────────────────
export interface JourneyCheckpointRepo {
  list(opts: {
    organizationId: string;
    journeyType: JourneyType;
    subjectId: string;
  }): Promise<JourneyCheckpointStatus[]>;
  /** 1チェック項目の done/未done を切替。done=true 時は completedBy/At を記録 */
  setStatus(input: {
    organizationId: string;
    journeyType: JourneyType;
    subjectId: string;
    stageKey: string;
    checkpointKey: string;
    done: boolean;
    completedBy?: string;
    note?: string;
  }): Promise<JourneyCheckpointStatus>;
}

// ─────────────────────────────────────────────
// 契約ライフサイクル スナップショット
// 解約・更新成功・期満了で凍結。読み取りのみで改変なし
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// 企業ビジョン (NEO参画動機 / 中長期目標 / 今年度目標 / 活用方針)
// 企業単位の長文ナラティブ。CSの戦略整理・引継ぎに使う
// ─────────────────────────────────────────────
export type CompanyVision = {
  companyId: string;
  /** NEO参画動機 — なぜ NEO を導入したか */
  joinMotivation?: string;
  /** 中長期で NEO と実現したいこと (3〜5年スパン) */
  longTermGoal?: string;
  /** 今年度達成したいこと */
  thisYearGoal?: string;
  /** NEO活用方針 — 社内での位置付け・運用ルール */
  usagePolicy?: string;
  updatedAt: string;
  updatedBy?: string;
};

export type CompanyVisionUpsert = {
  companyId: string;
  joinMotivation?: string;
  longTermGoal?: string;
  thisYearGoal?: string;
  usagePolicy?: string;
  updatedBy?: string;
};

/**
 * 企業ビジョンの変更ログ
 * 「今年度ゴール」「活用方針」は年度更新で改訂され、「中長期ゴール」も
 * 変更が起きうる。upsert で値が変わったときに変更前の状態をここに保存する。
 */
export type CompanyVisionLog = {
  id: string;
  companyId: string;
  /** 変更前のスナップショット (改変なし) */
  joinMotivation?: string;
  longTermGoal?: string;
  thisYearGoal?: string;
  usagePolicy?: string;
  /** 何が変更されたか（field key の配列） */
  changedFields: Array<"joinMotivation" | "longTermGoal" | "thisYearGoal" | "usagePolicy">;
  recordedAt: string;
  recordedBy?: string;
};

export interface CompanyVisionRepo {
  get(companyId: string): Promise<CompanyVision | null>;
  upsert(input: CompanyVisionUpsert): Promise<CompanyVision>;
  listLogs(companyId: string): Promise<CompanyVisionLog[]>;
}

// ─────────────────────────────────────────────
// 企業天気の手動オーバーライド
// 自動派生 (deriveCompanyWeather) を手動値で上書きする
// ─────────────────────────────────────────────
import type { CompanyWeather } from "@/lib/domain/weather";

export type CompanyWeatherOverride = {
  companyId: string;
  weather: CompanyWeather;
  updatedAt: string;
  updatedBy?: string;
  note?: string;
};

export interface CompanyWeatherRepo {
  getAll(): Promise<CompanyWeatherOverride[]>;
  get(companyId: string): Promise<CompanyWeatherOverride | null>;
  set(
    companyId: string,
    weather: CompanyWeather,
    opts?: { updatedBy?: string; note?: string }
  ): Promise<CompanyWeatherOverride>;
  /** 自動派生に戻す */
  clear(companyId: string): Promise<void>;
}

export interface ContractLifecycleRepo {
  listByCompany(companyId: string): Promise<ContractLifecycleSnapshot[]>;
  getByContract(contractId: string): Promise<ContractLifecycleSnapshot | null>;
  /** 解約・更新成功などのライフサイクル終端時に書き込む */
  freeze(input: Omit<ContractLifecycleSnapshot, "createdAt">): Promise<ContractLifecycleSnapshot>;
  /** 凍結を取り消す（誤操作からのリカバリ専用） */
  unfreeze(contractId: string): Promise<void>;
}

// ─────────────────────────────────────────────
// 派遣者 / セッション / 出席 / アンケート
// マイグレーション: 0001_init.sql の participants / sessions / attendance_events
// surveys / survey_responses
//
// mock の型 (lib/mock/participants.ts, lib/mock/surveys.ts) を正本とし、
// Supabase 実装側で列名 (snake_case) を camelCase に変換する。
// 一部 mock 拡張フィールド (Survey.templateIds 等) は DB スキーマに対応列が
// ないため空配列 / undefined で返す (将来 join テーブル拡張で対応予定)。
// ─────────────────────────────────────────────
export type Participant = MockParticipant & { organizationId: string };
export type Session = MockSession & { organizationId: string };
export type AttendanceEvent = MockAttendanceRecord & { organizationId: string };
export type Survey = MockSurvey & { organizationId: string };
export type SurveyResponse = MockSurveyResponse & { organizationId: string };
export type SurveySchedule = MockSurveySchedule & { organizationId: string };

// 取り込み実行のペイロード（pipeline.buildImportPayload の出力 + ヘッダ情報）
export type SurveyImportPayload = {
  fileName: string;
  scheduleId: string;
  executedAt: string;          // ISO 日付 (e.g. "2026-04-27")
  uploadedBy?: string;         // ユーザ名（任意）
  rawCsv: string;              // 監査用に元 CSV をそのまま保存
  columnMappings: import("@/lib/mock/surveys").ColumnMapping[];
  newQuestions: import("@/lib/mock/surveys").SurveyQuestion[];
  survey: {
    title: string;
    productSessionLabel?: string;
    respondentType: "stakeholder" | "participant";
    expectedRespondentCount: number;
    openedAt: string;
    closedAt?: string;
    status: "draft" | "open" | "closed";
    templateName: string;
  };
  responses: Array<{
    respondentName: string;
    submittedAt: string;
    companyId: string | null;  // 企業列がない場合は null
    answers: Array<{
      questionId: string;
      value: number | string | string[];
    }>;
  }>;
  aiSummary?: string;
};

export type SurveyImportResult = {
  surveyId: string;
  importId: string;
  createdQuestionCount: number;
  responseCount: number;
};

export type SurveyImportRecord = {
  id: string;
  organizationId: string;
  fileName: string;
  uploadedAt: string;
  uploadedBy?: string;
  scheduleId: string;
  surveyId?: string;
  status: "parsing" | "mapping" | "review" | "applied" | "failed";
  rowCount: number;
  aiSummary?: string;
};

export type SurveyInsightRecord = {
  id: string;
  surveyId: string;
  questionId?: string;
  category: "positive" | "concern" | "suggestion" | "complaint" | "strength" | "weakness";
  summary: string;
  sourceResponseIds: string[];
  confidence: number;
  createdAt: string;
};

export interface SurveyRepo {
  list(opts?: { productCode?: ProductCode; organizationId?: string }): Promise<Survey[]>;
  getById(id: string): Promise<Survey | null>;
  listResponses(surveyId: string): Promise<SurveyResponse[]>;
  /** 研修×タイミング のアンケート発生スケジュール一覧 */
  listSchedules(opts?: { productCode?: ProductCode; organizationId?: string; activeOnly?: boolean }): Promise<SurveySchedule[]>;
  /** 単一スケジュールの取得 */
  getScheduleById(id: string): Promise<SurveySchedule | null>;
  // 取り込み（Phase 1）
  createSurveyWithResponses(payload: SurveyImportPayload): Promise<SurveyImportResult>;
  listImports(opts?: { scheduleId?: string; surveyId?: string }): Promise<SurveyImportRecord[]>;
  saveInsights(surveyId: string, insights: SurveyInsightRecord[]): Promise<void>;
  listInsights(surveyId: string): Promise<SurveyInsightRecord[]>;
  /** survey に紐づくテンプレートに含まれる質問定義を返す（取り込みで作成された新規質問を含む） */
  listQuestionsForSurvey(surveyId: string): Promise<import("@/lib/mock/surveys").SurveyQuestion[]>;
}

export interface ParticipantRepo {
  listByContract(contractId: string): Promise<Participant[]>;
  list(opts?: { productCode?: ProductCode; organizationId?: string }): Promise<Participant[]>;
}

export interface SessionRepo {
  listByContract(contractId: string): Promise<Session[]>;
}

export interface AttendanceRepo {
  listByContract(contractId: string): Promise<AttendanceEvent[]>;
}

// ─────────────────────────────────────────────
// Email スレッド / メッセージ / AI 抽出
// マイグレーション: supabase/migrations/0031_email.sql
// 関連 mock: lib/mock/email.ts
// ─────────────────────────────────────────────
export type EmailThreadStatus =
  | "new"
  | "in_progress"
  | "replied"
  | "waiting"
  | "closed";

export type EmailAssigneeReason = "received" | "program" | "manual";

export type EmailDirection = "inbound" | "outbound";

export type EmailThread = {
  id: string;
  organizationId: string;
  companyId?: string;
  subject: string;
  status: EmailThreadStatus;
  /** 担当 CS の app_users.id */
  assigneeUserId?: string;
  assigneeReason?: EmailAssigneeReason;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type EmailMessage = {
  id: string;
  threadId: string;
  direction: EmailDirection;
  body: string;
  senderEmail: string;
  recipientEmails: string[];
  sentAt: string;
  aiSummary?: string;
  createdAt: string;
};

export type EmailMessageCreateInput = {
  id?: string;
  threadId: string;
  direction: EmailDirection;
  body: string;
  senderEmail: string;
  recipientEmails?: string[];
  sentAt?: string;
  aiSummary?: string;
};

export type AiExtractionSourceType = "email" | "meeting_log" | "survey";

export type AiExtractionType =
  | "progress_signal"
  | "risk_signal"
  | "churn_signal"
  | "expansion_signal"
  | "meeting_request";

export type AiExtraction = {
  id: string;
  organizationId: string;
  sourceType: AiExtractionSourceType;
  sourceId: string;
  companyId?: string;
  extractionType: AiExtractionType;
  excerpt: string;
  confidence?: number;
  suggestedAction?: string;
  reviewed: boolean;
  reviewedAt?: string;
  reviewedBy?: string;
  createdAt: string;
};

export type AiExtractionListOpts = {
  unreviewedOnly?: boolean;
  limit?: number;
};

export type GmailThreadUpsertInput = {
  organizationId: string;
  gmailThreadId: string;
  subject: string;
  companyId?: string;
  assigneeUserId?: string;
  lastInboundAt?: string;
  lastOutboundAt?: string;
};

export type GmailMessageInsertInput = {
  threadId: string;
  gmailMessageId: string;
  direction: EmailDirection;
  body: string;
  senderEmail: string;
  recipientEmails: string[];
  sentAt: string;
};

export interface EmailRepo {
  listThreads(opts?: { companyId?: string; organizationId?: string }): Promise<EmailThread[]>;
  getThread(id: string): Promise<EmailThread | null>;
  listMessages(threadId: string): Promise<EmailMessage[]>;
  createMessage(input: EmailMessageCreateInput): Promise<EmailMessage>;
  setStatus(threadId: string, status: EmailThreadStatus): Promise<void>;
  setAssignee(
    threadId: string,
    userId: string,
    reason: EmailAssigneeReason
  ): Promise<void>;
  // ── Gmail 同期向け ──
  /** Gmail thread id で既存スレッドを検索しなければ新規作成 */
  upsertThreadByGmailId(input: GmailThreadUpsertInput): Promise<EmailThread>;
  /** Gmail message id で既存があれば既存 message を返す。なければ INSERT */
  insertMessageByGmailId(input: GmailMessageInsertInput): Promise<EmailMessage>;
  /** organization 内で sender_email → company_id を解決 (company_contacts.email を引く) */
  findCompanyByEmail(organizationId: string, email: string): Promise<string | null>;
}

export interface AiExtractionRepo {
  listByCompany(companyId: string, opts?: AiExtractionListOpts): Promise<AiExtraction[]>;
  /** 担当する email_threads (assignee_user_id) 経由の email source 抽出を集める */
  listByMe(userId: string, opts?: AiExtractionListOpts): Promise<AiExtraction[]>;
  markReviewed(id: string, userId: string): Promise<void>;
}

// ─────────────────────────────────────────────
// オンボテンプレ (DB 化)
// migration 0036 で seed。productOnboardingTemplates と同じ shape を返す
// ─────────────────────────────────────────────
export type OnboardingTemplateItemRecord = {
  id: string;
  categoryId: string;
  itemKey: string;
  name: string;
  dueOffsetDays: number;
  required: boolean;
  defaultAssigneeRole?: "cs" | "pr" | "ops" | "finance" | null;
  /** null = 全コース共通、文字列 = 特定 courseKey のみ */
  courseKey?: string | null;
};

export type OnboardingTemplateCategoryRecord = {
  id: string;
  productCode: string;
  categoryKey: string;
  label: string;
  displayOrder: number;
  items: OnboardingTemplateItemRecord[];
};

export interface OnboardingTemplateRepo {
  /** product 別にカテゴリ + items をまとめて取得 (UI が一括描画する用途) */
  listByProduct(productCode: string): Promise<OnboardingTemplateCategoryRecord[]>;
  /** カテゴリの追加 / 編集 (label / display_order)。category_key は変更不可 */
  upsertCategory(input: {
    id?: string;
    productCode: string;
    categoryKey: string;
    label: string;
    displayOrder: number;
  }): Promise<OnboardingTemplateCategoryRecord>;
  deleteCategory(id: string): Promise<void>;
  /** 項目の追加 / 編集 */
  upsertItem(input: {
    id?: string;
    categoryId: string;
    itemKey: string;
    name: string;
    dueOffsetDays: number;
    required: boolean;
    defaultAssigneeRole?: "cs" | "pr" | "ops" | "finance" | null;
    courseKey?: string | null;
  }): Promise<OnboardingTemplateItemRecord>;
  deleteItem(id: string): Promise<void>;
}

// ─────────────────────────────────────────────
// ロール権限マトリクス (admin が機能ごとの最低ロールを設定可能にする)
// ─────────────────────────────────────────────
export type PermissionKey = "contract_manage" | "program_term_manage";

export type RolePermission = {
  permissionKey: PermissionKey;
  minRole: AppUserRole; // "admin" | "manager" | "member" | "viewer"
  description?: string | null;
  updatedBy?: string | null;
  updatedAt?: string;
};

export interface RolePermissionRepo {
  list(): Promise<RolePermission[]>;
  getByKey(key: PermissionKey): Promise<RolePermission | null>;
  upsert(input: {
    permissionKey: PermissionKey;
    minRole: AppUserRole;
    updatedBy?: string | null;
  }): Promise<RolePermission>;
}

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
  churnRecords: ChurnRecordRepo;
  expansionOpportunities: ExpansionOpportunityRepo;
  vocItems: VocItemRepo;
  productCourses: ProductCourseRepo;
  companyTasks: CompanyTaskRepo;
  programs: ProgramRepo;
  // 申し送り l〜q
  contacts: ContactRepo;
  meetingLogs: MeetingLogRepo;
  stakeholders: StakeholderRepo;
  accountJourneys: AccountJourneyRepo;
  onboardingItems: OnboardingItemRepo;
  successPlans: SuccessPlanRepo;
  // 企業/事業ジャーニー (account-journey-v2)
  journeyStageDefinitions: JourneyStageDefinitionRepo;
  companyJourneys: CompanyJourneyRepo;
  businessJourneys: BusinessJourneyRepo;
  // ジャーニーステージのチェックポイント完了状態
  journeyCheckpoints: JourneyCheckpointRepo;
  // 契約終了スナップショット (解約・更新成功・期満了の凍結履歴)
  contractLifecycle: ContractLifecycleRepo;
  // 企業天気の手動オーバーライド
  companyWeatherOverrides: CompanyWeatherRepo;
  // 企業ビジョン (NEO参画動機 / 目標 / 活用方針)
  companyVisions: CompanyVisionRepo;
  // 権限スコープ
  userProgramRoles: UserProgramRoleRepo;
  userCompanyAccess: UserCompanyAccessRepo;
  // チャット (DM / 事業部 / メールスレッド統合)
  chats: ChatRepo;
  // アンケート / 派遣者 / セッション / 出席
  surveys: SurveyRepo;
  participants: ParticipantRepo;
  sessions: SessionRepo;
  attendance: AttendanceRepo;
  // メール (スレッド / メッセージ / AI 抽出)
  emails: EmailRepo;
  aiExtractions: AiExtractionRepo;
  // ロール権限マトリクス (admin が機能ごとの最低ロールを設定可能)
  rolePermissions: RolePermissionRepo;
  // オンボテンプレ (DB 化)
  onboardingTemplates: OnboardingTemplateRepo;
  // ユーザ通知 inbox (VOC / 週次未提出 / 解約予兆 / 更新 / オンボ を集約)
  userNotifications: UserNotificationRepo;
  // ユーザ単位の Gmail OAuth 接続
  gmailConnections: GmailConnectionRepo;
}

// ─────────────────────────────────────────────
// 通知センター (user_notifications)
// マイグレーション: supabase/migrations/0041_user_notifications.sql
// 集約元: VOC items / weekly_reviews / churn_signals / contracts (renewal window)
//        / onboarding_tasks (overdue) / email_threads (inbound)
// ─────────────────────────────────────────────
export type NotificationCategory =
  | "alert"      // VOC アラート等の即応事項
  | "review"     // 週次レビュー未提出
  | "renewal"    // 更新ウィンドウ突入
  | "onboarding" // オンボ期限超過
  | "mail";      // 新着メール

export type UserNotification = {
  id: string;
  organizationId: string;
  /** 宛先ユーザ。null は組織全体ブロードキャスト */
  userId?: string;
  category: NotificationCategory;
  title: string;
  body?: string;
  linkHref?: string;
  relatedCompanyId?: string;
  relatedContractId?: string;
  /** 同一ソース由来の通知を重複生成しないための識別子 */
  sourceType?: string;
  sourceId?: string;
  readAt?: string;
  createdAt: string;
};

export type UserNotificationCreateInput = Omit<
  UserNotification,
  "id" | "createdAt" | "readAt"
>;

export type UserNotificationFilter = {
  organizationId?: string;
  userId?: string;
  category?: NotificationCategory;
  unreadOnly?: boolean;
  limit?: number;
};

export interface UserNotificationRepo {
  list(filter: UserNotificationFilter): Promise<UserNotification[]>;
  /** dedup (user_id, source_type, source_id) で衝突した場合は既存レコードを返す */
  create(input: UserNotificationCreateInput): Promise<UserNotification>;
  markRead(id: string, userId: string): Promise<void>;
  markAllRead(userId: string): Promise<number>;
  /** ヘッダのバッジ用: 未読件数のみカウント */
  countUnread(userId: string): Promise<number>;
}

// ─────────────────────────────────────────────
// Gmail OAuth 接続 (user_gmail_connections)
// マイグレーション: supabase/migrations/0042_user_gmail_connections.sql
// ─────────────────────────────────────────────
export type GmailConnection = {
  id: string;
  organizationId: string;
  userId: string;
  emailAddress: string;
  /** refresh_token は server-only。クライアントに渡さないこと */
  refreshToken: string;
  accessToken?: string;
  accessTokenExpiresAt?: string;
  grantedScopes: string;
  connectedAt: string;
  lastSyncAt?: string;
  lastSyncStatus?: "success" | "warning" | "error";
  lastSyncNote?: string;
};

export type GmailConnectionUpsertInput = Omit<
  GmailConnection,
  "id" | "connectedAt" | "lastSyncAt" | "lastSyncStatus" | "lastSyncNote"
>;

export interface GmailConnectionRepo {
  getByUserId(userId: string): Promise<GmailConnection | null>;
  upsert(input: GmailConnectionUpsertInput): Promise<GmailConnection>;
  updateSyncStatus(
    userId: string,
    patch: {
      lastSyncAt?: string;
      lastSyncStatus?: GmailConnection["lastSyncStatus"];
      lastSyncNote?: string;
      accessToken?: string;
      accessTokenExpiresAt?: string;
    }
  ): Promise<void>;
  delete(userId: string): Promise<void>;
}
