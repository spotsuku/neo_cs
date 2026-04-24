import Link from "next/link";
import { TopNav } from "@/components/TopNav";

type MenuItem = {
  href: string;
  title: string;
  description: string;
  icon: string;
  accent: string;
  adminOnly?: boolean;
};

const menu: MenuItem[] = [
  {
    href: "/settings/products",
    title: "研修マスタ",
    description: "4研修の基本情報・契約設定・面談スケジュールを管理",
    icon: "📚",
    accent: "#3D9EFF"
  },
  {
    href: "/settings/users",
    title: "ユーザー管理",
    description: "CS担当者・権限ロールの設定",
    icon: "👥",
    accent: "#8B5CF6",
    adminOnly: true
  },
  {
    href: "/settings/gmail",
    title: "Gmail連携",
    description: "メール自動取り込み・要約対象のラベル設定",
    icon: "✉️",
    accent: "#4CD97B"
  },
  {
    href: "/settings/notifications",
    title: "通知設定",
    description: "Slack・メール通知の条件とチャンネル",
    icon: "🔔",
    accent: "#FF9838"
  }
];

export default function SettingsPage() {
  return (
    <>
      <TopNav current="/settings" />
      <main className="mx-auto max-w-[1400px] px-6 py-8 space-y-8">
        <section>
          <div className="text-xs text-ink-500 font-medium">NEO CS 管理</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            <span className="brand-text-gradient">設定</span>
          </h1>
          <div className="mt-1 text-sm text-ink-500">
            システム全体の設定を管理します
          </div>
        </section>

        <section>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {menu.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className="liquid-surface p-6 relative overflow-hidden hover:shadow-liquid-lg transition group"
              >
                <div
                  className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-10 group-hover:opacity-20 transition"
                  style={{ background: m.accent }}
                />
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                      style={{ background: `${m.accent}14` }}
                    >
                      {m.icon}
                    </div>
                    <div>
                      <div className="text-base font-semibold text-ink-900">{m.title}</div>
                      <div className="mt-0.5 text-xs text-ink-500">{m.description}</div>
                    </div>
                  </div>
                  {m.adminOnly && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100">
                      Admin限定
                    </span>
                  )}
                </div>
                <div className="mt-6 text-xs text-ink-500 group-hover:text-ink-700 transition">
                  開く →
                </div>
              </Link>
            ))}
          </div>
        </section>

        <footer className="pt-8 pb-4 text-center text-[11px] text-ink-500">
          NEO CS v2 — 設定 / ダミーデータ
        </footer>
      </main>
    </>
  );
}
