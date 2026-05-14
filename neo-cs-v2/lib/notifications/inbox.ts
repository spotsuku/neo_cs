// 通知 inbox (user_notifications) への書き込みヘルパ
//
// 各種ドメインイベント (VOC 作成 / 解約予兆検出 等) の write path から呼び出される。
// 失敗は throw せずログに留め、業務ロジックを止めない。

import "server-only";
import {
  userNotificationRepo,
  assignmentRepo,
  DEFAULT_ORG_ID
} from "@/lib/repository/server";
import type {
  NotificationCategory,
  UserNotificationCreateInput
} from "@/lib/repository/server";

/** companyId → primary 担当者 userId */
export async function resolvePrimaryAssignee(
  companyId: string
): Promise<string | undefined> {
  try {
    const rows = await assignmentRepo.listByCompany(companyId, {
      activeOnly: true
    });
    return rows.find((r) => r.role === "primary")?.userId;
  } catch {
    return undefined;
  }
}

export type EnqueueNotificationInput = Omit<
  UserNotificationCreateInput,
  "organizationId"
> & {
  organizationId?: string;
};

export async function enqueueNotification(
  input: EnqueueNotificationInput
): Promise<void> {
  try {
    await userNotificationRepo.create({
      organizationId: input.organizationId ?? DEFAULT_ORG_ID,
      userId: input.userId,
      category: input.category,
      title: input.title,
      body: input.body,
      linkHref: input.linkHref,
      relatedCompanyId: input.relatedCompanyId,
      relatedContractId: input.relatedContractId,
      sourceType: input.sourceType,
      sourceId: input.sourceId
    });
  } catch (e) {
    // 通知失敗は業務処理を止めない。コンソールに残す。
    console.error("[notifications.enqueue] failed", {
      error: e instanceof Error ? e.message : String(e),
      sourceType: input.sourceType,
      sourceId: input.sourceId
    });
  }
}

/** カテゴリラベル (UI 表示用ではなく内部ラベル) */
export const NOTIFICATION_CATEGORIES = [
  "alert",
  "review",
  "renewal",
  "onboarding",
  "mail"
] as const satisfies readonly NotificationCategory[];
