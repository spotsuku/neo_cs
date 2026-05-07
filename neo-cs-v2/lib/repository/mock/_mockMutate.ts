// mock リポ用の write hook ヘルパ
//
// 全 mock リポの create/update/delete を統一して `mockMutate()` 経由にすることで、
// dev 環境でも `loggingHook` (lib/observability/repo-hook.ts) が起動し、
// 書込み内容が pino ログに出る。supabase 駆動と同じ観測性を得るのが目的。
//
// ── 移行状況 (2026-05-07 時点) ──
//   適用済 (loggingHook が起動する):
//     companyRepo, contractRepo, weeklyReviewRepo, companyTaskRepo,
//     oneOnOneLogRepo, churnSignalRepo, expansionOpportunityRepo,
//     vocItemRepo, stakeholderRepo
//   未適用 (loggingHook が発火しないため dev で write が見えない):
//     assignmentRepo, draftRepo, meetingLogRepo, companyVisionRepo,
//     companyJourneyRepo, companyWeatherRepo, emailRepo, onboardingItemRepo,
//     healthSnapshotRepo, contactRepo, userRepo, accountJourneyRepo,
//     aiExtractionRepo, attendanceRepo, businessJourneyRepo, chatRepo,
//     churnRecordRepo, contractLifecycleRepo, journeyCheckpointRepo,
//     journeyStageDefinitionRepo, kpiSnapshotRepo, productCourseRepo,
//     programRepo, userProgramRoleRepo
//   除外 (audit on audit になるため未適用):
//     auditLogRepo
//
// 未適用の repo に書込みが入った際は本ヘルパを import して各 write 後に
// 呼び出すこと。本番動作には影響しない (mock 駆動時のみ発火)。
//
// 副作用 (audit_logs への永続化) は失敗してもメインの write を巻き込まない仕様
// (lib/repository/_base.ts の runAfterWrite が握りつぶす)。
//
// 使い方:
//   ```ts
//   const before = { ...store[idx] };
//   store[idx] = { ...store[idx], ...patch };
//   const after = { ...store[idx] };
//   await mockMutate({
//     entityType: "companies",
//     entityId: id,
//     action: "update",
//     before,
//     after,
//     organizationId: store[idx].organizationId
//   });
//   ```
//
// actor を mock コンテキストで取得できる場合は actor 引数で渡す。
// 取れない場合は null になり、auditHook 側で actorless として扱われる。

import { runAfterWrite } from "../_base";

export type MockMutateArgs = {
  entityType: string;
  entityId: string;
  action: "create" | "update" | "delete";
  before?: unknown;
  after?: unknown;
  organizationId?: string | null;
  actorUserId?: string | null;
};

export async function mockMutate(args: MockMutateArgs): Promise<void> {
  await runAfterWrite({
    entityType: args.entityType,
    entityId: args.entityId,
    before: args.before,
    after: args.after,
    action: args.action,
    ctx: {
      actor: {
        userId: args.actorUserId ?? null,
        email: null,
        role: null,
        organizationId: args.organizationId ?? null
      },
      request: { id: "mock", ip: null, userAgent: null }
    }
  });
}
