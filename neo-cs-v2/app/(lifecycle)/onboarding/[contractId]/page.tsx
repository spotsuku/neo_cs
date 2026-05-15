import { notFound } from "next/navigation";
import Link from "next/link";
import { TopNavServer } from "@/components/nav/TopNavServer";
import { ProductBadge } from "@/components/contract/ProductBadge";
// コース表示に対応
import { productByCode, yen, hasMultipleCourses, courseName } from "@/lib/master";
import {
  productOnboardingTemplates,
  daysUntilStart,
  filterTemplateByCourse
} from "@/lib/mock/onboarding";
import {
  onboardingItemRepo,
  userRepo,
  contractRepo,
  companyRepo
} from "@/lib/repository/server";
import { ChecklistView } from "./ChecklistView";

export const dynamic = "force-dynamic";

export default async function ContractOnboardingPage({
  params
}: {
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = await params;
  const contract = await contractRepo.getById(contractId);
  if (!contract) return notFound();

  const company = await companyRepo.getById(contract.companyId);
  const product = productByCode[contract.product];
  // 契約の courseKey に該当する項目（＋全コース共通）だけを表示
  const template = filterTemplateByCourse(
    productOnboardingTemplates[contract.product],
    contract.courseKey
  );
  const [items, users] = await Promise.all([
    onboardingItemRepo.listByContractIds([contract.id]),
    userRepo.list({ activeOnly: true })
  ]);
  // 進捗は items から再計算 (期限切れ判定もこちらで)
  const today = new Date().toISOString().slice(0, 10);
  const prog = (() => {
    let done = 0;
    let overdue = 0;
    let total = 0;
    for (const i of items) {
      if (i.status === "not_applicable") continue;
      total++;
      if (i.status === "done") done++;
      if (
        (i.status === "todo" || i.status === "doing" || i.status === "overdue") &&
        i.dueDate &&
        i.dueDate < today
      ) {
        overdue++;
      }
    }
    return { done, overdue, total };
  })();
  const days = daysUntilStart(contract.startDate);
  const overdueDays = days < 0;

  return (
    <>
      <TopNavServer current="/onboarding" />
      <main className="mx-auto max-w-[1100px] px-6 py-8 space-y-6">
        {/* パンくず */}
        <div className="text-xs text-ink-500">
          <Link href="/onboarding" className="hover:text-ink-700">
            オンボ
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-ink-700">
            {company?.name ?? contract.companyId}
          </span>
          <span className="mx-1.5">/</span>
          <span className="text-ink-700">{product.shortName}</span>
        </div>

        {/* ヘッダ */}
        <section className="liquid-surface relative overflow-hidden p-6">
          <div
            className="absolute -top-16 -right-10 w-52 h-52 rounded-full opacity-10"
            style={{ background: product.accent }}
          />
          <div className="relative flex items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-ink-900">
                  {company?.name ?? contract.companyId}
                </h1>
                <ProductBadge code={contract.product} />
                {hasMultipleCourses(contract.product) && (
                  <span
                    className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{
                      color: product.accent,
                      background: `${product.accent}14`,
                      border: `1px solid ${product.accent}33`
                    }}
                  >
                    {courseName(contract.product, contract.courseKey)}
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-500">
                <span>
                  契約開始日{" "}
                  <span className="text-ink-700 font-medium">
                    {contract.startDate.replace(/-/g, "/")}
                  </span>
                </span>
                <span
                  className={[
                    "font-medium",
                    overdueDays
                      ? "text-rose-500"
                      : days <= 7
                      ? "text-amber-600"
                      : "text-ink-700"
                  ].join(" ")}
                >
                  {overdueDays
                    ? `開始超過 ${Math.abs(days)}日`
                    : days === 0
                    ? "本日開始"
                    : `残 ${days}日`}
                </span>
                <span>
                  担当{" "}
                  <span className="text-ink-700 font-medium">
                    {contract.ownerName}
                  </span>
                </span>
                <span>
                  参加者{" "}
                  <span className="text-ink-700 font-medium">
                    {contract.participants}名
                  </span>
                </span>
                {contract.mrr !== undefined && (
                  <span>
                    MRR{" "}
                    <span className="text-ink-700 font-medium">
                      {yen(contract.mrr)}
                    </span>
                  </span>
                )}
                {contract.revenue !== undefined && (
                  <span>
                    Revenue{" "}
                    <span className="text-ink-700 font-medium">
                      {yen(contract.revenue)}
                    </span>
                  </span>
                )}
              </div>

              {/* 全体進捗 */}
              <div className="mt-5 max-w-md">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-ink-500">全体進捗</span>
                  <span className="text-ink-900 font-semibold">
                    {prog.done}/{prog.total} 完了
                    {prog.overdue > 0 && (
                      <span className="ml-2 text-rose-500">
                        / 期日超過 {prog.overdue}件
                      </span>
                    )}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-ink-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${
                        prog.total > 0 ? (prog.done / prog.total) * 100 : 0
                      }%`,
                      background: product.accent
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="shrink-0">
              <Link
                href={`/settings/products/${contract.product}`}
                className="px-4 py-2 rounded-full bg-white border border-ink-100 text-sm text-ink-700 shadow-liquid hover:bg-ink-50"
              >
                テンプレを編集
              </Link>
            </div>
          </div>
        </section>

        {/* チェックリスト（カテゴリごと） */}
        <ChecklistView
          contractId={contract.id}
          template={template}
          items={items}
          accent={product.accent}
          users={users.map((u) => ({ id: u.id, name: u.name }))}
          today={today}
        />

        <footer className="pt-8 pb-4 text-center text-[11px] text-ink-500">
          NEO CS v2 — 契約別オンボチェックリスト
        </footer>
      </main>
    </>
  );
}
