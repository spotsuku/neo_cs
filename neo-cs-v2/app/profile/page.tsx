import Link from "next/link";
import { TopNav } from "@/components/TopNav";

const teams = ["Team Alpha", "Team Bravo", "Team Charlie", "Team Delta"];
const timezones = ["Asia/Tokyo", "Asia/Seoul", "America/Los_Angeles", "Europe/London"];
const dateFormats = ["YYYY-MM-DD", "YYYY/MM/DD", "MM/DD/YYYY", "DD MMM YYYY"];
const languages = ["日本語", "English"];

export default function ProfilePage() {
  return (
    <>
      <TopNav current="/" />
      <main className="mx-auto max-w-[1400px] px-6 py-8 space-y-8">
        <section className="flex items-end justify-between gap-4">
          <div>
            <div className="text-xs text-ink-500">
              <Link href="/" className="hover:text-ink-700">ホーム</Link> / プロフィール
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              <span className="brand-text-gradient">プロフィール</span>
            </h1>
            <div className="mt-1 text-sm text-ink-500">
              アカウント情報・業務設定・セキュリティを管理します
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled
              title="準備中"
              className="px-4 py-2 rounded-full border border-ink-100 text-sm text-ink-400 cursor-not-allowed"
            >
              キャンセル
            </button>
            <button
              type="button"
              disabled
              title="準備中: プロフィール編集機能は別途実装予定"
              className="px-4 py-2 rounded-full bg-ink-300 text-white text-sm cursor-not-allowed"
            >
              変更を保存（準備中）
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* 左カラム */}
          <div className="liquid-surface p-6 flex flex-col items-center text-center">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 text-white text-5xl font-bold flex items-center justify-center shadow-liquid">
              古
            </div>
            <div className="mt-4 text-lg font-semibold">古野 健太</div>
            <div className="mt-1 text-xs text-ink-500">k_furuno@sportsnation.jp</div>
            <span className="mt-3 inline-flex items-center px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-medium">
              Admin
            </span>
            <button
              type="button"
              disabled
              title="準備中"
              className="mt-5 px-4 py-2 rounded-full border border-ink-100 text-sm text-ink-400 cursor-not-allowed w-full"
            >
              アバターを変更（準備中）
            </button>
            <div className="mt-6 w-full pt-4 border-t border-ink-100 text-left space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-ink-500">入社</span>
                <span className="text-ink-700">2023-04-01</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-ink-500">社員番号</span>
                <span className="text-ink-700">EMP-00821</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-ink-500">最終ログイン</span>
                <span className="text-ink-700">2026-04-25 09:12</span>
              </div>
            </div>
          </div>

          {/* 右カラム */}
          <div className="space-y-6">
            {/* 基本情報 */}
            <div className="liquid-surface p-6">
              <h2 className="text-base font-semibold mb-4">基本情報</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-ink-500 font-medium mb-1">氏名</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm" defaultValue="古野 健太" />
                </div>
                <div>
                  <label className="block text-xs text-ink-500 font-medium mb-1">カナ</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm" defaultValue="フルノ ケンタ" />
                </div>
                <div>
                  <label className="block text-xs text-ink-500 font-medium mb-1">メール</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm" defaultValue="k_furuno@sportsnation.jp" />
                </div>
                <div>
                  <label className="block text-xs text-ink-500 font-medium mb-1">電話</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm" defaultValue="090-1234-5678" />
                </div>
                <div>
                  <label className="block text-xs text-ink-500 font-medium mb-1">Slack ID</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm" defaultValue="@k_furuno" />
                </div>
                <div>
                  <label className="block text-xs text-ink-500 font-medium mb-1">役職</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm" defaultValue="CSマネージャー" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-ink-500 font-medium mb-1">部署</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm" defaultValue="カスタマーサクセス本部 / CS第1グループ" />
                </div>
              </div>
            </div>

            {/* 業務設定 */}
            <div className="liquid-surface p-6">
              <h2 className="text-base font-semibold mb-4">業務設定</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-ink-500 font-medium mb-1">担当チーム</label>
                  <select className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm">
                    {teams.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-ink-500 font-medium mb-1">タイムゾーン</label>
                  <select className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm" defaultValue="Asia/Tokyo">
                    {timezones.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-ink-500 font-medium mb-1">日付フォーマット</label>
                  <select className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm">
                    {dateFormats.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-ink-500 font-medium mb-1">言語</label>
                  <select className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm" defaultValue="日本語">
                    {languages.map((l) => <option key={l}>{l}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* セキュリティ */}
            <div className="liquid-surface p-6">
              <h2 className="text-base font-semibold mb-4">セキュリティ</h2>
              <div className="space-y-5">
                <div>
                  <div className="text-sm font-medium mb-2">パスワード変更</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-ink-500 font-medium mb-1">現在のパスワード</label>
                      <input type="password" className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm" placeholder="••••••••" />
                    </div>
                    <div>
                      <label className="block text-xs text-ink-500 font-medium mb-1">新しいパスワード</label>
                      <input type="password" className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm" placeholder="••••••••" />
                    </div>
                    <div>
                      <label className="block text-xs text-ink-500 font-medium mb-1">確認</label>
                      <input type="password" className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm" placeholder="••••••••" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-ink-100">
                  <div>
                    <div className="text-sm font-medium">2段階認証</div>
                    <div className="text-xs text-ink-500 mt-0.5">ログイン時にワンタイムコードを要求します</div>
                  </div>
                  <label className="inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-ink-100 rounded-full peer peer-checked:bg-ink-900 relative after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:w-5 after:h-5 after:transition peer-checked:after:translate-x-5"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-ink-100">
                  <div>
                    <div className="text-sm font-medium">APIトークン</div>
                    <div className="text-xs text-ink-500 mt-0.5">外部連携用のアクセストークンを発行します</div>
                  </div>
                  <button
                    type="button"
                    disabled
                    title="準備中"
                    className="px-4 py-2 rounded-full border border-ink-100 text-sm text-ink-400 cursor-not-allowed"
                  >
                    トークンを発行（準備中）
                  </button>
                </div>
              </div>
            </div>

            {/* アクティビティサマリー */}
            <div className="liquid-surface p-6">
              <h2 className="text-base font-semibold mb-4">アクティビティサマリー</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-ink-50">
                  <div className="text-xs text-ink-500">担当企業</div>
                  <div className="mt-1 text-2xl font-bold">12<span className="text-sm font-medium text-ink-500 ml-1">社</span></div>
                </div>
                <div className="p-4 rounded-xl bg-ink-50">
                  <div className="text-xs text-ink-500">本日タスク</div>
                  <div className="mt-1 text-2xl font-bold">3<span className="text-sm font-medium text-ink-500 ml-1">件</span></div>
                </div>
                <div className="p-4 rounded-xl bg-ink-50">
                  <div className="text-xs text-ink-500">未提出週次</div>
                  <div className="mt-1 text-2xl font-bold">2<span className="text-sm font-medium text-ink-500 ml-1">件</span></div>
                </div>
                <div className="p-4 rounded-xl bg-ink-50">
                  <div className="text-xs text-ink-500">最終ログイン</div>
                  <div className="mt-1 text-sm font-semibold">2026-04-25<br />09:12</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="pt-6 border-t border-ink-100 text-xs text-ink-500 text-center">
          NEO CS v2 — プロフィール / ダミーデータ
        </footer>
      </main>
    </>
  );
}
