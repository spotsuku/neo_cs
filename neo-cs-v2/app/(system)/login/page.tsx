// /login — Google OAuth サインインページ
//
// middleware.ts が未認証パスを /login?redirect=...&reason=... へ送る。
// reason は表示用ヒント (idle_timeout / absolute_timeout / user_disabled / unauthenticated)。
//
// REPO_DRIVER=mock ではサインイン UI を表示しつつ「mock モード」の旨を出す。
// REPO_DRIVER=supabase では Google OAuth を起動するクライアントコンポーネントを描く。

import { LoginButton } from "./LoginButton";

export const metadata = {
  title: "サインイン — NEO CSポータル"
};

const REASON_MESSAGE: Record<string, string> = {
  unauthenticated: "サインインが必要です",
  idle_timeout: "30分間操作がなかったため自動ログアウトしました",
  absolute_timeout: "セッション上限 (8時間) を超えたため再ログインが必要です",
  user_disabled: "アカウントが無効化されています。管理者にご連絡ください"
};

type SearchParams = Promise<{ redirect?: string; reason?: string }>;

export default async function LoginPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const redirect = params.redirect ?? "/";
  const reason = params.reason ?? "";
  const message = REASON_MESSAGE[reason] ?? null;
  const isMock = (process.env.REPO_DRIVER ?? "mock") !== "supabase";

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-8 shadow-xs">
        <h1 className="text-xl font-semibold text-neutral-900">NEO CSポータル</h1>
        <p className="mt-1 text-sm text-neutral-500">
          サインインしてダッシュボードを開きます
        </p>

        {message && (
          <div
            role="status"
            className="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            {message}
          </div>
        )}

        <div className="mt-6">
          {isMock ? (
            <div className="rounded border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
              <p className="font-medium text-neutral-800">mock モードで動作中</p>
              <p className="mt-1">
                認証は無効です。<a href={redirect} className="text-blue-600 underline">続行</a>
              </p>
              <p className="mt-3 text-xs text-neutral-500">
                本番認証を有効にするには <code className="rounded bg-white px-1 py-0.5">REPO_DRIVER=supabase</code> を設定してください。
              </p>
            </div>
          ) : (
            <LoginButton redirect={redirect} />
          )}
        </div>

        <p className="mt-8 text-xs text-neutral-400">
          サインインすることで利用規約に同意したとみなされます。
        </p>
      </div>
    </main>
  );
}
