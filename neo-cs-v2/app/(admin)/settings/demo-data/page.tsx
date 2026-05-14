// /settings/demo-data — admin 専用 デモデータ管理ページ
//
// 表示:
//   - is_demo=true な企業一覧 (created_at 新しい順)
//   - 件数サマリー (期間: 24h / 7d / 全期間)
// 操作:
//   - 行ごとの個別削除
//   - 一括削除 ("DELETE-DEMO" 入力 + 強い確認)
//
// CASCADE: 0019_is_demo_flag.sql で contracts → companies を CASCADE 化済。
// その他子テーブル (contacts/stakeholders/onboarding_tasks/...) は 0001 で
// 既に CASCADE。survey 系のみ SET NULL で履歴保持。

import { TopNavServer } from "@/components/nav/TopNavServer";
import Link from "next/link";
import { getRepo } from "@/lib/repository/server";
import { DemoDataPanel } from "./DemoDataPanel";
import { DEFAULT_ORG_ID } from "@/lib/repository/types";

export const dynamic = "force-dynamic";

export default async function DemoDataPage() {
  const repo = getRepo();
  // 全期間 = is_demo=true 全件
  const all = await repo.companies.listDemo({
    organizationId: DEFAULT_ORG_ID,
    range: "all"
  });
  const last7d = await repo.companies.listDemo({
    organizationId: DEFAULT_ORG_ID,
    range: "7d"
  });
  const last24h = await repo.companies.listDemo({
    organizationId: DEFAULT_ORG_ID,
    range: "24h"
  });

  return (
    <>
      <TopNavServer current="/settings" />
      <main className="mx-auto max-w-[1200px] px-6 py-8 space-y-6">
        <div className="text-xs text-ink-500">
          <Link href="/settings" className="hover:text-ink-700">
            設定
          </Link>
          <span className="mx-1">/</span>
          <span>デモデータ管理</span>
        </div>

        <section className="flex items-end justify-between">
          <div>
            <div className="text-xs text-ink-500 font-medium">Admin</div>
            <h1 className="mt-1 text-xl font-bold tracking-tight">
              <span className="brand-text-gradient">🚧 デモデータ管理</span>
            </h1>
            <p className="mt-1 text-sm text-ink-500">
              本番運用開始前のダミーデータ (is_demo=true) を確認 / 一括削除します。
            </p>
          </div>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100">
            Admin限定
          </span>
        </section>

        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 space-y-1">
          <div className="font-semibold">⚠️ 削除前に必ずバックアップしてください</div>
          <div className="text-xs">
            一括削除は CASCADE で関連 (契約 / 担当窓口 / 週次 / オンボ / 健康 /
            個社ToDo / アサイン 等) を巻き込んで物理削除します。
            survey_responses / surveys.contract_id は履歴保持のため SET NULL 化されます。
          </div>
        </section>

        <DemoDataPanel
          companies={all.map((c) => ({
            id: c.id,
            name: c.name,
            industry: c.industry,
            createdAt: c.createdAt ?? null
          }))}
          counts={{
            all: all.length,
            last7d: last7d.length,
            last24h: last24h.length
          }}
        />
      </main>
    </>
  );
}
