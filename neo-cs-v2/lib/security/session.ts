/**
 * セッションタイムアウト方針
 *
 * 配線は01側 (Supabase Auth + middleware.ts) で行うため、本ファイルは
 *   - 共通定数 (idle / absolute)
 *   - app_users.last_seen_at / last_seen_ip 更新ヘルパ
 *   - 強制ログアウト判定
 * のみ提供する。
 *
 * 推奨配線:
 *   middleware.ts → 各リクエストで verifyBearer → checkSessionLimits →
 *   超過なら 401 を返してクライアント側でサインアウト処理。
 */

import 'server-only';
import { optionalImport } from '@/lib/security/optional-import';

type SupabaseModule = {
  createClient: (url: string, key: string, opts?: unknown) => {
    from: (t: string) => {
      update: (patch: Record<string, unknown>) => { eq: (col: string, val: string) => Promise<unknown> };
    };
  };
};

export const SESSION_IDLE_MAX_MS = 8 * 60 * 60 * 1000;   // 8時間無操作でログアウト
export const SESSION_ABS_MAX_MS  = 24 * 60 * 60 * 1000;  // 絶対上限 24時間

export interface SessionState {
  loginAt: number;       // ms epoch
  lastSeenAt: number;    // ms epoch
}

export type SessionVerdict =
  | { ok: true }
  | { ok: false; reason: 'idle_timeout' | 'absolute_timeout' };

export function checkSessionLimits(s: SessionState, now = Date.now()): SessionVerdict {
  if (now - s.lastSeenAt > SESSION_IDLE_MAX_MS) return { ok: false, reason: 'idle_timeout' };
  if (now - s.loginAt    > SESSION_ABS_MAX_MS)  return { ok: false, reason: 'absolute_timeout' };
  return { ok: true };
}

/**
 * 01側で createServerClient(cookies()) ベースの実装に差し替える前提。
 * Supabase service_role 経由で last_seen_at / last_seen_ip を更新。
 */
export async function touchLastSeen(args: {
  userId: string;
  ip: string | null;
}): Promise<void> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const mod = await optionalImport<SupabaseModule>('@supabase/supabase-js');
  if (!mod) return;
  try {
    const svc = mod.createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await svc
      .from('app_users')
      .update({ last_seen_at: new Date().toISOString(), last_seen_ip: args.ip })
      .eq('id', args.userId);
  } catch {
    // touch失敗はサイレント
  }
}
