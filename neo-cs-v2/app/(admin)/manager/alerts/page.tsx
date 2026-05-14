// マネージャー drill-down: 未対応 churn シグナル一覧
// クエリ: ?product=academia でフィルタ

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TopNavServer } from "@/components/nav/TopNavServer";
import { getPermissionContext } from "@/lib/auth/server";
import { canSeeManagerView, assignedProductCodes } from "@/lib/auth/permissions";
import { products as allProducts, productByCode } from "@/lib/mock/data";
import { contractRepo, churnSignalRepo, companyRepo } from "@/lib/repository/server";

export const metadata: Metadata = {
  title: "アラート | マネージャー | NEO CS"
};

const SEVERITY_TONE: Record<string, string> = {
  high: "bg-rose-100 text-rose-700 border-rose-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-ink-100 text-ink-600 border-ink-200"
};

export default async function AlertsPage({
  searchParams
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const ctx = await getPermissionContext();
  if (!canSeeManagerView(ctx)) redirect("/");

  const { product: productFilter } = await searchParams;

  const myProductCodes =
    ctx.actor?.role === "admin"
      ? allProducts.map((p) => p.code as string)
      : assignedProductCodes(ctx);

  const targetCodes = productFilter
    ? myProductCodes.filter((c) => c === productFilter)
    : myProductCodes;

  const [contracts, signals, companies] = await Promise.all([
    contractRepo.list({ activeOnly: true }),
    churnSignalRepo.list({ unresolvedOnly: true }).catch(() => []),
    companyRepo.list()
  ]);

  const companyById = new Map(companies.map((c) => [c.id, c]));
  const contractById = new Map(contracts.map((c) => [c.id, c]));

  const filtered = signals
    .filter((s) => {
      const c = contractById.get(s.contractId);
      if (!c) return false;
      return targetCodes.includes(c.product as string);
    })
    .sort((a, b) => {
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
      const da = order[a.severity] ?? 3;
      const db = order[b.severity] ?? 3;
      if (da !== db) return da - db;
      return (b.detectedAt ?? "").localeCompare(a.detectedAt ?? "");
    });

  return (
    <div className="min-h-screen bg-canvas">
      <TopNavServer current="/manager" />
      <main className="mx-auto max-w-[1200px] px-6 py-8 space-y-6">
        <div className="text-xs text-ink-500">
          <Link href="/manager" className="hover:text-ink-700">マネージャー</Link>
          <span className="mx-1.5">/</span>
          <span>アラート</span>
        </div>
        <header>
          <h1 className="text-xl font-bold text-ink-900">未対応アラート</h1>
          <p className="mt-1 text-sm text-ink-500">
            未解決の churn シグナル {filtered.length} 件
            {productFilter && ` · ${productByCode[productFilter as keyof typeof productByCode]?.name ?? productFilter}`}
          </p>
        </header>

        <section className="rounded-2xl border border-ink-100 bg-white">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-ink-500">
              未対応アラートはありません
            </div>
          ) : (
            <ul className="divide-y divide-ink-100">
              {filtered.map((s) => {
                const company = companyById.get(s.companyId);
                const contract = contractById.get(s.contractId);
                const product = contract
                  ? productByCode[contract.product as keyof typeof productByCode]
                  : null;
                return (
                  <li key={s.id} className="px-4 py-3 flex items-center gap-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-medium ${SEVERITY_TONE[s.severity] ?? ""}`}
                    >
                      {s.severity}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/companies/${s.companyId}`}
                        className="block text-sm text-ink-900 hover:underline truncate font-medium"
                      >
                        {company?.name ?? s.companyId}
                      </Link>
                      <div className="text-[11px] text-ink-500 truncate">
                        {s.rule}
                        {product && <> · <span style={{ color: product.accent }}>{product.shortName}</span></>}
                      </div>
                    </div>
                    <span className="text-[10px] text-ink-500 shrink-0">
                      {s.detectedAt?.slice(0, 10)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
