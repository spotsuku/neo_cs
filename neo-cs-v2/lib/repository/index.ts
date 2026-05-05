// Repository エントリポイント (クライアント/サーバ両対応)
//
// 本ファイルは **常に mock 実装**を返す。
// 理由: 既存のクライアントコンポーネント (`"use client"`) も `@/lib/repository`
// から `weeklyReviewRepo` 等を直接 import している。supabase 実装は
// `node:async_hooks` (`server-only`) に依存するためクライアントバンドル
// 不可なので、ドライバ切替は `@/lib/repository/server` 専用とする。
//
// 本番運用時:
//   - Server Components / Server Actions / Route Handler は
//     `@/lib/repository/server` の `getRepo()` 経由で REPO_DRIVER に従った
//     実装 (mock / supabase) を取得する
//   - Client Components はそのまま `@/lib/repository` を使い続けて mock
//     経由のローカルデータを表示する。実データ書込みは Server Action 経由
//     にリファクタするのが本筋 (P1で stream 02 と協調)
//
// 型 (Domain型 / Repository インターフェース / DEFAULT_ORG_ID) は
// 本ファイルが正本として re-export する。

import { mockRepository } from "./mock";
import type { Repository } from "./types";

export const repo: Repository = mockRepository;

// 個別 export（import 量を減らしたい呼び出し側向け）
export const companyRepo = repo.companies;
export const contractRepo = repo.contracts;
export const weeklyReviewRepo = repo.weeklyReviews;
export const userRepo = repo.users;
export const healthSnapshotRepo = repo.healthSnapshots;
export const auditLogRepo = repo.auditLogs;
export const draftRepo = repo.drafts;
export const assignmentRepo = repo.assignments;
export const oneOnOneLogRepo = repo.oneOnOneLogs;
export const churnSignalRepo = repo.churnSignals;
export const expansionOpportunityRepo = repo.expansionOpportunities;
export const renewalMilestoneRepo = repo.renewalMilestones;
export const vocItemRepo = repo.vocItems;
export const productCourseRepo = repo.productCourses;
export const companyTaskRepo = repo.companyTasks;
export const programRepo = repo.programs;
// 申し送り l〜q (N+1解消用)
export const contactRepo = repo.contacts;
export const meetingLogRepo = repo.meetingLogs;
export const stakeholderRepo = repo.stakeholders;
export const accountJourneyRepo = repo.accountJourneys;
export const onboardingItemRepo = repo.onboardingItems;
export const successPlanRepo = repo.successPlans;
export const journeyStageDefinitionRepo = repo.journeyStageDefinitions;
export const companyJourneyRepo = repo.companyJourneys;
export const businessJourneyRepo = repo.businessJourneys;
export const userProgramRoleRepo = repo.userProgramRoles;
export const userCompanyAccessRepo = repo.userCompanyAccess;
export const chatRepo = repo.chats;

export type { Repository } from "./types";
export * from "./types";
