// マネージャー drill-down: 今週の週次レビュー未記入企業一覧
//
// クエリ: ?product=academia でフィルタ可能（未指定なら担当事業全部）

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TopNavServer } from "@/components/TopNavServer";
import { getPermissionContext } from "@/lib/auth/server";
import { canSeeManagerView, assignedProductCodes } from "@/lib/auth/permissions";
import { products as allProducts, productByCode } from "@/lib/mock/data";
import {
  contractRepo,
  weeklyReviewRepo,
  companyRepo,
  assignmentRepo,
  userRepo
} from "@/lib/repository/server";
import { CURRENT_WEEK_MONDAY } from "@/lib/mock/weekly";

export const metadata: Metadata = {
  title: "週次未記入 | マネージャー | NEO CS"
};

export default async function MissingWeeklyPage({
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

  const [contracts, weekly, companies, assignments, users] = await Promise.all([
    contractRepo.list({ activeOnly: true }),
    weeklyReviewRepo.list().catch(() => []),
    companyRepo.list(),
    assignmentRepo.list({ activeOnly: true }).catch(() => []),
    userRepo.list({ activeOnly: true })
  ]);

  const companyById = new Map(companies.map((c) => [c.id, c]));
  const userById = new Map(users.map((u) => [u.id, u]));

  // primary 担当者を引く
  const primaryByCompany = new Map<string, string>();
  for (const a of assignments) {
    if (a.role === "primary") primaryByCompany.set(a.companyId, a.userId);
  }

  type Row = {
    companyId: string;
    companyName: string;
    productCode: string;
    productName: string;
    accent: string;
    primaryName: string | null;
  };
  const rows: Row[] = [];
  for (const c of contracts) {
    if (!targetCodes.includes(c.product as string)) continue;
    const reviewed = weekly.some(
      (r) =>
        r.companyId === c.companyId &&
        r.product === c.product &&
        r.weekStart === CURRENT_WEEK_MONDAY
    );
    if (reviewed) continue;
    const product = productByCode[c.product as keyof typeof productByCode];
    const primaryUserId = primaryByCompany.get(c.companyId);
    rows.push({
      companyId: c.companyId,
      companyName: companyById.get(c.companyId)?.name ?? c.companyId,
      productCode: c.product as string,
      productName: product?.shortName ?? c.product,
      accent: product?.accent ?? "#999",
      primaryName: primaryUserId ? userById.get(primaryUserId)?.name ?? null : null
    });
  }

  return (
    <div className="min-h-screen bg-canvas">
      <TopNavServer current="/manager" />
      <main className="mx-auto max-w-[1200px] px-6 py-8 space-y-6">
        <div className="text-xs text-ink-500">
          <Link href="/manager" className="hover:text-ink-700">マネージャー</Link>
          <span className="mx-1.5">/</span>
          <span>週次未記入</span>
        </div>
        <header>
          <h1 className="text-xl font-bold text-ink-900">週次レビュー 未記入企業</h1>
          <p className="mt-1 text-sm text-ink-500">
            {CURRENT_WEEK_MONDAY} 週の未提出 {rows.length} 件
            {productFilter && ` · ${productByCode[productFilter as keyof typeof productByCode]?.name ?? productFilter}`}
          </p>
        </header>

        <section className="rounded-2xl border border-ink-100 bg-white">
          {rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-ink-500">
              未提出の企業はありません
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-ink-50/60 text-[11px] text-ink-500">
                <tr>
                  <th className="text-left font-medium px-4 py-2">企業</th>
                  <th className="text-left font-medium px-4 py-2">事業</th>
                  <th className="text-left font-medium px-4 py-2">主担当</th>
                  <th className="text-right font-medium px-4 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.companyId}-${r.productCode}-${i}`} className="border-t border-ink-100">
                    <td className="px-4 py-2">
                      <Link href={`/companies/${r.companyId}`} className="text-ink-900 hover:underline">
                        {r.companyName}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-700">
                        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: r.accent }} />
                        {r.productName}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-ink-500">{r.primaryName ?? "—"}</td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/weekly?companyId=${r.companyId}&product=${r.productCode}`}
                        className="text-xs text-ink-700 hover:text-ink-900"
                      >
                        記入する →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}
