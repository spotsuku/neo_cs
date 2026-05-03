/**
 * Sentry 連携 (no-op フォールバック付き)
 *
 * - SENTRY_DSN 未設定時 → no-op (本番以外は通常そう)
 * - @sentry/nextjs 未インストール時 → stderr 構造化ログにフォールバック
 *
 * captureException は同期的に投げて await せずに使えるよう、内部で
 * void Promise を握って例外を握りつぶす設計。
 */

import 'server-only';
import { optionalImport } from '@/lib/security/optional-import';
import { isNoiseKind } from './logger';

interface MinimalSentry {
  captureException(err: unknown, hint?: { tags?: Record<string, string>; extra?: Record<string, unknown> }): void;
  captureMessage(msg: string, hint?: { level?: 'fatal' | 'error' | 'warning' | 'info' }): void;
  setUser(user: { id?: string; org_id?: string } | null): void;
}

let cached: MinimalSentry | null = null;
let initialized = false;

async function init(): Promise<MinimalSentry | null> {
  if (initialized) return cached;
  initialized = true;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return null;

  const mod = await optionalImport<{
    init: (opts: Record<string, unknown>) => void;
    captureException: MinimalSentry['captureException'];
    captureMessage: MinimalSentry['captureMessage'];
    setUser: MinimalSentry['setUser'];
  }>('@sentry/nextjs');
  if (!mod) return null;
  try {
    mod.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
      // PII を送らない
      sendDefaultPii: false,
      beforeSend(event: Record<string, unknown>) {
        const req = (event as { request?: { headers?: Record<string, string> } }).request;
        if (req?.headers) {
          delete req.headers.authorization;
          delete req.headers.cookie;
        }
        return event;
      },
    });
    cached = {
      captureException: mod.captureException,
      captureMessage: mod.captureMessage,
      setUser: mod.setUser,
    };
    return cached;
  } catch {
    return null;
  }
}

export function captureException(
  err: unknown,
  hint?: { tags?: Record<string, string>; extra?: Record<string, unknown> },
): void {
  // ノイズ降格: kind が NOISE_KINDS なら Sentry に送らない (logger 側で debug 出力済)
  if (isNoiseKind(hint?.tags?.kind) || isNoiseKind(hint?.extra?.kind)) return;
  void init().then((s) => {
    if (s) {
      s.captureException(err, hint);
      return;
    }
    process.stderr.write(
      JSON.stringify({
        kind: 'sentry_fallback_exception',
        time: new Date().toISOString(),
        message: (err as Error)?.message ?? String(err),
        stack: (err as Error)?.stack,
        tags: hint?.tags,
        extra: hint?.extra,
      }) + '\n',
    );
  });
}

export function captureMessage(
  msg: string,
  hint?: { level?: 'fatal' | 'error' | 'warning' | 'info' },
): void {
  void init().then((s) => {
    if (s) {
      s.captureMessage(msg, hint);
      return;
    }
    process.stderr.write(
      JSON.stringify({
        kind: 'sentry_fallback_message',
        time: new Date().toISOString(),
        msg,
        level: hint?.level ?? 'info',
      }) + '\n',
    );
  });
}

export function setSentryUser(user: { id?: string; org_id?: string } | null): void {
  void init().then((s) => s?.setUser(user));
}
