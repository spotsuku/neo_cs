import Link from "next/link";
import { TopNavServer } from "@/components/TopNavServer";

type Category = "alert" | "review" | "renewal" | "onboarding" | "mail";

type Notification = {
  id: string;
  category: Category;
  title: string;
  body: string;
  time: string;
  href: string;
  unread: boolean;
};

const notifications: Notification[] = [
  { id: "n1", category: "alert", title: "イオン九州がRedに変化", body: "契約終了60日前・更新未確定。担当: 古野", time: "10分前", href: "/companies/c-aeon", unread: true },
  { id: "n2", category: "review", title: "週次レビュー未提出 (3社)", body: "金曜17時の締切までに残り3社が未提出です", time: "1時間前", href: "/weekly", unread: true },
  { id: "n3", category: "renewal", title: "九州旅客鉄道 更新60日前", body: "アカデミア研修の更新打診タイミングです", time: "本日 09:30", href: "/companies/c-jrq", unread: true },
  { id: "n4", category: "mail", title: "新着メール: 西日本鉄道", body: "「次回定例の日程調整について」が届きました", time: "本日 08:14", href: "/companies/c-nishitetsu", unread: true },
  { id: "n5", category: "onboarding", title: "TOTO株式会社 オンボーディング完了", body: "全6ステップ完了。フォローアップ面談を設定推奨", time: "昨日 17:42", href: "/onboarding", unread: true },
  { id: "n6", category: "alert", title: "ふくおかフィナンシャル 緊急タグ", body: "VOCに『更新見送り検討中』のタグが付与されました", time: "昨日 15:08", href: "/companies/c-ffg", unread: true },
  { id: "n7", category: "review", title: "週次レビューAI要約が更新されました", body: "今週分のサマリーをご確認ください", time: "昨日 12:00", href: "/weekly", unread: true },
  { id: "n8", category: "renewal", title: "ヤマエGHD 更新合意", body: "次年度継続が確定しました（金額: 24M）", time: "2日前", href: "/companies/c-yamae", unread: false },
  { id: "n9", category: "mail", title: "新着メール: 九電工", body: "「請求書送付のご連絡」が届きました", time: "2日前", href: "/companies/c-kyudenko", unread: false },
  { id: "n10", category: "alert", title: "福岡銀行 ヘルススコア低下", body: "Yellow → Red 寸前。最終接点42日前", time: "3日前", href: "/companies/c-fukugin", unread: false },
  { id: "n11", category: "onboarding", title: "西日本シティ銀行 キックオフMTG完了", body: "次のステップ: 事前アンケート送付", time: "3日前", href: "/onboarding", unread: false },
  { id: "n12", category: "review", title: "全社週次レビュー集計完了", body: "今週: 提出24社 / 未提出3社", time: "4日前", href: "/weekly", unread: false }
];

const categoryStyle: Record<Category, { label: string; color: string; bg: string }> = {
  alert: { label: "アラート", color: "#EF4444", bg: "#FEE2E2" },
  review: { label: "週次", color: "#3D9EFF", bg: "#DBEAFE" },
  renewal: { label: "更新", color: "#8B5CF6", bg: "#EDE9FE" },
  onboarding: { label: "オンボ", color: "#4CD97B", bg: "#DCFCE7" },
  mail: { label: "メール", color: "#FF9838", bg: "#FFEDD5" }
};

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
  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <>
      <TopNavServer current="/" />
      <main className="mx-auto max-w-[1400px] px-6 py-8 space-y-6">
        <section className="flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-ink-500 font-medium">
              <Link href="/" className="hover:text-ink-700">ホーム</Link>
              <span>/</span>
              <span>通知</span>
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              <span className="brand-text-gradient">通知</span>
            </h1>
            <div className="mt-1 text-sm text-ink-500">
              全 {notifications.length} 件 / 未読 {unreadCount} 件
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 rounded-full border border-ink-100 text-sm text-ink-700 hover:bg-ink-50">
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

        <section className="liquid-surface overflow-hidden">
          <ul className="divide-y divide-ink-50">
            {notifications.map((n) => {
              const style = categoryStyle[n.category];
              return (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    className={[
                      "flex items-start gap-4 px-5 py-4 hover:bg-ink-50 transition",
                      n.unread ? "bg-white" : "bg-ink-50/30"
                    ].join(" ")}
                  >
                    <span
                      className="mt-0.5 inline-flex shrink-0 items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{ color: style.color, background: style.bg }}
                    >
                      {style.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-ink-900 truncate">
                          {n.title}
                        </span>
                        {n.unread && (
                          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-brand-pink" />
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-ink-500">{n.body}</div>
                    </div>
                    <div className="shrink-0 text-[11px] text-ink-500 whitespace-nowrap">
                      {n.time}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <footer className="pt-8 pb-4 text-center text-[11px] text-ink-500">
          NEO CS v2 — 通知 / ダミーデータ
        </footer>
      </main>
    </>
  );
}
