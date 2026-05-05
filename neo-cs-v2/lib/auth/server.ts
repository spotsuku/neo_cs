// サーバ側で PermissionContext を組み立てるヘルパ
//
// Server Components / Server Actions / Route Handler 内で使用。
// admin の表示モードトグルは cookie (VIEW_MODE_COOKIE) で永続化される。

import "server-only";
import { cookies } from "next/headers";
import { userProgramRoleRepo, userCompanyAccessRepo, userRepo } from "@/lib/repository";
import {
  VIEW_MODE_COOKIE,
  IMPERSONATE_COOKIE,
  isViewModeOverride,
  type PermissionContext
} from "./permissions";
import type { AppUser } from "@/lib/repository/types";

/**
 * 元の admin と、インパーソン対象 user。両方を返したい場合は
 * getPermissionContextWithRealActor() を使う。getPermissionContext() は
 * 通常の判定で使う「見えるべき actor」のみを返す。
 */
export async function getPermissionContextWithRealActor(): Promise<{
  ctx: PermissionContext;
  realActor: AppUser | null;
  isImpersonating: boolean;
}> {
  const realActor = await userRepo.getCurrent();
  if (!realActor) {
    return {
      ctx: { actor: null, programs: [], companyAccess: [] },
      realActor: null,
      isImpersonating: false
    };
  }
  const cookieStore = await cookies();

  // インパーソン: admin かつ cookie に user_id が入っている場合に actor を差替え
  let effectiveActor: AppUser = realActor;
  let isImpersonating = false;
  if (realActor.role === "admin") {
    const targetId = cookieStore.get(IMPERSONATE_COOKIE)?.value;
    if (targetId && targetId !== realActor.id) {
      const target = await userRepo.getById(targetId);
      // external のインパーソンは禁止
      if (target && target.role !== "external") {
        effectiveActor = target;
        isImpersonating = true;
      }
    }
  }

  const [programs, companyAccess] = await Promise.all([
    userProgramRoleRepo.listByUser(effectiveActor.id),
    effectiveActor.role === "external"
      ? userCompanyAccessRepo.listByUser(effectiveActor.id)
      : Promise.resolve([])
  ]);
  const viewMode = cookieStore.get(VIEW_MODE_COOKIE)?.value;

  return {
    ctx: {
      actor: effectiveActor,
      programs,
      companyAccess,
      viewModeOverride: isViewModeOverride(viewMode) ? viewMode : undefined
    },
    realActor,
    isImpersonating
  };
}

export async function getPermissionContext(): Promise<PermissionContext> {
  const { ctx } = await getPermissionContextWithRealActor();
  return ctx;
}
