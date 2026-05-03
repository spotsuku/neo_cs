/**
 * Supabase JWT 検証 (Route Handler 用)
 *
 * 注意: 01側で @supabase/supabase-js を導入済みである前提。
 *       未導入時は serverless でエラーにせず null を返してフォールバック動作させる
 *       (運用フラグ ALLOW_UNAUTH=true のときは開発環境専用の bypass を許可)。
 */

import 'server-only';
import { optionalImport } from '@/lib/security/optional-import';

type SupabaseAuthClient = {
  auth: { getUser: (token: string) => Promise<{ data: { user: { id: string; email?: string } | null }; error: { message: string } | null }> };
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: { role?: string; organization_id?: string; is_active?: boolean } | null }>;
      };
    };
  };
};
type SupabaseModule = {
  createClient: (url: string, key: string, opts?: unknown) => SupabaseAuthClient;
};

export interface AuthedActor {
  userId: string;
  email: string | null;
  role: string;
  organizationId: string | null;
}

export async function verifyBearer(req: Request): Promise<AuthedActor | null> {
  const auth = req.headers.get('authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (!m) return null;
  const token = m[1];

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  const mod = await optionalImport<SupabaseModule>('@supabase/supabase-js');
  if (!mod) return null;
  try {
    const client = mod.createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return null;

    // app_users から role と organization_id を引く (RLS 通過のため service_role)
    const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!svcKey) {
      return {
        userId: data.user.id,
        email: data.user.email ?? null,
        role: 'member',
        organizationId: null,
      };
    }
    const svc = mod.createClient(url, svcKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: row } = await svc
      .from('app_users')
      .select('role, organization_id, is_active')
      .eq('id', data.user.id)
      .maybeSingle();

    if (row && row.is_active === false) return null;

    return {
      userId: data.user.id,
      email: data.user.email ?? null,
      role: row?.role ?? 'member',
      organizationId: row?.organization_id ?? null,
    };
  } catch {
    return null;
  }
}

export function getClientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip');
}
