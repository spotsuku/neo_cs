// Server Component ラッパ: PermissionContext を解決して TopNav に渡す
//
// 既存の `<TopNav current="..." />` 呼び出しを `<TopNavServer current="..." />`
// に置き換えるとロール連動・admin トグル付きになる。

import "server-only";
import { TopNav } from "./TopNav";
import { getPermissionContext } from "@/lib/auth/server";
import { ImpersonationBannerServer } from "./ImpersonationBannerServer";

export async function TopNavServer({ current }: { current?: string }) {
  const ctx = await getPermissionContext();
  return (
    <>
      <ImpersonationBannerServer />
      <TopNav
        current={current}
        role={ctx.actor?.role}
        viewModeOverride={ctx.viewModeOverride}
        userName={ctx.actor?.name}
        userEmail={ctx.actor?.email}
      />
    </>
  );
}
