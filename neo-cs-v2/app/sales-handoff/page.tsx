/**
 * /sales-handoff — 営業 (neo-sales) → CS 引継ぎ受信履歴一覧
 *
 * admin / manager のみ閲覧可。RLS により他ロールは select 0件になる。
 *
 * 表示:
 *   - 受信日時 (新しい順)
 *   - 企業名 / プロダクト / status / Drive URL (Phase4-#5 で埋まる placeholder)
 *   - status='failed' は赤強調 (オペレーター手動再投入の対象)
 */

import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { getServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = { status?: string };

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  received: { label: "受信", color: "bg-neutral-100 text-neutral-700" },
  processed: { label: "処理済", color: "bg-emerald-100 text-emerald-700" },
  failed: { label: "失敗", color: "bg-rose-100 text-rose-700" },
  duplicate: { label: "重複", color: "bg-amber-100 text-amber-700" },
};

interface HandoffRow {
  id: string;
  sales_deal_id: string;
  company_id: string | null;
  contract_id: string | null;
  sales_owner_email: string | null;
  drive_folder_url: string | null;
  status: string;
  received_at: string;
  processed_at: string | null;
  payload: { company?: { name?: string }; contract?: { productCode?: string } } | null;
}

async function fetchHandoffs(status?: string): Promise<HandoffRow[]> {
  try {
    const sb = getServiceClient();
    let q = sb
      .from("sales_handoffs")
      .select(
        "id, sales_deal_id, company_id, contract_id, sales_owner_email, drive_folder_url, status, received_at, processed_at, payload",
      )
      .order("received_at", { ascending: false })
      .limit(200);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) {
      // sales_handoffs テーブルが migration 未適用の可能性
      return [];
    }
    return (data ?? []) as HandoffRow[];
  } catch {
    return [];
  }
}

export default async function SalesHandoffPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const status = sp.status;
  const items = await fetchHandoffs(status);

  return (
    <>
      <TopNav current="/sales-handoff" />
      <main className="mx-auto max-w-[1400px] px-6 py-8 space-y-6">
        <header className="space-y-1">
          <div className="text-caption text-neutral-500">
            <Link href="/" className="hover:text-neutral-700">
              ダッシュボード
            </Link>
            <span className="mx-1">/</span>
            <span>営業引継ぎ</span>
          </div>
          <h1 className="text-h1 font-bold text-neutral-900">営業引継ぎ受信履歴</h1>
          <p className="text-body text-neutral-500">
            neo-sales から webhook で受信した内諾済 deal の処理結果。Drive
            自動作成は Phase4-#5 で実装予定。
          </p>
        </header>

        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/sales-handoff"
            className={`px-3 py-1 rounded-full border ${!status ? "bg-ink-900 text-white border-ink-900" : "border-ink-100 text-ink-700 hover:bg-ink-50"}`}
          >
            すべて
          </Link>
          {(["received", "processed", "failed", "duplicate"] as const).map((s) => (
            <Link
              key={s}
              href={`/sales-handoff?status=${s}`}
              className={`px-3 py-1 rounded-full border ${status === s ? "bg-ink-900 text-white border-ink-900" : "border-ink-100 text-ink-700 hover:bg-ink-50"}`}
            >
              {STATUS_LABEL[s]?.label ?? s}
            </Link>
          ))}
        </nav>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-ink-100 bg-white p-8 text-center text-sm text-ink-500">
            該当する引継ぎはありません。
            <br />
            (migration 0017_sales_handoffs.sql 未適用 or webhook 未着信)
          </div>
        ) : (
          <div className="rounded-2xl border border-ink-100 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-700">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">受信日時</th>
                  <th className="text-left px-4 py-2 font-medium">企業</th>
                  <th className="text-left px-4 py-2 font-medium">プロダクト</th>
                  <th className="text-left px-4 py-2 font-medium">営業担当</th>
                  <th className="text-left px-4 py-2 font-medium">Drive</th>
                  <th className="text-left px-4 py-2 font-medium">ステータス</th>
                  <th className="text-left px-4 py-2 font-medium">詳細</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {items.map((h) => {
                  const meta = STATUS_LABEL[h.status] ?? {
                    label: h.status,
                    color: "bg-neutral-100 text-neutral-700",
                  };
                  const companyName = h.payload?.company?.name ?? "—";
                  const product = h.payload?.contract?.productCode ?? "—";
                  return (
                    <tr key={h.id} className="hover:bg-ink-50/50">
                      <td className="px-4 py-2 text-ink-700 whitespace-nowrap">
                        {formatJst(h.received_at)}
                      </td>
                      <td className="px-4 py-2 text-ink-900">
                        {h.company_id ? (
                          <Link href={`/companies/${h.company_id}`} className="hover:underline">
                            {companyName}
                          </Link>
                        ) : (
                          companyName
                        )}
                      </td>
                      <td className="px-4 py-2 text-ink-700">{product}</td>
                      <td className="px-4 py-2 text-ink-500 text-xs">
                        {h.sales_owner_email ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {h.drive_folder_url ? (
                          <a
                            href={h.drive_folder_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-blue hover:underline"
                          >
                            開く
                          </a>
                        ) : (
                          <span className="text-amber-600">自動作成 待ち</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[11px] ${meta.color}`}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs">
                        <Link
                          href={`/sales-handoff/${h.id}`}
                          className="text-ink-700 hover:underline"
                        >
                          詳細 →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}

function formatJst(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  } catch {
    return iso;
  }
}
