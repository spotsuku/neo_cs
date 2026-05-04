/**
 * /sales-handoff/[id] — 引継ぎ単票詳細
 *
 * 表示:
 *   - 受信ペイロード (jsonb をそのまま整形表示)
 *   - 作成された company / contract / contact / assignment へのリンク
 *   - Slack 通知済 / Drive 自動作成 待ち などのステータス
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { getServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface HandoffDetail {
  id: string;
  sales_deal_id: string;
  company_id: string | null;
  primary_contact_id: string | null;
  contract_id: string | null;
  sales_owner_email: string | null;
  drive_folder_url: string | null;
  payload: Record<string, unknown> | null;
  received_at: string;
  processed_at: string | null;
  status: string;
  error_detail: string | null;
}

async function fetchOne(id: string): Promise<HandoffDetail | null> {
  try {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("sales_handoffs")
      .select(
        "id, sales_deal_id, company_id, primary_contact_id, contract_id, sales_owner_email, drive_folder_url, payload, received_at, processed_at, status, error_detail",
      )
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return data as HandoffDetail;
  } catch {
    return null;
  }
}

export default async function SalesHandoffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const h = await fetchOne(id);
  if (!h) notFound();

  return (
    <>
      <TopNav current="/sales-handoff" />
      <main className="mx-auto max-w-[1100px] px-6 py-8 space-y-6">
        <header className="space-y-1">
          <div className="text-caption text-neutral-500">
            <Link href="/sales-handoff" className="hover:text-neutral-700">
              営業引継ぎ
            </Link>
            <span className="mx-1">/</span>
            <span>{h.sales_deal_id}</span>
          </div>
          <h1 className="text-h1 font-bold text-neutral-900">
            引継ぎ詳細: {h.sales_deal_id}
          </h1>
        </header>

        <section className="rounded-2xl border border-ink-100 bg-white p-6 space-y-3">
          <h2 className="text-lg font-semibold text-ink-900">処理結果</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <dt className="text-ink-500">ステータス</dt>
            <dd className="text-ink-900">{h.status}</dd>
            <dt className="text-ink-500">受信日時</dt>
            <dd className="text-ink-900">{h.received_at}</dd>
            <dt className="text-ink-500">処理完了</dt>
            <dd className="text-ink-900">{h.processed_at ?? "—"}</dd>
            <dt className="text-ink-500">企業</dt>
            <dd>
              {h.company_id ? (
                <Link href={`/companies/${h.company_id}`} className="text-brand-blue hover:underline">
                  {h.company_id}
                </Link>
              ) : (
                "—"
              )}
            </dd>
            <dt className="text-ink-500">契約ID</dt>
            <dd className="text-ink-900">{h.contract_id ?? "—"}</dd>
            <dt className="text-ink-500">主担当 (顧客側)</dt>
            <dd className="text-ink-900">{h.primary_contact_id ?? "—"}</dd>
            <dt className="text-ink-500">営業担当</dt>
            <dd className="text-ink-900">{h.sales_owner_email ?? "—"}</dd>
            <dt className="text-ink-500">Drive フォルダ</dt>
            <dd>
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
                <span className="text-amber-600">
                  未作成 ／ リトライ:{" "}
                  <code className="text-xs">
                    POST /api/integrations/drive/retry/{h.company_id ?? "<companyId>"}
                  </code>
                </span>
              )}
            </dd>
            <dt className="text-ink-500">Slack 通知</dt>
            <dd className="text-ink-900">
              {h.status === "processed" ? "✅ 通知送出済 (#cs-handoff)" : "—"}
            </dd>
          </dl>
          {h.error_detail && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
              <strong>エラー:</strong> {h.error_detail}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-ink-100 bg-white p-6 space-y-3">
          <h2 className="text-lg font-semibold text-ink-900">受信ペイロード</h2>
          <pre className="text-xs bg-ink-50 rounded-xl p-4 overflow-x-auto">
            {JSON.stringify(h.payload, null, 2)}
          </pre>
        </section>
      </main>
    </>
  );
}
