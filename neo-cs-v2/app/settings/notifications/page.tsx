import Link from "next/link";
import { TopNav } from "@/components/TopNav";

type Rule = {
  id: string;
  enabled: boolean;
  event: string;
  condition: string;
  slackChannel: string;
  emailTo: string;
};

const rules: Rule[] = [
  {
    id: "r1",
    enabled: true,
    event: "企業ヘルスがRedに変化",
    condition: "ヘルススコア < 60",
    slackChannel: "#cs-alerts",
    emailTo: "cs-leads@neoacademia.jp"
  },
  {
    id: "r2",
    enabled: true,
    event: "週次レビュー未提出 (金曜17時)",
    condition: "毎週金曜 17:00 時点で未提出",
    slackChannel: "#cs-weekly",
    emailTo: "cs-team@neoacademia.jp"
  },
  {
    id: "r3",
    enabled: true,
    event: "契約更新60日前",
    condition: "契約終了日 - 60日",
    slackChannel: "#cs-renewal",
    emailTo: "renewal@neoacademia.jp"
  },
  {
    id: "r4",
    enabled: false,
    event: "オンボーディング完了",
    condition: "全ステップ完了時",
    slackChannel: "#cs-onboarding",
    emailTo: "cs-team@neoacademia.jp"
  },
  {
    id: "r5",
    enabled: true,
    event: "新規問い合わせメール受信",
    condition: "Gmail Inbox (問い合わせラベル)",
    slackChannel: "#cs-inbox",
    emailTo: "support@neoacademia.jp"
  },
  {
    id: "r6",
    enabled: true,
    event: "面談24時間前リマインド",
    condition: "面談予定 - 24時間",
    slackChannel: "#cs-meeting",
    emailTo: "cs-team@neoacademia.jp"
  },
  {
    id: "r7",
    enabled: true,
    event: "VOC緊急タグ付与",
    condition: "VOC.priority = urgent",
    slackChannel: "#cs-alerts",
    emailTo: "cs-leads@neoacademia.jp"
  }
];

const slackChannels = [
  "#cs-alerts",
  "#cs-onboarding",
  "#cs-renewal",
  "#cs-weekly",
  "#cs-inbox",
  "#cs-meeting",
  "#cs-general"
];

export default function NotificationsSettingsPage() {
  return (
    <>
      <TopNav current="/settings" />
      <main className="mx-auto max-w-[1400px] px-6 py-8 space-y-8">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
          ⚠ このページは UI モックです。Slack/メール通知ルールの永続化はまだ実装されていません（準備中）。
        </div>
        {/* ヘッダー */}
        <section className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-ink-500 font-medium">
              <Link href="/settings" className="hover:text-ink-700">設定</Link>
              <span className="mx-1.5 text-ink-300">/</span>
              <span>通知設定</span>
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              <span className="brand-text-gradient">通知設定</span>
            </h1>
            <div className="mt-1 text-sm text-ink-500">
              Slack・メール通知の条件とチャンネルを管理します
            </div>
          </div>
          <div className="shrink-0">
            <button
              type="button"
              disabled
              title="準備中"
              className="px-4 py-2 rounded-full bg-ink-300 text-white text-sm cursor-not-allowed"
            >
              テスト送信（準備中）
            </button>
          </div>
        </section>

        {/* 接続チャンネル */}
        <section>
          <h2 className="text-sm font-semibold text-ink-700 mb-3">接続チャンネル</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Slack */}
            <div className="liquid-surface p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                    style={{ background: "#4A154B14" }}
                  >
                    💬
                  </div>
                  <div>
                    <div className="text-base font-semibold text-ink-900">Slack</div>
                    <div className="mt-0.5 text-xs text-ink-500">
                      ワークスペース: <span className="font-medium text-ink-700">neo-academia</span>
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                  接続済み
                </span>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <div className="text-xs text-ink-500">最終同期: 5分前</div>
                <button
                  type="button"
                  disabled
                  title="準備中"
                  className="px-4 py-2 rounded-full border border-ink-100 text-sm text-ink-400 cursor-not-allowed"
                >
                  再接続（準備中）
                </button>
              </div>
            </div>

            {/* メール */}
            <div className="liquid-surface p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                    style={{ background: "#3D9EFF14" }}
                  >
                    ✉️
                  </div>
                  <div>
                    <div className="text-base font-semibold text-ink-900">メール</div>
                    <div className="mt-0.5 text-xs text-ink-500">
                      送信元: <span className="font-medium text-ink-700">cs-noreply@neoacademia.jp</span>
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                  検証済み
                </span>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <div className="text-xs text-ink-500">SPF / DKIM 認証 OK</div>
                <button
                  type="button"
                  disabled
                  title="準備中"
                  className="px-4 py-2 rounded-full border border-ink-100 text-sm text-ink-400 cursor-not-allowed"
                >
                  設定変更（準備中）
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 通知ルール */}
        <section>
          <div className="liquid-surface p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-ink-900">通知ルール</h2>
                <div className="mt-0.5 text-xs text-ink-500">
                  イベントごとの通知条件と配信先を設定します
                </div>
              </div>
              <button
                type="button"
                disabled
                title="準備中"
                className="px-4 py-2 rounded-full bg-ink-300 text-white text-sm cursor-not-allowed"
              >
                + ルールを追加（準備中）
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-500 border-b border-ink-100">
                    <th className="py-2 pr-3 font-medium w-16">ON/OFF</th>
                    <th className="py-2 pr-3 font-medium">イベント</th>
                    <th className="py-2 pr-3 font-medium">条件</th>
                    <th className="py-2 pr-3 font-medium">Slackチャンネル</th>
                    <th className="py-2 pr-3 font-medium">メール宛先</th>
                    <th className="py-2 pr-3 font-medium w-20">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id} className="border-b border-ink-50 hover:bg-ink-50/40">
                      <td className="py-3 pr-3">
                        <button
                          type="button"
                          disabled
                          aria-label="toggle"
                          title="準備中"
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition cursor-not-allowed opacity-60 ${
                            r.enabled ? "bg-emerald-500" : "bg-ink-200"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                              r.enabled ? "translate-x-4" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="font-medium text-ink-900">{r.event}</div>
                      </td>
                      <td className="py-3 pr-3">
                        <span className="text-ink-700">{r.condition}</span>
                      </td>
                      <td className="py-3 pr-3">
                        <select
                          defaultValue={r.slackChannel}
                          className="px-3 py-2 rounded-lg border border-ink-100 text-sm bg-white"
                        >
                          {slackChannels.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 pr-3">
                        <input
                          type="text"
                          defaultValue={r.emailTo}
                          className="px-3 py-2 rounded-lg border border-ink-100 text-sm w-64"
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <span title="準備中" className="text-xs text-ink-300 cursor-not-allowed">
                            編集
                          </span>
                          <span className="text-ink-200">|</span>
                          <span title="準備中" className="text-xs text-rose-300 cursor-not-allowed">
                            削除
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 通知頻度 */}
        <section>
          <div className="liquid-surface p-6">
            <h2 className="text-base font-semibold text-ink-900">通知頻度</h2>
            <div className="mt-0.5 text-xs text-ink-500">
              サマリー配信や同一イベントの抑制間隔を設定します
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-ink-500 font-medium">サマリー配信</label>
                <select
                  defaultValue="daily"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-ink-100 text-sm bg-white"
                >
                  <option value="daily">毎日</option>
                  <option value="weekly">週1</option>
                  <option value="monthly">月1</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-ink-500 font-medium">配信時刻</label>
                <input
                  type="time"
                  defaultValue="09:00"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-ink-100 text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-ink-500 font-medium">同一イベントの抑制</label>
                <select
                  defaultValue="15min"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-ink-100 text-sm bg-white"
                >
                  <option value="5min">5分</option>
                  <option value="15min">15分</option>
                  <option value="1hour">1時間</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
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
                title="準備中"
                className="px-4 py-2 rounded-full bg-ink-300 text-white text-sm cursor-not-allowed"
              >
                保存（準備中）
              </button>
            </div>
          </div>
        </section>

        <footer className="pt-8 pb-4 text-center text-[11px] text-ink-500">
          NEO CS v2 — 通知設定 / ダミーデータ
        </footer>
      </main>
    </>
  );
}
