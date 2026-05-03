// リポジトリ層 共通基盤
//
// 役割:
//  - mutation hook (write 系の前後フック) の登録・呼び出し
//  - lib/repository/audit.ts の auditHook を `registerHook(auditHook)` で
//    差し込めば、全 mock/supabase 実装の create/update/delete を
//    自動的に audit_logs に流せる
//
// 注意:
//  - hook は副作用（監査ログ書込み）であり、失敗しても元の write は止めない
//  - actor / request コンテキストは Server Action / Route Handler 側で
//    AsyncLocalStorage で渡す想定。本ファイルでは契約のみ定義し実装は
//    別PRで導入する

import type { MutationHook, MutationHookContext } from "./audit";

const hooks: MutationHook[] = [];

/**
 * 冪等な hook 登録。同一インスタンスは2重登録されない（テスト時の
 * 二重起動・HMR 再評価対策）。
 */
export function registerHook(hook: MutationHook): void {
  if (hooks.includes(hook)) return;
  hooks.push(hook);
}

export function clearHooksForTesting(): void {
  hooks.length = 0;
}

export async function runAfterWrite(args: {
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  action: "create" | "update" | "delete";
  ctx: MutationHookContext;
}): Promise<void> {
  // hook失敗は呼び出し元 write を巻き込まない
  await Promise.all(
    hooks.map(async (h) => {
      try {
        await h.afterWrite(args);
      } catch (e) {
        process.stderr.write(
          JSON.stringify({
            at: new Date().toISOString(),
            kind: "mutation_hook_failed",
            entityType: args.entityType,
            entityId: args.entityId,
            message: e instanceof Error ? e.message : String(e)
          }) + "\n"
        );
      }
    })
  );
}

export type { MutationHook, MutationHookContext } from "./audit";
