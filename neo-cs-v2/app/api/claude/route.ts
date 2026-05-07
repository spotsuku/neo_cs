/**
 * /api/claude — Anthropic Messages API への安全なプロキシ
 *
 * セキュリティ要件 (reviews/11_情シスセキュリティ.md, 16_SRE.md):
 *   - Supabase JWT 認証必須
 *   - per-user / per-org / per-IP レート制限
 *   - 32KB ボディ上限
 *   - model / max_tokens サーバー固定
 *   - fetchHard 経由の30秒タイムアウト + 5xx/429 リトライ
 *   - エラー詳細はクライアント非開示 (request_id のみ)
 *   - claude_api_calls 記録 + 構造化ログ + Sentry
 *   - 縮退運転 (DEGRADED_ANTHROPIC=true) → 即 503
 *   - mail_analysis 経路は read_sensitive audit
 */

import { NextRequest } from 'next/server';
import { corsHeaders, isOriginAllowed, preflightResponse } from '@/lib/security/cors';
import {
  consume,
  RATE_USER_CLAUDE,
  RATE_ORG_CLAUDE,
  RATE_IP_CLAUDE,
} from '@/lib/security/rate-limit';
import { verifyBearer, getClientIp } from '@/lib/security/auth';
import { fetchHard } from '@/lib/security/http';
import { isDegraded, markHealthy, markUnhealthy } from '@/lib/security/degraded';
import { recordAudit } from '@/lib/repository/audit';
import { getLogger } from '@/lib/observability/logger';
import { captureException } from '@/lib/observability/sentry';
import { optionalImport } from '@/lib/security/optional-import';

type SupabaseModule = {
  createClient: (url: string, key: string, opts?: unknown) => {
    from: (t: string) => { insert: (row: Record<string, unknown>) => Promise<unknown> };
  };
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 32 * 1024;
const TIMEOUT_MS = 30_000;

/**
 * purpose → model の写像。質が KPI 直結する用途は Opus、
 * 大量処理・定型抽出は Sonnet、超大量バッチ要約は Haiku。
 * env で個別上書き可能。未指定 purpose は CLAUDE_MODEL_DEFAULT にフォールバック。
 */
const DEFAULT_MODEL = process.env.CLAUDE_MODEL_DEFAULT ?? process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6';
const MODEL_BY_PURPOSE: Record<string, string> = {
  survey_insight:  process.env.CLAUDE_MODEL_SURVEY_INSIGHT  ?? 'claude-opus-4-7',
  weekly_review:   process.env.CLAUDE_MODEL_WEEKLY_REVIEW   ?? 'claude-opus-4-7',
  voc_extraction:  process.env.CLAUDE_MODEL_VOC_EXTRACTION  ?? 'claude-opus-4-7',
  mail_analysis:   process.env.CLAUDE_MODEL_MAIL_ANALYSIS   ?? 'claude-sonnet-4-6',
  mail_extraction: process.env.CLAUDE_MODEL_MAIL_EXTRACTION ?? 'claude-sonnet-4-6',
  mail_reply:      process.env.CLAUDE_MODEL_MAIL_REPLY      ?? 'claude-sonnet-4-6',
  survey_import:   process.env.CLAUDE_MODEL_SURVEY_IMPORT   ?? 'claude-sonnet-4-6',
  mail_summary:    process.env.CLAUDE_MODEL_MAIL_SUMMARY    ?? 'claude-haiku-4-5',
};
function resolveModel(purpose?: string): string {
  if (purpose && MODEL_BY_PURPOSE[purpose]) return MODEL_BY_PURPOSE[purpose];
  return DEFAULT_MODEL;
}

const MAX_TOKENS = Number(process.env.CLAUDE_MAX_TOKENS ?? 1024);

export async function OPTIONS(req: NextRequest) {
  return preflightResponse(req);
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const origin = req.headers.get('origin');
  const baseHeaders = { 'X-Request-Id': requestId, ...corsHeaders(origin) };
  const log = (await getLogger()).child({ requestId, route: 'api/claude' });

  if (!isOriginAllowed(req)) {
    log.warn({ kind: 'cors.deny', origin }, 'origin not allowed');
    return json({ error: 'origin_not_allowed', request_id: requestId }, 403, baseHeaders);
  }

  if (isDegraded('anthropic')) {
    return json(
      { error: 'service_degraded', request_id: requestId, retry_after_sec: 60 },
      503,
      { ...baseHeaders, 'Retry-After': '60' },
    );
  }

  const actor = await verifyBearer(req);
  if (!actor) return json({ error: 'unauthorized', request_id: requestId }, 401, baseHeaders);

  const ip = getClientIp(req) ?? 'unknown';
  const [ipR, usrR, orgR] = await Promise.all([
    consume(`claude:ip:${ip}`, RATE_IP_CLAUDE),
    consume(`claude:user:${actor.userId}`, RATE_USER_CLAUDE),
    actor.organizationId
      ? consume(`claude:org:${actor.organizationId}`, RATE_ORG_CLAUDE)
      : Promise.resolve({ allowed: true, retryAfterSec: 0, remaining: 0 } as const)
  ]);
  const blocked = [ipR, usrR, orgR].find((r) => !r.allowed);
  if (blocked) {
    log.warn({ kind: 'rate_limited', actorUserId: actor.userId, orgId: actor.organizationId, ip });
    return json(
      { error: 'rate_limited', request_id: requestId, retry_after_sec: blocked.retryAfterSec },
      429,
      { ...baseHeaders, 'Retry-After': String(blocked.retryAfterSec) },
    );
  }

  const cl = Number(req.headers.get('content-length') ?? '0');
  if (cl > MAX_BODY_BYTES) return json({ error: 'body_too_large', request_id: requestId }, 413, baseHeaders);
  const raw = await req.text();
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return json({ error: 'body_too_large', request_id: requestId }, 413, baseHeaders);
  }

  let body: { messages?: unknown; system?: string; purpose?: string };
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return json({ error: 'invalid_json', request_id: requestId }, 400, baseHeaders);
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return json({ error: 'messages_required', request_id: requestId }, 400, baseHeaders);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    log.error({ kind: 'misconfigured' }, 'ANTHROPIC_API_KEY missing');
    return json({ error: 'misconfigured', request_id: requestId }, 500, baseHeaders);
  }

  const purpose = typeof body.purpose === 'string' ? body.purpose : undefined;
  const model = resolveModel(purpose);

  const started = Date.now();
  let status = 0;
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let errorCode: string | undefined;
  let upstream: unknown = null;

  try {
    const { response } = await fetchHard('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        messages: body.messages,
        ...(body.system ? { system: body.system } : {}),
      }),
      timeoutMs: TIMEOUT_MS,
      retries: 1,
      retryNonIdempotent: true,
    });
    status = response.status;
    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (response.ok && data) {
      const usage = (data as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
      inputTokens = usage?.input_tokens;
      outputTokens = usage?.output_tokens;
      upstream = data;
      markHealthy('anthropic');
    } else {
      errorCode = `anthropic_${response.status}`;
      if (response.status >= 500) markUnhealthy('anthropic');
    }
  } catch (e) {
    status = (e as Error).name === 'AbortError' ? 504 : 502;
    errorCode = (e as Error).name === 'AbortError' ? 'timeout' : 'upstream_error';
    markUnhealthy('anthropic');
    captureException(e, { tags: { route: 'api/claude' }, extra: { requestId } });
  }

  const latency = Date.now() - started;
  log.info({
    kind: 'claude.call',
    actorUserId: actor.userId,
    orgId: actor.organizationId,
    status,
    latencyMs: latency,
    errorCode,
    inputTokens,
    outputTokens,
    purpose,
    model,
  });

  void logCall({
    actor,
    requestId,
    ip,
    userAgent: req.headers.get('user-agent'),
    status,
    inputTokens,
    outputTokens,
    latencyMs: latency,
    errorCode,
    purpose,
    model,
  });

  if (errorCode) {
    return json(
      { error: 'upstream_failure', request_id: requestId },
      status === 504 ? 504 : 502,
      baseHeaders,
    );
  }
  return json(upstream, 200, baseHeaders);
}

function json(payload: unknown, status: number, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

async function logCall(args: {
  actor: { userId: string; email: string | null; role: string; organizationId: string | null };
  requestId: string;
  ip: string;
  userAgent: string | null;
  status: number;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  errorCode?: string;
  purpose?: string;
  model: string;
}): Promise<void> {
  try {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      process.stderr.write(
        JSON.stringify({ at: new Date().toISOString(), kind: 'claude_call', ...args }) + '\n',
      );
      return;
    }
    const mod = await optionalImport<SupabaseModule>('@supabase/supabase-js');
    if (!mod) return;
    const svc = mod.createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await svc.from('claude_api_calls').insert({
      actor_user_id: args.actor.userId,
      organization_id: args.actor.organizationId,
      model: args.model,
      purpose: args.purpose ?? null,
      input_tokens: args.inputTokens ?? null,
      output_tokens: args.outputTokens ?? null,
      latency_ms: args.latencyMs,
      status: args.status,
      request_id: args.requestId,
      ip: args.ip,
      user_agent: args.userAgent,
      error_code: args.errorCode ?? null,
    });
    if (args.purpose === 'mail_analysis') {
      await recordAudit({
        action: 'read_sensitive',
        targetTable: 'meeting_logs',
        targetId: null,
        actor: {
          userId: args.actor.userId,
          email: args.actor.email,
          role: args.actor.role,
          organizationId: args.actor.organizationId,
        },
        request: { id: args.requestId, ip: args.ip, userAgent: args.userAgent },
        reason: 'anthropic_mail_analysis',
        source: 'api',
      });
    }
  } catch (e) {
    captureException(e, { tags: { route: 'api/claude', kind: 'log_call' } });
  }
}
