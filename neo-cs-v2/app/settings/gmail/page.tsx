import Link from "next/link";
import { TopNavServer } from "@/components/TopNavServer";
import { userRepo, gmailConnectionRepo } from "@/lib/repository/server";
import { DisconnectButton } from "./DisconnectButton";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ status?: string; error?: string }>;

export default async function GmailSettingsPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const me = await userRepo.getCurrent();
  const connection = me?.id
    ? await gmailConnectionRepo.getByUserId(me.id).catch(() => null)
    : null;

  return (
    <>
      <TopNavServer current="/settings" />
      <main className="mx-auto max-w-[1200px] px-6 py-8 space-y-8">
        <section>
          <div className="text-xs text-ink-500 font-medium">
            <Link href="/settings" className="hover:text-ink-700">
              設定
            </Link>
            <span className="mx-1.5">/</span>
            <span>Gmail 連携</span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight">
            <span className="brand-text-gradient">Gmail 連携</span>
          </h1>
          <div className="mt-1 text-sm text-ink-500">
            自分の Gmail アカウントを接続すると、受信メールから VOC / 顧客対応の
            通知が通知センターに届くようになります
          </div>
        </section>

        {params.status === "connected" && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900">
            ✅ Gmail への接続が完了しました
          </div>
        )}
        {params.error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-900">
            ⚠ 接続に失敗しました: {humanizeError(params.error)}
          </div>
        )}

        <section className="liquid-surface p-6">
          {connection ? (
            <ConnectedView
              email={connection.emailAddress}
              connectedAt={connection.connectedAt}
              lastSyncAt={connection.lastSyncAt}
              lastSyncStatus={connection.lastSyncStatus}
              lastSyncNote={connection.lastSyncNote}
            />
          ) : (
            <NotConnectedView />
          )}
        </section>

        <section className="liquid-surface p-6">
          <div className="text-sm font-semibold text-ink-900 mb-2">
            この連携で取得する権限
          </div>
          <ul className="text-xs text-ink-600 space-y-1 list-disc list-inside">
            <li>
              <code className="text-xs">gmail.readonly</code> — 受信メールの閲覧
              (送信・削除はできません)
            </li>
            <li>
              <code className="text-xs">userinfo.email</code> — 接続したアカウントの
              メールアドレス取得
            </li>
          </ul>
          <div className="mt-3 text-[11px] text-ink-500">
            接続情報 (refresh_token) は本人のみアクセスできるよう RLS で保護されます。
            「切断」を押すと即座に NEO CS から削除されます。
          </div>
        </section>

        <footer className="pt-8 pb-4 text-center text-[11px] text-ink-500">
          NEO CS v2 — Gmail 連携
        </footer>
      </main>
    </>
  );
}

function NotConnectedView() {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-ink-300" />
        <div>
          <div className="text-base font-semibold text-ink-900">未接続</div>
          <div className="mt-0.5 text-xs text-ink-500">
            「Gmail に接続」を押すと Google の同意画面に移動します
          </div>
        </div>
      </div>
      <a
        href="/api/auth/gmail/start"
        className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-ink-900 text-white text-sm hover:bg-ink-700 shadow-liquid"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M22.05 11.23c0-.77-.07-1.5-.2-2.21H12v4.18h5.64c-.24 1.31-.99 2.42-2.11 3.17v2.62h3.41c2-1.84 3.11-4.55 3.11-7.76z"
            fill="#4285F4"
          />
          <path
            d="M12 22c2.86 0 5.26-.95 7.01-2.55l-3.41-2.62c-.95.64-2.16 1.02-3.6 1.02-2.77 0-5.12-1.87-5.96-4.39H2.5v2.7C4.24 19.65 7.86 22 12 22z"
            fill="#34A853"
          />
          <path
            d="M6.04 13.46c-.21-.64-.34-1.32-.34-2.04s.12-1.4.34-2.04v-2.7H2.5C1.7 8.27 1.25 10.07 1.25 12s.45 3.73 1.25 5.32l3.54-2.86z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.57c1.56 0 2.96.54 4.06 1.59l3.03-3.03C17.26 2.4 14.86 1.5 12 1.5 7.86 1.5 4.24 3.85 2.5 7.32l3.54 2.7C6.88 7.44 9.23 5.57 12 5.57z"
            fill="#EA4335"
          />
        </svg>
        Gmail に接続
      </a>
    </div>
  );
}

function ConnectedView({
  email,
  connectedAt,
  lastSyncAt,
  lastSyncStatus,
  lastSyncNote
}: {
  email: string;
  connectedAt: string;
  lastSyncAt?: string;
  lastSyncStatus?: "success" | "warning" | "error";
  lastSyncNote?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
        </span>
        <div>
          <div className="text-base font-semibold text-ink-900">接続済み: {email}</div>
          <div className="mt-0.5 text-xs text-ink-500">
            接続日 {connectedAt.slice(0, 10)}
            {lastSyncAt ? ` ・ 最終同期 ${lastSyncAt.slice(0, 16).replace("T", " ")}` : " ・ 未同期"}
            {lastSyncStatus && lastSyncStatus !== "success" && (
              <span className="ml-2 text-amber-600">
                ({lastSyncStatus}: {lastSyncNote ?? "詳細不明"})
              </span>
            )}
          </div>
          <div className="mt-2 text-[11px] text-ink-500">
            ※ 受信箱の取得バッチは順次有効化予定です。現在は接続情報の保存のみ動作します。
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <a
          href="/api/auth/gmail/start"
          className="px-4 py-2 rounded-full border border-ink-100 text-sm text-ink-700 hover:bg-ink-50"
        >
          再認証
        </a>
        <DisconnectButton />
      </div>
    </div>
  );
}

function humanizeError(code: string): string {
  switch (code) {
    case "access_denied":
      return "Google 側で同意がキャンセルされました";
    case "state_mismatch":
      return "セッションが切れています。もう一度お試しください";
    case "missing_params":
      return "コールバックのパラメータが不足しています";
    case "callback_failed":
      return "トークン交換に失敗しました";
    default:
      return code;
  }
}
