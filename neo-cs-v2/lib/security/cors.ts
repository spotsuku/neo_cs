/**
 * CORS 共通ミドルウェア (Route Handler 用)
 *
 * 環境変数 ALLOWED_ORIGINS (カンマ区切り) のオリジンのみ許可。
 * preflight OPTIONS は許可外なら 403。
 */

const allowed = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export function corsHeaders(origin: string | null): HeadersInit {
  const ok = origin && allowed.includes(origin);
  if (!ok) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': origin!,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
  };
}

export function preflightResponse(req: Request): Response {
  const origin = req.headers.get('origin');
  const ok = origin && allowed.includes(origin);
  return new Response(null, {
    status: ok ? 204 : 403,
    headers: corsHeaders(origin),
  });
}

export function isOriginAllowed(req: Request): boolean {
  const origin = req.headers.get('origin');
  // Same-origin (no Origin header) は常に許可
  if (!origin) return true;
  return allowed.includes(origin);
}
