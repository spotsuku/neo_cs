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
import { mockChurnRecordRepo } from "./churnRecordRepo";
import { mockExpansionOpportunityRepo } from "./expansionOpportunityRepo";
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
import { mockProgramRepo } from "./programRepo";
import { mockJourneyStageDefinitionRepo } from "./journeyStageDefinitionRepo";
import { mockCompanyJourneyRepo } from "./companyJourneyRepo";
import { mockBusinessJourneyRepo } from "./businessJourneyRepo";
import { mockUserProgramRoleRepo } from "./userProgramRoleRepo";
import { mockUserCompanyAccessRepo } from "./userCompanyAccessRepo";
import { mockChatRepo } from "./chatRepo";
import { mockJourneyCheckpointRepo } from "./journeyCheckpointRepo";
import { mockContractLifecycleRepo } from "./contractLifecycleRepo";
import { mockCompanyWeatherRepo } from "./companyWeatherRepo";
import { mockCompanyVisionRepo } from "./companyVisionRepo";
import { mockSurveyRepo } from "./surveyRepo";
import { mockParticipantRepo } from "./participantRepo";
import { mockSessionRepo } from "./sessionRepo";
import { mockAttendanceRepo } from "./attendanceRepo";
import { mockEmailRepo } from "./emailRepo";
import { mockAiExtractionRepo } from "./aiExtractionRepo";
import { mockRolePermissionRepo } from "./rolePermissionRepo";
import { mockOnboardingTemplateRepo } from "./onboardingTemplateRepo";
import { mockUserNotificationRepo } from "./userNotificationRepo";
import { mockGmailConnectionRepo } from "./gmailConnectionRepo";
import { mockDriveSendLogRepo } from "./driveSendLogRepo";

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
  churnRecords: mockChurnRecordRepo,
  expansionOpportunities: mockExpansionOpportunityRepo,
  vocItems: mockVocItemRepo,
  kpiSnapshots: mockKpiSnapshotRepo,
  contacts: mockContactRepo,
  meetingLogs: mockMeetingLogRepo,
  stakeholders: mockStakeholderRepo,
  accountJourneys: mockAccountJourneyRepo,
  onboardingItems: mockOnboardingItemRepo,
  successPlans: mockSuccessPlanRepo,
  productCourses: mockProductCourseRepo,
  companyTasks: mockCompanyTaskRepo,
  programs: mockProgramRepo,
  journeyStageDefinitions: mockJourneyStageDefinitionRepo,
  companyJourneys: mockCompanyJourneyRepo,
  businessJourneys: mockBusinessJourneyRepo,
  userProgramRoles: mockUserProgramRoleRepo,
  userCompanyAccess: mockUserCompanyAccessRepo,
  chats: mockChatRepo,
  journeyCheckpoints: mockJourneyCheckpointRepo,
  contractLifecycle: mockContractLifecycleRepo,
  companyWeatherOverrides: mockCompanyWeatherRepo,
  companyVisions: mockCompanyVisionRepo,
  surveys: mockSurveyRepo,
  participants: mockParticipantRepo,
  sessions: mockSessionRepo,
  attendance: mockAttendanceRepo,
  emails: mockEmailRepo,
  aiExtractions: mockAiExtractionRepo,
  rolePermissions: mockRolePermissionRepo,
  onboardingTemplates: mockOnboardingTemplateRepo,
  userNotifications: mockUserNotificationRepo,
  gmailConnections: mockGmailConnectionRepo,
  driveSendLogs: mockDriveSendLogRepo
};
