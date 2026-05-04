import type { Repository } from "../types";
import { mockCompanyRepo } from "./companyRepo";
import { mockContractRepo } from "./contractRepo";
import { mockWeeklyReviewRepo } from "./weeklyReviewRepo";
import { mockUserRepo } from "./userRepo";
import { mockHealthSnapshotRepo } from "./healthSnapshotRepo";
import { mockAuditLogRepo } from "./auditLogRepo";
import { mockDraftRepo } from "./draftRepo";
import { mockAssignmentRepo } from "./assignmentRepo";
import { mockOneOnOneLogRepo } from "./oneOnOneLogRepo";
import { mockChurnSignalRepo } from "./churnSignalRepo";
import { mockExpansionOpportunityRepo } from "./expansionOpportunityRepo";
import { mockRenewalMilestoneRepo } from "./renewalMilestoneRepo";
import { mockVocItemRepo } from "./vocItemRepo";
import { mockKpiSnapshotRepo } from "./kpiSnapshotRepo";
import { mockContactRepo } from "./contactRepo";
import { mockMeetingLogRepo } from "./meetingLogRepo";
import { mockStakeholderRepo } from "./stakeholderRepo";
import { mockAccountJourneyRepo } from "./accountJourneyRepo";
import { mockOnboardingItemRepo } from "./onboardingItemRepo";
import { mockSuccessPlanRepo } from "./successPlanRepo";
import { mockProductCourseRepo } from "./productCourseRepo";
import { mockCompanyTaskRepo } from "./companyTaskRepo";

export const mockRepository: Repository = {
  companies: mockCompanyRepo,
  contracts: mockContractRepo,
  weeklyReviews: mockWeeklyReviewRepo,
  users: mockUserRepo,
  healthSnapshots: mockHealthSnapshotRepo,
  auditLogs: mockAuditLogRepo,
  drafts: mockDraftRepo,
  assignments: mockAssignmentRepo,
  oneOnOneLogs: mockOneOnOneLogRepo,
  churnSignals: mockChurnSignalRepo,
  expansionOpportunities: mockExpansionOpportunityRepo,
  renewalMilestones: mockRenewalMilestoneRepo,
  vocItems: mockVocItemRepo,
  kpiSnapshots: mockKpiSnapshotRepo,
  contacts: mockContactRepo,
  meetingLogs: mockMeetingLogRepo,
  stakeholders: mockStakeholderRepo,
  accountJourneys: mockAccountJourneyRepo,
  onboardingItems: mockOnboardingItemRepo,
  successPlans: mockSuccessPlanRepo,
  productCourses: mockProductCourseRepo,
  companyTasks: mockCompanyTaskRepo
};
