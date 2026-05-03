"use server";

/**
 * ユーザー無効化 / 再有効化 Server Action
 *
 * 役割:
 *   - app_users.is_active を切替 (Stream 1 提供の userRepo.setActive)
 *   - audit_logs に disable_user / enable_user を必ず記録
 *   - 操作可能ロールは admin のみ。caller の getCurrent() で再判定
 *
 * 注意:
 *   - 自分自身は無効化できない (誤操作で全アクセス断防止)
 *   - 失敗は string で理由を返し、画面側でトースト表示する想定
 */

import { revalidatePath } from "next/cache";
import { userRepo } from "@/lib/repository";
import { recordAudit } from "@/lib/repository/audit";

export interface SetActiveResult {
  ok: boolean;
  message: string;
}

export async function setUserActiveAction(
  userId: string,
  isActive: boolean,
  reason?: string
): Promise<SetActiveResult> {
  const requestId = crypto.randomUUID();
  const actor = await userRepo.getCurrent();
  if (!actor) return { ok: false, message: "認証が確認できません" };
  if (actor.role !== "admin") return { ok: false, message: "admin ロールのみ実行できます" };
  if (actor.id === userId && isActive === false) {
    return { ok: false, message: "自分自身を無効化することはできません" };
  }

  const target = await userRepo.getById(userId);
  if (!target) return { ok: false, message: "対象ユーザーが見つかりません" };
  if (target.isActive === isActive) {
    return { ok: false, message: isActive ? "既に有効です" : "既に無効です" };
  }

  try {
    await userRepo.setActive(userId, isActive);
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  await recordAudit({
    action: isActive ? "enable_user" : "disable_user",
    targetTable: "app_users",
    targetId: userId,
    before: { isActive: target.isActive, role: target.role },
    after: { isActive, role: target.role },
    reason: reason ?? (isActive ? "manual_enable" : "manual_disable"),
    actor: {
      userId: actor.id,
      email: actor.email,
      role: actor.role,
      organizationId: actor.organizationId
    },
    request: { id: requestId, ip: null, userAgent: null },
    source: "app"
  });

  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${userId}`);
  return {
    ok: true,
    message: isActive ? "ユーザーを再有効化しました" : "ユーザーを無効化しました"
  };
}
