import Link from "next/link";
import { TopNavServer } from "@/components/TopNavServer";

type SyncLog = {
  time: string;
  count: number;
  status: "success" | "warning" | "error";
  note: string;
};

const targetLabels = [
  "顧客対応",
  "週次レビュー",
  "オンボーディング",
  "問い合わせ",
  "更新交渉"
];

const excludeLabels = ["社内通知", "カレンダー招待", "ニュースレター"];

const intervalOptions = ["5分", "15分", "30分", "1時間"];

const aiModels = ["Claude Opus 4.7", "Claude Sonnet 4.6", "Claude Haiku"];

const syncLogs: SyncLog[] = [
  { time: "2026-04-25 09:30", count: 24, status: "success", note: "正常に取り込み完了" },
  { time: "2026-04-25 09:00", count: 18, status: "success", note: "正常に取り込み完了" },
  { time: "2026-04-25 08:30", count: 31, status: "success", note: "正常に取り込み完了" },
  { time: "2026-04-25 08:00", count: 12, status: "warning", note: "2件の企業マッピング失敗" },
  { time: "2026-04-25 07:30", count: 9, status: "success", note: "正常に取り込み完了" },
  { time: "2026-04-25 07:00", count: 0, status: "success", note: "新着メールなし" },
  { time: "2026-04-25 06:30", count: 15, status: "error", note: "API接続エラー（リトライ成功）" },
  { time: "2026-04-25 06:00", count: 22, status: "success", note: "正常に取り込み完了" }
];

const statusBadge = (status: SyncLog["status"]) => {
  if (status === "success") {
    return (
      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
        成功
      </span>
    );
  }
  if (status === "warning") {
    return (
      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
        警告
      </span>
    );
  }
  return (
    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100">
      エラー
    </span>
  );
};

const Chip = ({ label }: { label: string }) => (
  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ink-50 border border-ink-100 text-xs text-ink-700">
    {label}
    <button
      type="button"
      disabled
      title="準備中"
      className="text-ink-300 cursor-not-allowed"
    >
      ×
    </button>
  </span>
);

const Toggle = ({ on }: { on: boolean }) => (
  <button
    type="button"
    disabled
    title="準備中: Gmail 連携の OAuth フローは別途実装予定"
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition cursor-not-allowed opacity-60 ${
      on ? "bg-ink-900" : "bg-ink-100"
    }`}
  >
    <span
      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
        on ? "translate-x-5" : "translate-x-0.5"
      }`}
    />
  </button>
);

export default function GmailSettingsPage() {
  return (
    <>
      <TopNavServer current="/settings" />
      <main className="mx-auto max-w-[1720px] px-6 py-8 space-y-8">
        {/* ヘッダー */}
        <section>
          <div className="text-xs text-ink-500 font-medium">
            <Link href="/settings" className="hover:text-ink-700">
              設定
            </Link>
            <span className="mx-1.5">/</span>
            <span>Gmail連携</span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight">
            <span className="brand-text-gradient">Gmail連携</span>
          </h1>
          <div className="mt-1 text-sm text-ink-500">
            メールの自動取り込みと、AI要約対象とするラベルを設定します
          </div>
        </section>

        {/* 接続状態カード */}
        <section className="liquid-surface p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <div>
                <div className="text-base font-semibold text-ink-900">
                  接続済み: cs-team@neoacademia.jp
                </div>
                <div className="mt-0.5 text-xs text-ink-500">
                  最終同期: 2026-04-25 09:30 ・ 次回同期予定: 2026-04-25 09:45
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 rounded-full border border-ink-100 text-sm text-ink-700 hover:bg-ink-50">
                再認証
              </button>
              <button className="px-4 py-2 rounded-full border border-rose-200 text-sm text-rose-600 hover:bg-rose-50">
                切断
              </button>
            </div>
          </div>
        </section>

        {/* 同期設定フォーム */}
        <section className="liquid-surface p-6 space-y-8">
          <div>
            <div className="text-base font-semibold text-ink-900">同期設定</div>
            <div className="mt-0.5 text-xs text-ink-500">
              Gmailから取得・要約対象とするラベルや動作を設定します
            </div>
          </div>

          {/* 取得対象ラベル */}
          <div>
            <div className="text-sm font-medium text-ink-900 mb-2">取得対象ラベル</div>
            <div className="flex flex-wrap items-center gap-2">
              {targetLabels.map((l) => (
                <Chip key={l} label={l} />
              ))}
              <button className="px-3 py-1 rounded-full border border-dashed border-ink-200 text-xs text-ink-500 hover:bg-ink-50">
                + 追加
              </button>
            </div>
          </div>

          {/* 除外ラベル */}
          <div>
            <div className="text-sm font-medium text-ink-900 mb-2">除外ラベル</div>
            <div className="flex flex-wrap items-center gap-2">
              {excludeLabels.map((l) => (
                <Chip key={l} label={l} />
              ))}
              <button className="px-3 py-1 rounded-full border border-dashed border-ink-200 text-xs text-ink-500 hover:bg-ink-50">
                + 追加
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 同期間隔 */}
            <div>
              <label className="block text-sm font-medium text-ink-900 mb-2">同期間隔</label>
              <select
                defaultValue="15分"
                className="px-3 py-2 rounded-lg border border-ink-100 text-sm w-full"
              >
                {intervalOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-[11px] text-ink-500">
                短い間隔ほどAPI使用量が増加します
              </div>
            </div>

            {/* AI要約モデル */}
            <div>
              <label className="block text-sm font-medium text-ink-900 mb-2">AI要約モデル</label>
              <select
                defaultValue="Claude Opus 4.7"
                className="px-3 py-2 rounded-lg border border-ink-100 text-sm w-full"
              >
                {aiModels.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-[11px] text-ink-500">
                精度とコストのバランスでモデルを選択
              </div>
            </div>
          </div>

          {/* トグル群 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-t border-ink-100">
              <div>
                <div className="text-sm font-medium text-ink-900">自動要約</div>
                <div className="mt-0.5 text-xs text-ink-500">
                  取り込んだメールをAIで自動要約してタイムラインに表示
                </div>
              </div>
              <Toggle on={true} />
            </div>
            <div className="flex items-center justify-between py-3 border-t border-ink-100">
              <div>
                <div className="text-sm font-medium text-ink-900">自動企業マッピング</div>
                <div className="mt-0.5 text-xs text-ink-500">
                  送信元ドメインから企業を自動判定して紐付け
                </div>
              </div>
              <Toggle on={true} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-ink-100">
            <button className="px-4 py-2 rounded-full border border-ink-100 text-sm text-ink-700 hover:bg-ink-50">
              キャンセル
            </button>
            <button className="px-4 py-2 rounded-full bg-ink-900 text-white text-sm hover:bg-ink-700 shadow-liquid">
              設定を保存
            </button>
          </div>
        </section>

        {/* 直近の取り込みログ */}
        <section className="liquid-surface p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-base font-semibold text-ink-900">直近の取り込みログ</div>
              <div className="mt-0.5 text-xs text-ink-500">
                直近8回分の同期実行結果
              </div>
            </div>
            <button className="px-4 py-2 rounded-full border border-ink-100 text-sm text-ink-700 hover:bg-ink-50">
              今すぐ同期
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-500 border-b border-ink-100">
                  <th className="py-2 pr-4 font-medium">時刻</th>
                  <th className="py-2 pr-4 font-medium">件数</th>
                  <th className="py-2 pr-4 font-medium">結果</th>
                  <th className="py-2 pr-4 font-medium">備考</th>
                </tr>
              </thead>
              <tbody>
                {syncLogs.map((log, i) => (
                  <tr key={i} className="border-b border-ink-50 hover:bg-ink-50/50 transition">
                    <td className="py-2.5 pr-4 text-ink-700 tabular-nums">{log.time}</td>
                    <td className="py-2.5 pr-4 text-ink-900 font-medium tabular-nums">
                      {log.count}件
                    </td>
                    <td className="py-2.5 pr-4">{statusBadge(log.status)}</td>
                    <td className="py-2.5 pr-4 text-ink-500 text-xs">{log.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="pt-8 pb-4 text-center text-[11px] text-ink-500">
          NEO CS v2 — Gmail連携 / ダミーデータ
        </footer>
      </main>
    </>
  );
}
