// middleware.ts が x-app-user-* ヘッダで actor を渡してくれる前提で、
// Server Action / Route Handler 入口で AsyncLocalStorage に詰め直すヘルパ。
//
// 使い方:
//   "use server";
//   import { withActorFromHeaders } from "@/lib/security/actor-from-headers";
//   export async function myAction(input: ...) {
//     return withActorFromHeaders(async () => {
//       // ここで repo.* を呼ぶと runAfterWrite に actor が乗る
//     });
//   }

import "server-only";
import { headers } from "next/headers";
import { withActorContext } from "@/lib/repository/supabase/_actor";
import type { MutationHookContext } from "@/lib/repository/_base";

export async function buildActorContextFromHeaders(): Promise<MutationHookContext> {
  const h = await headers();
  return {
    actor: {
      userId: h.get("x-app-user-id"),
      email: h.get("x-app-user-email"),
      role: h.get("x-app-user-role"),
      organizationId: h.get("x-app-org-id")
    },
    request: {
      id: h.get("x-request-id") ?? crypto.randomUUID(),
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent")
    }
  };
}

export async function withActorFromHeaders<T>(fn: () => Promise<T>): Promise<T> {
  const ctx = await buildActorContextFromHeaders();
  return withActorContext(ctx, fn);
}
