"use server";

// 認証・表示モード関連の Server Actions

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  VIEW_MODE_COOKIE,
  IMPERSONATE_COOKIE,
  isViewModeOverride
} from "./permissions";
import { getPermissionContext, getPermissionContextWithRealActor } from "./server";
import { userRepo, auditLogRepo } from "@/lib/repository/server";

/**
 * admin の表示モード切替（manager / member）
 * - admin 以外が呼んだ場合は no-op
 * - cookie に保存し、現在のパスを revalidate してナビ表示を切り替える
 */
export async function setViewMode(mode: "manager" | "member", currentPath: string = "/") {
  const ctx = await getPermissionContext();
  if (ctx.actor?.role !== "admin") return;
  if (!isViewModeOverride(mode)) return;

  const c = await cookies();
  c.set(VIEW_MODE_COOKIE, mode, {
    httpOnly: false, // クライアントからも読める（点滅対策）
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
  revalidatePath(currentPath);
}

/**
 * admin が任意ユーザーになりすまして UI を確認する
 * - admin 以外が呼んだ場合は no-op
 * - external へのインパーソンは禁止
 * - userId が null なら解除
 */
export async function setImpersonation(
  userId: string | null,
  currentPath: string = "/"
) {
  // 実 admin の判定。getPermissionContext は差替え後 actor を返すので
  // 元 admin を直接 fetch して権限判定する。
  const real = await userRepo.getCurrent();
  if (real?.role !== "admin") return;

  const c = await cookies();
  if (userId === null) {
    // 解除前の対象 user を audit ログに残すため cookie 値を取得
    const prevTargetId = c.get(IMPERSONATE_COOKIE)?.value;
    c.delete(IMPERSONATE_COOKIE);
    if (prevTargetId) {
      await appendImpersonateAudit(real, prevTargetId, "impersonate_stop").catch(() => {});
    }
  } else {
    const target = await userRepo.getById(userId);
    if (!target) return;
    if (target.role === "external") return; // 漏洩リスク回避
    c.set(IMPERSONATE_COOKIE, userId, {
      httpOnly: true, // クライアント JS からは読めない（誤改竄防止）
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8 // 8 時間で自動失効
    });
    await appendImpersonateAudit(real, userId, "impersonate_start").catch(() => {});
  }
  revalidatePath(currentPath);
}

/**
 * インパーソンの開始/解除を audit_logs に記録
 * - actor は実 admin（差替え前）
 * - target_id にはインパーソン対象 userId を入れる
 * - after_data に { real, effective } を保存して trace 可能に
 */
async function appendImpersonateAudit(
  real: { id: string; email: string; role: string; organizationId: string },
  targetUserId: string,
  action: "impersonate_start" | "impersonate_stop"
) {
  await auditLogRepo.append({
    organizationId: real.organizationId,
    actorUserId: real.id,
    actorEmail: real.email,
    actorRole: real.role,
    action,
    targetTable: "app_users",
    targetId: targetUserId,
    afterData: { real_user_id: real.id, target_user_id: targetUserId }
  });
}

/** 現在インパーソン中か返す（クライアント表示用） */
export async function getImpersonationStatus(): Promise<{
  isImpersonating: boolean;
  realActorName: string | null;
  effectiveActorName: string | null;
}> {
  const { realActor, ctx, isImpersonating } = await getPermissionContextWithRealActor();
  return {
    isImpersonating,
    realActorName: realActor?.name ?? null,
    effectiveActorName: ctx.actor?.name ?? null
  };
}
