// MutationHook に渡す actor / request コンテキスト
//
// AsyncLocalStorage で Server Action / Route Handler 入口に actor を設定する想定。
// 未設定の場合は anonymous で記録（フォールバック）。

import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { MutationHookContext } from "../audit";

const ctxStorage = new AsyncLocalStorage<MutationHookContext>();

export function withActorContext<T>(ctx: MutationHookContext, fn: () => Promise<T>): Promise<T> {
  return ctxStorage.run(ctx, fn);
}

export function getActorContext(): MutationHookContext {
  return (
    ctxStorage.getStore() ?? {
      actor: { userId: null, email: null, role: null, organizationId: null },
      request: { id: "anonymous", ip: null, userAgent: null }
    }
  );
}
