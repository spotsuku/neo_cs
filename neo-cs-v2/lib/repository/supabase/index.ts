// Supabase ドライバ集約 — 全リポジトリ実装済 (Stage 2 ready)
//
// 各 repo の write 系は lib/repository/_base.ts の MutationHook (auditHook +
// loggingHook) 経由で audit_logs / pino に流れる。
// markNotified 等の高頻度・低監査価値メソッドは意図的にフックをスキップ。

import "server-only";
import type { Repository } from "../types";
import { supabaseUserRepo } from "./userRepo";
import { supabaseCompanyRepo } from "./companyRepo";
import { supabaseWeeklyReviewRepo } from "./weeklyReviewRepo";
import { supabaseAuditLogRepo } from "./auditLogRepo";
import { supabaseDraftRepo } from "./draftRepo";
import { supabaseAssignmentRepo } from "./assignmentRepo";
import { supabaseOneOnOneLogRepo } from "./oneOnOneLogRepo";
import { supabaseContractRepo } from "./contractRepo";
import { supabaseHealthSnapshotRepo } from "./healthSnapshotRepo";
import { supabaseRenewalMilestoneRepo } from "./renewalMilestoneRepo";
import { supabaseKpiSnapshotRepo } from "./kpiSnapshotRepo";
import { supabaseChurnSignalRepo } from "./churnSignalRepo";
import { supabaseExpansionOpportunityRepo } from "./expansionOpportunityRepo";
import { supabaseVocItemRepo } from "./vocItemRepo";
import { supabaseProductCourseRepo } from "./productCourseRepo";
import { supabaseCompanyTaskRepo } from "./companyTaskRepo";
// program (事業内ToDo): supabase 実装は migration 0020 投入後に追加予定。
// 現状は mock 実装に委譲し型を満たす。
import { mockProgramRepo } from "../mock/programRepo";
import {
  supabaseContactRepo,
  supabaseMeetingLogRepo,
  supabaseStakeholderRepo,
  supabaseAccountJourneyRepo,
  supabaseOnboardingItemRepo,
  supabaseSuccessPlanRepo
} from "./_lookup";
// 企業/事業ジャーニー (account-journey-v2): supabase 実装は migration 0020
// 投入後に追加予定。現状は mock 実装に委譲し型を満たす。
import {
  mockJourneyStageDefinitionRepo
} from "../mock/journeyStageDefinitionRepo";
import { mockCompanyJourneyRepo } from "../mock/companyJourneyRepo";
import { mockBusinessJourneyRepo } from "../mock/businessJourneyRepo";
// 権限スコープ (user_program_roles / user_company_access)
// マイグレーション 0022 投入後に有効
import { supabaseUserProgramRoleRepo } from "./userProgramRoleRepo";
import { supabaseUserCompanyAccessRepo } from "./userCompanyAccessRepo";
import { supabaseChatRepo } from "./chatRepo";

export const supabaseRepository: Repository = {
  users: supabaseUserRepo,
  companies: supabaseCompanyRepo,
  weeklyReviews: supabaseWeeklyReviewRepo,
  auditLogs: supabaseAuditLogRepo,
  drafts: supabaseDraftRepo,
  assignments: supabaseAssignmentRepo,
  oneOnOneLogs: supabaseOneOnOneLogRepo,
  contracts: supabaseContractRepo,
  healthSnapshots: supabaseHealthSnapshotRepo,
  kpiSnapshots: supabaseKpiSnapshotRepo,
  churnSignals: supabaseChurnSignalRepo,
  renewalMilestones: supabaseRenewalMilestoneRepo,
  expansionOpportunities: supabaseExpansionOpportunityRepo,
  vocItems: supabaseVocItemRepo,
  productCourses: supabaseProductCourseRepo,
  companyTasks: supabaseCompanyTaskRepo,
  programs: mockProgramRepo,
  contacts: supabaseContactRepo,
  meetingLogs: supabaseMeetingLogRepo,
  stakeholders: supabaseStakeholderRepo,
  accountJourneys: supabaseAccountJourneyRepo,
  onboardingItems: supabaseOnboardingItemRepo,
  successPlans: supabaseSuccessPlanRepo,
  journeyStageDefinitions: mockJourneyStageDefinitionRepo,
  companyJourneys: mockCompanyJourneyRepo,
  businessJourneys: mockBusinessJourneyRepo,
  userProgramRoles: supabaseUserProgramRoleRepo,
  userCompanyAccess: supabaseUserCompanyAccessRepo,
  chats: supabaseChatRepo
};
