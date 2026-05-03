/**
 * /api/health — 依存サービスのヘルスチェック
 *
 *   GET → 200 { status, checks } / 503 (degraded)
 *
 * - Supabase: REST ping (2s)
 * - Anthropic: HEAD / (2s)。CIで叩きすぎないよう ?deep=1 の時のみ実行
 *
 * 失敗詳細はクライアントに返さない。markUnhealthy で縮退モードを連動。
 */

import { NextRequest } from 'next/server';
import { fetchHard } from '@/lib/security/http';
import { markHealthy, markUnhealthy } from '@/lib/security/degraded';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type State = 'ok' | 'fail' | 'skip';

export async function GET(req: NextRequest): Promise<Response> {
  const checks: Record<string, State> = { process: 'ok' };
  const deep = new URL(req.url).searchParams.get('deep') === '1';

  // Supabase
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    checks.supabase = 'skip';
  } else {
    try {
      const { response } = await fetchHard(`${url}/rest/v1/?select=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        timeoutMs: 2000,
        retries: 0,
      });
      checks.supabase = response.ok ? 'ok' : 'fail';
      if (response.ok) markHealthy('supabase');
      else markUnhealthy('supabase');
    } catch {
      checks.supabase = 'fail';
      markUnhealthy('supabase');
    }
  }

  // Anthropic (deep のみ)
  if (!deep) {
    checks.anthropic = 'skip';
  } else if (!process.env.ANTHROPIC_API_KEY) {
    checks.anthropic = 'skip';
  } else {
    try {
      const { response } = await fetchHard('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
        timeoutMs: 4000,
        retries: 0,
      });
      // 200 でも 4xx (認証/スキーマ) でも疎通自体はOKと判定
      checks.anthropic = response.status < 500 ? 'ok' : 'fail';
      if (checks.anthropic === 'ok') markHealthy('anthropic');
      else markUnhealthy('anthropic');
    } catch {
      checks.anthropic = 'fail';
      markUnhealthy('anthropic');
    }
  }

  const allOk = Object.values(checks).every((v) => v !== 'fail');
  return new Response(
    JSON.stringify({
      status: allOk ? 'ok' : 'degraded',
      checks,
      ts: new Date().toISOString(),
    }),
    {
      status: allOk ? 200 : 503,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    },
  );
}
