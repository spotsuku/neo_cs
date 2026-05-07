// Server-only Repository ファサード
//
// REPO_DRIVER に従って mock / supabase 実装を返す。
// Server Components / Server Actions / Route Handler から import すること。
// クライアントコンポーネントから import すると `server-only` 経由で build
// エラーになる (これは意図したガード)。
//
// 使い方:
//   import { getRepo } from "@/lib/repository/server";
//   const repo = getRepo();
//   const list = await repo.companies.list({ organizationId });

import "server-only";
import type { Repository } from "./types";
import { mockRepository } from "./mock";
import { supabaseRepository } from "./supabase";

// Domain 型は types.ts が正本。Server 側からの型 import を簡素化するため
// ここからも re-export する (型は erased なので server-only ガードに影響しない)。
export * from "./types";

export type RepoDriver = "mock" | "supabase";

export function resolveDriver(): RepoDriver {
  const raw = process.env.REPO_DRIVER?.toLowerCase();
  return raw === "supabase" ? "supabase" : "mock";
}

let cached: Repository | null = null;

export function getRepo(): Repository {
  if (cached) return cached;
  cached = resolveDriver() === "supabase" ? supabaseRepository : mockRepository;
  return cached;
}

export const repoDriver: RepoDriver = resolveDriver();

// ─────────────────────────────────────────────
// 個別 repo の便利 re-export
// ─────────────────────────────────────────────
// Server Component / Route Handler / Server Action から、各ドメインの repo を
// 直接 import したい時に使う。getRepo() の戻り値と同一インスタンスを参照する。
//
// 使い分け:
//   - クライアントコンポーネント: 触らない (server-only により build エラー)
//   - 1 リクエストで複数 repo を使う: import { getRepo } して `const repo = getRepo()`
//   - 1 つだけ欲しい: ここから個別 import (例: `import { vocItemRepo } from "@/lib/repository/server"`)
//
// 注意: 旧来の `@/lib/repository` から個別 import している箇所は、Server 側であれば
//       こちらに置換することで本番 (REPO_DRIVER=supabase) で実 DB を読むようになる。
const _repo = getRepo();
export const companyRepo = _repo.companies;
export const contractRepo = _repo.contracts;
export const weeklyReviewRepo = _repo.weeklyReviews;
export const userRepo = _repo.users;
export const healthSnapshotRepo = _repo.healthSnapshots;
export const kpiSnapshotRepo = _repo.kpiSnapshots;
export const auditLogRepo = _repo.auditLogs;
export const draftRepo = _repo.drafts;
export const assignmentRepo = _repo.assignments;
export const oneOnOneLogRepo = _repo.oneOnOneLogs;
export const churnSignalRepo = _repo.churnSignals;
export const churnRecordRepo = _repo.churnRecords;
export const expansionOpportunityRepo = _repo.expansionOpportunities;
export const vocItemRepo = _repo.vocItems;
export const productCourseRepo = _repo.productCourses;
export const companyTaskRepo = _repo.companyTasks;
export const programRepo = _repo.programs;
export const contactRepo = _repo.contacts;
export const meetingLogRepo = _repo.meetingLogs;
export const stakeholderRepo = _repo.stakeholders;
export const accountJourneyRepo = _repo.accountJourneys;
export const onboardingItemRepo = _repo.onboardingItems;
export const successPlanRepo = _repo.successPlans;
export const journeyStageDefinitionRepo = _repo.journeyStageDefinitions;
export const companyJourneyRepo = _repo.companyJourneys;
export const businessJourneyRepo = _repo.businessJourneys;
export const userProgramRoleRepo = _repo.userProgramRoles;
export const userCompanyAccessRepo = _repo.userCompanyAccess;
export const chatRepo = _repo.chats;
export const journeyCheckpointRepo = _repo.journeyCheckpoints;
export const contractLifecycleRepo = _repo.contractLifecycle;
export const companyWeatherRepo = _repo.companyWeatherOverrides;
export const companyVisionRepo = _repo.companyVisions;
export const surveyRepo = _repo.surveys;
export const participantRepo = _repo.participants;
export const sessionRepo = _repo.sessions;
export const attendanceRepo = _repo.attendance;
export const emailRepo = _repo.emails;
export const aiExtractionRepo = _repo.aiExtractions;
export const rolePermissionRepo = _repo.rolePermissions;
