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
import {
  supabaseContactRepo,
  supabaseMeetingLogRepo,
  supabaseStakeholderRepo,
  supabaseAccountJourneyRepo,
  supabaseOnboardingItemRepo,
  supabaseSuccessPlanRepo
} from "./_lookup";

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
  contacts: supabaseContactRepo,
  meetingLogs: supabaseMeetingLogRepo,
  stakeholders: supabaseStakeholderRepo,
  accountJourneys: supabaseAccountJourneyRepo,
  onboardingItems: supabaseOnboardingItemRepo,
  successPlans: supabaseSuccessPlanRepo
};
