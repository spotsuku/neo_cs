import Link from "next/link";
import { TopNavServer } from "@/components/TopNavServer";

// 通知センター
//
// 現状: 専用の通知テーブル (user_notifications 等) を持たないため、空状態を表示する。
// 既存の Slack / メール通知 (lib/notifications/*) は送信側のみで、ユーザー単位の
// inbox は未整備。今後の実装方針:
//   - 案A: VOC アラート / 週次未提出 / 解約予兆 / 更新ウィンドウ突入を集約して動的生成
//   - 案B: user_notifications テーブルを新設し、既読・カテゴリ・リンク先を持たせる
// どちらも本番データ要件が固まってから着手する想定。

type Category = "alert" | "review" | "renewal" | "onboarding" | "mail";

const filters: { key: "all" | "unread" | Category; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "unread", label: "未読のみ" },
  { key: "alert", label: "アラート" },
  { key: "review", label: "週次" },
  { key: "renewal", label: "更新" },
  { key: "onboarding", label: "オンボ" },
  { key: "mail", label: "メール" }
];

export default function NotificationsPage() {
  // 通知データソース未実装のため空配列固定
  const notifications: never[] = [];
  const unreadCount = 0;

  return (
    <>
      <TopNavServer current="/" />
      <main className="mx-auto max-w-[1720px] px-6 py-8 space-y-6">
        <section className="flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-ink-500 font-medium">
              <Link href="/" className="hover:text-ink-700">ホーム</Link>
              <span>/</span>
              <span>通知</span>
            </div>
            <h1 className="mt-1 text-xl font-bold tracking-tight">
              <span className="brand-text-gradient">通知</span>
            </h1>
            <div className="mt-1 text-sm text-ink-500">
              全 {notifications.length} 件 / 未読 {unreadCount} 件
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-4 py-2 rounded-full border border-ink-100 text-sm text-ink-400 cursor-not-allowed"
              disabled
              title="通知データソース未実装"
            >
              すべて既読にする
            </button>
            <Link
              href="/settings/notifications"
              className="px-4 py-2 rounded-full bg-ink-900 text-white text-sm hover:bg-ink-700 shadow-liquid"
            >
              通知設定
            </Link>
          </div>
        </section>

        <section className="liquid-surface p-3">
          <div className="flex flex-wrap items-center gap-1">
            {filters.map((f, i) => (
              <button
                key={f.key}
                className={[
                  "px-3 py-1.5 rounded-full text-xs transition",
                  i === 0
                    ? "bg-ink-900 text-white"
                    : "text-ink-700 hover:bg-ink-50"
                ].join(" ")}
              >
                {f.label}
              </button>
            ))}
          </div>
        </section>

        <section className="liquid-surface p-12 text-center">
          <div className="text-4xl mb-3">🔔</div>
          <p className="text-sm font-medium text-ink-700">
            通知はまだありません
          </p>
          <p className="mt-1 text-xs text-ink-500">
            VOC・週次未提出・解約予兆・更新ウィンドウなどの集約通知は
            <br />
            通知データソース整備後に表示されるようになります
          </p>
        </section>

        <footer className="pt-8 pb-4 text-center text-[11px] text-ink-500">
          NEO CS v2 — 通知
        </footer>
      </main>
    </>
  );
}

