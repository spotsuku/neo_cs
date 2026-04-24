import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { products } from "@/lib/mock/data";

export default function ProductsSettingsPage() {
  return (
    <>
      <TopNav current="/settings" />
      <main className="mx-auto max-w-[1400px] px-6 py-8 space-y-8">
        <section>
          <div className="flex items-center gap-2 text-xs text-ink-500 font-medium">
            <Link href="/settings" className="hover:text-ink-700">設定</Link>
            <span>/</span>
            <span>研修マスタ</span>
          </div>
          <div className="mt-1 flex items-end justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">研修マスタ</h1>
              <div className="mt-1 text-sm text-ink-500">
                4研修の基本情報・契約設定・スケジュールを管理
              </div>
            </div>
            <button className="px-4 py-2 rounded-full bg-ink-900 text-white text-sm hover:bg-ink-700 shadow-liquid">
              + 新規研修を追加
            </button>
          </div>
        </section>

        <section>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {products.map((p) => (
              <div key={p.code} className="liquid-surface p-6 relative overflow-hidden">
                <div
                  className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-10"
                  style={{ background: p.accent }}
                />
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: p.accent }}
                  />
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ color: p.accent, background: `${p.accent}14` }}
                  >
                    {p.type === "continuous" ? "継続型" : "単発型"}
                  </span>
                </div>
                <div className="mt-3 text-lg font-bold" style={{ color: p.accent }}>
                  {p.name}
                </div>
                <div className="text-xs text-ink-500">{p.shortName}</div>

                <dl className="mt-5 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-xs text-ink-500">契約期間</dt>
                    <dd className="text-ink-700 font-medium">
                      {p.billingMonths ? `${p.billingMonths}ヶ月` : "—"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-xs text-ink-500">セッション数</dt>
                    <dd className="text-ink-700 font-medium">
                      {p.sessionCount ? `${p.sessionCount}回` : "—"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-xs text-ink-500">参加枠</dt>
                    <dd className="text-ink-700 font-medium">
                      {p.participantCap ? `${p.participantCap}名/社` : "制限なし"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-5">
                  <Link
                    href={`/settings/products/${p.code}`}
                    className="inline-flex items-center justify-center w-full px-3 py-2 rounded-full border border-ink-100 text-xs text-ink-700 hover:bg-ink-50"
                  >
                    編集
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="pt-8 pb-4 text-center text-[11px] text-ink-500">
          NEO CS v2 — 研修マスタ / ダミーデータ
        </footer>
      </main>
    </>
  );
}
