import { TopNavServer } from '@/components/TopNavServer';
import { CONSENT_ITEMS, CURRENT_POLICY_VERSION } from '@/lib/consents/registry';
import { ConsentRow } from './ConsentRow';

export const dynamic = 'force-dynamic';

export default function ConsentsPage() {
  return (
    <>
      <TopNavServer current="/settings" />
      <main className="mx-auto max-w-[960px] px-6 py-8 space-y-6">
        <header>
          <div className="text-xs text-ink-500 font-medium">/ 設定 / 利用同意・データ取扱い</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">
            利用同意・データ取扱いの記録
          </h1>
          <p className="mt-2 text-sm text-ink-600 leading-relaxed">
            個人情報保護法・GDPR 対応のため、組織として明示同意が必要な項目をここで管理します。
            ポリシーバージョン更新時 (現行 <code className="px-1 py-0.5 rounded bg-ink-100">{CURRENT_POLICY_VERSION}</code>) は再同意が必要です。
            撤回は <strong>即時反映</strong> され、撤回後は該当目的でのデータ利用を停止します。
          </p>
        </header>

        <section className="space-y-3">
          {CONSENT_ITEMS.map((item) => (
            <ConsentRow key={item.type} item={item} />
          ))}
        </section>

        <footer className="pt-6 text-[11px] text-ink-500">
          ここで記録された同意は <code>consent_records</code> テーブルに保存され、付与・撤回は <code>audit_logs</code> に追記されます。
        </footer>
      </main>
    </>
  );
}
