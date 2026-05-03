/**
 * 構造化ロガー
 *
 * - pino を遅延 import (未インストール環境では stderr JSON フォールバック)
 * - 全ログに request_id / actor_user_id / org_id を載せる契約
 * - PII (email, mail本文, 電話) は載せない: フィールド名で機械的に弾くため
 *   `denyKeys` を使った redact を有効化
 *
 * 使い方:
 *   const log = await getLogger();
 *   log.info({ requestId, actorUserId, kind: 'cs.weekly_review.update' }, 'updated');
 *
 * Sentry とは独立 (logger は通常時、Sentry は例外時)。
 */

import 'server-only';
import { optionalImport } from '@/lib/security/optional-import';

type Level = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogFn {
  (obj: Record<string, unknown>, msg?: string): void;
  (msg: string): void;
}

export interface Logger {
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  fatal: LogFn;
  child(bindings: Record<string, unknown>): Logger;
}

const REDACT_KEYS = [
  '*.email',
  '*.tel',
  '*.phone',
  '*.password',
  '*.api_key',
  '*.access_token',
  '*.refresh_token',
  '*.authorization',
  'mailBody',
  'meeting_body',
];

let cached: Logger | null = null;

export async function getLogger(): Promise<Logger> {
  if (cached) return cached;

  const level = (process.env.LOG_LEVEL as Level) ?? 'info';

  const mod = await optionalImport<{ default: (opts: unknown) => Logger }>('pino');
  if (!mod) {
    cached = makeFallbackLogger(level);
    return cached;
  }
  try {
    cached = mod.default({
      level,
      base: { app: 'neo-cs-v2', env: process.env.NODE_ENV ?? 'development' },
      redact: { paths: REDACT_KEYS, remove: true },
      timestamp: () => `,"time":"${new Date().toISOString()}"`,
    });
    return cached;
  } catch {
    cached = makeFallbackLogger(level);
    return cached;
  }
}

// ノイズ降格用ラベル一覧
// middleware の app_users SELECT 等、頻出だが情報量の低いログの kind を
// ここに登録すると level=debug 強制扱いとなり、本番 LOG_LEVEL=info では出力されない。
// Sentry にも transports しない (sentry.ts 側で同 kind を skip)。
const NOISE_KINDS = new Set<string>([
  'select_app_users_for_session',
  'middleware.session_refresh',
  'middleware.role_lookup',
  'supabase.auth.refresh',
]);

export function isNoiseKind(kind: unknown): boolean {
  return typeof kind === 'string' && NOISE_KINDS.has(kind);
}

function makeFallbackLogger(minLevel: Level): Logger {
  const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40, fatal: 50 };
  const min = order[minLevel] ?? 20;

  function emit(level: Level, base: Record<string, unknown>) {
    return (a: unknown, b?: string) => {
      const obj: Record<string, unknown> =
        typeof a === 'string' ? { msg: a } : { ...(a as Record<string, unknown>), msg: b };
      // ノイズ降格: 該当 kind なら level を debug に下げる
      const effectiveLevel: Level = isNoiseKind(obj.kind) ? 'debug' : level;
      if (order[effectiveLevel] < min) return;
      const sanitized = redact({ ...base, ...obj, level: effectiveLevel, time: new Date().toISOString() });
      process.stderr.write(JSON.stringify(sanitized) + '\n');
    };
  }

  function build(base: Record<string, unknown>): Logger {
    return {
      debug: emit('debug', base) as LogFn,
      info: emit('info', base) as LogFn,
      warn: emit('warn', base) as LogFn,
      error: emit('error', base) as LogFn,
      fatal: emit('fatal', base) as LogFn,
      child: (b) => build({ ...base, ...b }),
    };
  }

  return build({ app: 'neo-cs-v2', env: process.env.NODE_ENV ?? 'development' });
}

function redact(o: Record<string, unknown>): Record<string, unknown> {
  const blockedNames = new Set([
    'email',
    'tel',
    'phone',
    'password',
    'api_key',
    'access_token',
    'refresh_token',
    'authorization',
    'mailBody',
    'meeting_body',
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (blockedNames.has(k)) continue;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = redact(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}
