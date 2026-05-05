// RLS テスト用シミュレータ
//
// 目的:
//   service_role キー（RLS バイパス）ではなく、特定の app_users 行になりすました
//   状態で SQL を発行できる Supabase クライアントを作る。
//   これによって 0022 / 0023 / 0024 の RLS が「実際にどう振る舞うか」を
//   ローカル / CI で検証できる。
//
// 使い方:
//   const sb = await asUser("matsuda@neoacademia.jp");
//   const { data } = await sb.from("companies").select("id");
//   // member ロールから見えた行だけ返ってくる
//
// 仕組み:
//   1. service クライアントで `auth.users` から該当ユーザーを引く
//   2. supabase.auth.admin.generateLink({ type: 'magiclink' }) で session を発行
//      ※ 本番では使わないこと。ローカル supabase 起動時のみ
//   3. その access_token を anon クライアントに setSession して返す
//
// 必要な環境変数:
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY
//   - SUPABASE_ANON_KEY
//
// セットアップ手順:
//   `supabase start` でローカル supabase を起動 → migration 適用 → seed 投入
//   テストは `npm run test:rls`（package.json で別途定義予定）

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getEnv(): { url: string; service: string; anon: string } {
  const url = process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !service || !anon) {
    throw new Error(
      "RLS テストには SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY が必要です"
    );
  }
  return { url, service, anon };
}

/**
 * 指定メールアドレスの app_users にひもづく auth.users で session を発行し、
 * その JWT で動作する supabase クライアントを返す。
 *
 * 戻り値の client では RLS が有効。
 */
export async function asUser(email: string): Promise<SupabaseClient> {
  const { url, service, anon } = getEnv();
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // 1. app_users → auth_user_id を解決
  const { data: appUser, error: appErr } = await admin
    .from("app_users")
    .select("auth_user_id, email")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (appErr) throw new Error(`app_users 取得失敗: ${appErr.message}`);
  if (!appUser?.auth_user_id) {
    throw new Error(`auth.users とリンクされていません: ${email}`);
  }

  // 2. magic link 発行（access_token を取り出すために使用）
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email
  });
  if (linkErr) throw new Error(`generateLink 失敗: ${linkErr.message}`);
  const props = (link as unknown as {
    properties?: { hashed_token?: string; action_link?: string };
  }).properties;
  const hashed = props?.hashed_token;
  if (!hashed) throw new Error("hashed_token が取得できませんでした");

  // 3. anon クライアントに magic link を verifyOtp で詰めて session 化
  const anonClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: verified, error: vErr } = await anonClient.auth.verifyOtp({
    token_hash: hashed,
    type: "magiclink"
  });
  if (vErr || !verified.session) {
    throw new Error(`verifyOtp 失敗: ${vErr?.message ?? "session 無し"}`);
  }
  await anonClient.auth.setSession({
    access_token: verified.session.access_token,
    refresh_token: verified.session.refresh_token
  });

  return anonClient;
}

/**
 * 認証無し（anon ロール）の supabase クライアント。
 * 「未ログインで何が見えるか」を検証する用。
 */
export function asAnon(): SupabaseClient {
  const { url, anon } = getEnv();
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
