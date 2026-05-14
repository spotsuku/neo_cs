'use server';

/**
 * 同意の付与・撤回 Server Action
 *
 * 1. consent_records へ記録
 * 2. audit_logs に consent_grant / consent_revoke を記録
 *
 * Supabase service_role を要求 (RLSでINSERTを絞っているため)。
 * 認証は cookies のSupabaseセッションから取得する想定 (01側で配線予定)。
 * 未配線環境では noop + stderr ログにフォールバック。
 */

import { recordAudit } from '@/lib/repository/audit';
import { CURRENT_POLICY_VERSION } from '@/lib/consents/registry';
import { optionalImport } from '@/lib/security/optional-import';

type SupabaseClient = {
  from: (t: string) => {
    insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    update: (patch: Record<string, unknown>) => {
      eq: (col: string, val: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => { is: (col: string, val: null) => Promise<{ error: { message: string } | null }> };
        };
      };
    };
  };
};
type SupabaseModule = {
  createClient: (url: string, key: string, opts?: unknown) => SupabaseClient;
};

export interface ConsentInput {
  subjectType: 'organization' | 'user' | 'company';
  subjectId: string;
  consentType: string;
  purposeText: string;
  granted: boolean;
}

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

async function getActor() {
  // 01側で createServerClient(cookies()) ベースに差し替え予定
  return {
    userId: process.env.CURRENT_USER_ID ?? null,
    email: null as string | null,
    role: 'admin',
    organizationId: null as string | null,
  };
}

export async function setConsent(input: ConsentInput): Promise<{ ok: boolean; message?: string }> {
  const actor = await getActor();
  const requestId = crypto.randomUUID();
  const client = await getServiceClient();

  if (!client) {
    process.stderr.write(
      JSON.stringify({
        at: new Date().toISOString(),
        kind: 'consent_fallback',
        actor,
        input,
      }) + '\n',
    );
    return { ok: false, message: 'Supabase 未配線 (開発フォールバック)' };
  }

  if (input.granted) {
    const { error } = await client.from('consent_records').insert({
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      consent_type: input.consentType,
      consented: true,
      purpose_text: input.purposeText,
      policy_version: CURRENT_POLICY_VERSION,
      granted_by: actor.userId,
    });
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await client
      .from('consent_records')
      .update({ revoked_at: new Date().toISOString(), revoked_by: actor.userId })
      .eq('subject_type', input.subjectType)
      .eq('subject_id', input.subjectId)
      .eq('consent_type', input.consentType)
      .is('revoked_at', null);
    if (error) return { ok: false, message: error.message };
  }

  await recordAudit({
    action: input.granted ? 'consent_grant' : 'consent_revoke',
    targetTable: 'consent_records',
    targetId: `${input.subjectType}:${input.subjectId}:${input.consentType}`,
    after: { ...input, policy_version: CURRENT_POLICY_VERSION },
    actor,
    request: { id: requestId, ip: null, userAgent: null },
    reason: input.granted ? 'user_grant' : 'user_revoke',
  });

  return { ok: true };
}
