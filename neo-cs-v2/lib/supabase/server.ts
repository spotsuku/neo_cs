// Supabase クライアント (サーバーサイド専用)
//
// service_role と SSR Auth クライアントの両方を提供する。
//   - getServiceClient(): service_role key を持つ昇格クライアント。
//     audit_logs 書込み・migration ジョブ・RLS バイパスが必要な処理専用
//   - getAuthClient(): Cookie 経由のユーザーセッションを引き継ぐ通常クライアント。
//     RLSが有効な状態で auth.uid() に紐づくクエリを実行する
//
// クライアントコンポーネントからは絶対に import しない。

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedService: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (cachedService) return cachedService;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です (.env.local を確認)"
    );
  }
  cachedService = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return cachedService;
}

/**
 * SSR/Route Handler 内でユーザーセッションを引き継ぐクライアント。
 * @supabase/ssr 経由で cookie を扱う想定だが、本ハンドラの導入は
 * middleware.ts の整備とセットで P1 で行う。現時点では service と
 * 同じインスタンスを返す（RLS は service_role でバイパスされる点に注意）。
 *
 * TODO: middleware.ts 整備後、@supabase/ssr の createServerClient に置換
 */
export function getAuthClient(): SupabaseClient {
  return getServiceClient();
}
