/**
 * リポジトリ層 監査フック
 *
 * 役割:
 *   全ての write 操作 (create / update / delete) で audit_logs に記録する
 *   フックを提供する。01側 lib/repository/_base.ts が `MutationHook`
 *   インターフェースを採用すれば、本モジュールを registerHook(auditHook)
 *   するだけで全変更が自動記録される。
 *
 * 注意:
 *   - このモジュールは @supabase/supabase-js が未インストールでも壊れないよう
 *     依存を遅延 import する。実運用では SUPABASE_SERVICE_ROLE_KEY が必須。
 *   - service_role を使うのは audit_logs の RLS が service_role insert のみ
 *     許可されているため。クライアント側からは絶対に呼ばない (Server Components
 *     / Route Handler / Server Actions 専用)。
 */

import 'server-only';
import { optionalImport } from '@/lib/security/optional-import';

type SupabaseClient = {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
};
type SupabaseModule = {
  createClient: (url: string, key: string, opts?: unknown) => SupabaseClient;
};

// 型は lib/repository/types.ts を正本とする (demo_wipe / impersonate_* も含む)
export type { AuditAction } from './types';
import type { AuditAction } from './types';

export interface AuditActor {
  userId: string | null;
  email: string | null;
  role: string | null;
  organizationId: string | null;
}

export interface AuditRequest {
  id: string;
  ip: string | null;
  userAgent: string | null;
}

export interface AuditPayload {
  action: AuditAction;
  targetTable: string;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
  diff?: unknown;
  reason?: string | null;
  source?: 'app' | 'api' | 'job';
}

export interface AuditEntry extends AuditPayload {
  actor: AuditActor;
  request: AuditRequest;
}

// ── リポジトリ層が消費する MutationHook 契約 ────────────────────────
export interface MutationHookContext {
  actor: AuditActor;
  request: AuditRequest;
}

export interface MutationHook {
  afterWrite(args: {
    entityType: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
    action: 'create' | 'update' | 'delete';
    ctx: MutationHookContext;
  }): Promise<void> | void;
}

// ── 実装 ──────────────────────────────────────────────────────────
async function getServiceClient(): Promise<SupabaseClient | null> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const mod = await optionalImport<SupabaseModule>('@supabase/supabase-js');
  if (!mod) return null;
  return mod.createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * audit_logs に1行追記する。失敗しても呼び出し元の write は止めない
 * (監査記録の失敗は別経路で alert: stderr + 後段でSentry連携予定)。
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  const client = await getServiceClient();
  if (!client) {
    // 開発環境フォールバック: stderr に構造化ログ
    process.stderr.write(
      JSON.stringify({ at: new Date().toISOString(), kind: 'audit_fallback', entry }) + '\n',
    );
    return;
  }

  const { error } = await client.from('audit_logs').insert({
    actor_user_id: entry.actor.userId,
    actor_email: entry.actor.email,
    actor_role: entry.actor.role,
    organization_id: entry.actor.organizationId,
    action: entry.action,
    target_table: entry.targetTable,
    target_id: entry.targetId ?? null,
    before_data: entry.before ?? null,
    after_data: entry.after ?? null,
    diff: entry.diff ?? null,
    reason: entry.reason ?? null,
    request_id: entry.request.id,
    ip_address: entry.request.ip,
    user_agent: entry.request.userAgent,
    source: entry.source ?? 'app',
  });

  if (error) {
    process.stderr.write(
      JSON.stringify({
        at: new Date().toISOString(),
        kind: 'audit_insert_failed',
        message: error.message,
        entry: { action: entry.action, target: entry.targetTable, id: entry.targetId },
      }) + '\n',
    );
    // セキュリティ上重要な action の audit 失敗は Slack に通知して気付ける
    // ようにする。失敗を握りつぶしたままにすると監査証跡が静かに失われる。
    if (SECURITY_SENSITIVE_ACTIONS.has(entry.action)) {
      void notifyAuditFailure(entry, error.message);
    }
  }
}

/**
 * 失敗時に Slack 通知すべき security-sensitive な action 集合。
 * これらは法務/コンプライアンス上、監査証跡の欠落が直接リスクになるため
 * 「失敗をサイレントに stderr に流すだけ」では足りない。
 */
const SECURITY_SENSITIVE_ACTIONS = new Set<AuditAction>([
  'delete',
  'role_change',
  'consent_grant',
  'consent_revoke',
  'disable_user',
  'enable_user',
  'demo_wipe',
  'impersonate_start',
  'impersonate_stop',
  'export',
  'read_sensitive'
]);

async function notifyAuditFailure(entry: AuditEntry, message: string): Promise<void> {
  // 動的 import で循環依存・テスト失敗を回避 (Slack 連携は server-only モジュール)
  try {
    const mod = await import('@/lib/notifications/slack');
    await mod.notifySlack(
      'AUDIT_FAILURE',
      {
        text:
          `:rotating_light: audit_logs への書込みに失敗しました (${entry.action} on ${entry.targetTable}/${entry.targetId ?? 'n/a'})\n` +
          `原因: ${message}\n` +
          `actor: ${entry.actor.email ?? entry.actor.userId ?? 'unknown'}`
      },
      {
        dedupKey: `audit-fail:${entry.action}:${entry.targetTable}:${entry.targetId ?? ''}`
      }
    );
  } catch (e) {
    process.stderr.write(
      JSON.stringify({
        at: new Date().toISOString(),
        kind: 'audit_alert_failed',
        message: e instanceof Error ? e.message : String(e)
      }) + '\n'
    );
  }
}

/**
 * 01側 lib/repository/_base.ts の registerHook(auditHook) で登録する想定。
 */
export const auditHook: MutationHook = {
  async afterWrite({ entityType, entityId, before, after, action, ctx }) {
    await recordAudit({
      action,
      targetTable: entityType,
      targetId: entityId,
      before,
      after,
      actor: ctx.actor,
      request: ctx.request,
      source: 'app',
    });
  },
};
