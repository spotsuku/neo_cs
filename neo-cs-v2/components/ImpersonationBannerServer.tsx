// Impersonation バナーの Server ラッパ
// 全ページで TopNavServer の上に置く想定。インパーソン中以外は何も描画しない。

import "server-only";
import { getPermissionContextWithRealActor } from "@/lib/auth/server";
import { ImpersonationBanner } from "./ImpersonationBanner";

export async function ImpersonationBannerServer() {
  const { isImpersonating, realActor, ctx } = await getPermissionContextWithRealActor();
  if (!isImpersonating || !realActor || !ctx.actor) return null;
  return (
    <ImpersonationBanner
      realActorName={realActor.name}
      effectiveActorName={ctx.actor.name}
    />
  );
}
