import Link from "next/link";
import { TopNavServer } from "@/components/nav/TopNavServer";

type Category = {
  title: string;
  description: string;
  icon: string;
  accent: string;
};

const categories: Category[] = [
  { title: "使い方ガイド", description: "基本操作・画面遷移・初期セットアップを学ぶ", icon: "📖", accent: "#3D9EFF" },
  { title: "FAQ", description: "よく寄せられる質問と回答", icon: "❓", accent: "#8B5CF6" },
  { title: "リリースノート", description: "新機能・改善・バグ修正の更新履歴", icon: "📝", accent: "#4CD97B" },
  { title: "動画チュートリアル", description: "5分で学べる機能別ショート動画", icon: "🎬", accent: "#FF9838" },
  { title: "ショートカット一覧", description: "作業効率を上げるキーボードショートカット", icon: "⌨️", accent: "#FF6B6B" },
  { title: "お問い合わせ", description: "サポートチームに直接連絡する", icon: "💬", accent: "#06B6D4" }
];

const faqs = [
  { q: "企業のヘルススコアはどう算出されますか?", a: "受講進捗・面談頻度・週次レビュー提出率・契約更新意向の4指標を加重平均しています。設定画面から重み付けを調整できます。" },
  { q: "週次レビューを過去日付で提出できますか?", a: "可能です。週次一覧から該当週を選び「過去提出」モードで入力してください。提出時刻はログに残ります。" },
  { q: "Gmail連携で取り込まれるメールの範囲は?", a: "Gmail連携設定で指定したラベルが付与されたメールのみが対象です。CCやBCCも取り込まれます。" },
  { q: "通知をSlack DMで受け取りたい", a: "設定 > 通知設定 から通知チャンネルを「Slack DM」に変更してください。Slack ID の登録が必要です。" },
  { q: "退職した担当者のアカウントはどうなりますか?", a: "ユーザー管理から「無効化」を行うと、担当案件は引き継ぎ先に自動的にアサインされます。データは保持されます。" }
];

const contactCategories = ["バグ報告", "機能要望", "アカウント・権限", "データ修正", "その他"];

export default function HelpPage() {
  return (
    <>
      <TopNavServer current="/" />
      <main className="mx-auto max-w-[1720px] px-6 py-8 space-y-8">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
          ⚠ ヘルプセンター（検索・カテゴリ・FAQ・問い合わせフォーム・ステータスページ）は UI モックです。本番運用は準備中です。緊急時は support@neoacademia.jp までご連絡ください。
        </div>
        <section>
          <div className="text-xs text-ink-500">
            <Link href="/" className="hover:text-ink-700">ホーム</Link> / ヘルプ
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight">
            <span className="brand-text-gradient">ヘルプ</span>
          </h1>
          <div className="mt-1 text-sm text-ink-500">
            操作方法やトラブルシューティング、サポート窓口をご案内します
          </div>
        </section>

        {/* 検索バー */}
        <section className="liquid-surface p-6">
          <div className="flex items-center gap-3">
            <div className="text-xl">🔍</div>
            <input
              disabled
              className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm bg-ink-50 cursor-not-allowed"
              placeholder="キーワードで検索（準備中）"
            />
            <button
              type="button"
              disabled
              title="準備中"
              className="px-4 py-2 rounded-full bg-ink-300 text-white text-sm whitespace-nowrap cursor-not-allowed"
            >
              検索
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="text-ink-500">よく検索されるキーワード:</span>
            {["週次レビュー", "ヘルススコア", "Gmail連携", "通知設定", "ショートカット"].map((k) => (
              <span
                key={k}
                title="準備中"
                className="px-2 py-0.5 rounded-full bg-ink-50 text-ink-400 cursor-not-allowed"
              >
                {k}
              </span>
            ))}
          </div>
        </section>

        {/* カテゴリカード */}
        <section>
          <h2 className="text-base font-semibold mb-4">カテゴリから探す</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((c) => (
              <div
                key={c.title}
                title="準備中"
                className="liquid-surface p-6 relative overflow-hidden opacity-70 cursor-not-allowed"
              >
                <div
                  className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-10 group-hover:opacity-20 transition"
                  style={{ background: c.accent }}
                />
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                    style={{ background: `${c.accent}14` }}
                  >
                    {c.icon}
                  </div>
                  <div className="text-sm font-semibold">{c.title}</div>
                </div>
                <div className="mt-3 text-xs text-ink-500 leading-relaxed">{c.description}</div>
                <div className="mt-4 text-xs text-ink-400 font-medium">準備中</div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ アコーディオン */}
        <section className="liquid-surface p-6">
          <h2 className="text-base font-semibold mb-4">よくある質問</h2>
          <div className="divide-y divide-ink-100">
            {faqs.map((f, i) => (
              <details key={i} className="py-3 group">
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <span className="text-sm font-medium text-ink-900">Q. {f.q}</span>
                  <span className="text-ink-500 text-xs group-open:rotate-180 transition">▼</span>
                </summary>
                <div className="mt-2 text-xs text-ink-700 leading-relaxed pl-4">A. {f.a}</div>
              </details>
            ))}
          </div>
          <div className="mt-4 text-right">
            <span title="準備中" className="text-xs text-ink-400 font-medium cursor-not-allowed">FAQ一覧をすべて見る（準備中）</span>
          </div>
        </section>

        {/* お問い合わせフォーム + サポート情報 */}
        <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="liquid-surface p-6">
            <h2 className="text-base font-semibold mb-4">お問い合わせ</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-ink-500 font-medium mb-1">件名</label>
                <input className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm" placeholder="例: 週次レビューの提出時にエラーが出る" />
              </div>
              <div>
                <label className="block text-xs text-ink-500 font-medium mb-1">カテゴリ</label>
                <select className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm">
                  {contactCategories.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-ink-500 font-medium mb-1">詳細</label>
                <textarea
                  rows={6}
                  className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm"
                  placeholder="発生している事象、再現手順、期待する動作などをご記入ください"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-500 font-medium mb-1">添付ファイル</label>
                <input type="file" className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm bg-white" />
                <div className="mt-1 text-xs text-ink-500">スクリーンショットやログを添付できます（最大10MB）</div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled
                  title="準備中"
                  className="px-4 py-2 rounded-full border border-ink-100 text-sm text-ink-400 cursor-not-allowed"
                >
                  下書き保存
                </button>
                <button
                  type="button"
                  disabled
                  title="準備中: 問い合わせフォームの送信は別途実装予定。緊急時は support@neoacademia.jp へ"
                  className="px-4 py-2 rounded-full bg-ink-300 text-white text-sm cursor-not-allowed"
                >
                  送信（準備中）
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="liquid-surface p-6">
              <h2 className="text-base font-semibold mb-4">サポート情報</h2>
              <div className="space-y-4 text-sm">
                <div>
                  <div className="text-xs text-ink-500 font-medium">営業時間</div>
                  <div className="mt-1 text-ink-900">平日 10:00 - 18:00</div>
                  <div className="text-xs text-ink-500">土日祝・年末年始を除く</div>
                </div>
                <div className="pt-3 border-t border-ink-100">
                  <div className="text-xs text-ink-500 font-medium">緊急連絡先</div>
                  <a href="mailto:support@neoacademia.jp" className="mt-1 block text-ink-900 hover:text-ink-700 break-all">
                    support@neoacademia.jp
                  </a>
                </div>
                <div className="pt-3 border-t border-ink-100">
                  <div className="text-xs text-ink-500 font-medium">Slack</div>
                  <div className="mt-1 text-ink-900">#cs-support</div>
                  <div className="text-xs text-ink-500">社内向けチャンネル</div>
                </div>
              </div>
            </div>

            <div className="liquid-surface p-6">
              <h2 className="text-base font-semibold mb-3">ステータス</h2>
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="text-ink-900">全システム正常稼働中</span>
              </div>
              <span title="準備中" className="mt-3 inline-block text-xs text-ink-400 font-medium cursor-not-allowed">
                ステータスページを開く（準備中）
              </span>
            </div>
          </div>
        </section>

        <footer className="pt-6 border-t border-ink-100 text-xs text-ink-500 text-center">
          NEO CS v2 — ヘルプ / ダミーデータ
        </footer>
      </main>
    </>
  );
}
