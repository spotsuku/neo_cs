// 事業別管理ビュー（商材1つ）
//
// productType に応じて2つの UI に分岐:
//   - continuous (academia/hyogikai): 期ごとの参加企業マトリクス + 期間遷移
//   - one_shot (aiken/commu): 回ごとの参加企業・人数・売上・コースアップセル

import { notFound } from "next/navigation";
import Link from "next/link";
import { TopNavServer } from "@/components/TopNavServer";
import { SectionSubNav, BUSINESS_SUBNAV } from "@/components/SectionSubNav";
import { ProductBadge } from "@/components/ProductBadge";
import {
  products,
  productByCode,
  productCourses,
  yen,
  type ProductCode
} from "@/lib/mock/data";
import { allContracts } from "@/lib/mock/onboarding";
import { companies } from "@/lib/mock/entities";
import { ContinuousProductView } from "./ContinuousProductView";
import { OneShotProductView } from "./OneShotProductView";
import { ProductSwitcher } from "@/components/ProductSwitcher";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage(props: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await props.params;
  const product = products.find((p) => p.code === code);
  if (!product) notFound();

  const productCode = product.code as ProductCode;
  const myContracts = allContracts.filter((c) => c.product === productCode);
  const courses = productCourses[productCode] ?? [];

  return (
    <>
      <TopNavServer current="/programs" />
      <SectionSubNav items={BUSINESS_SUBNAV} />
      <main className="mx-auto max-w-[1720px] px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-xs text-ink-500">
            <span>事業別管理</span>
            <span className="mx-2">／</span>
            <span>{product.name}</span>
          </div>
          <ProductSwitcher currentCode={productCode} />
        </div>

        <header className="liquid-surface p-5 relative overflow-hidden">
          <div
            className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-10"
            style={{ background: product.accent }}
          />
          <div className="relative flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2">
                <ProductBadge code={productCode} />
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-ink-50 text-ink-700 border-ink-200">
                  {product.type === "continuous" ? "年間更新型" : "単発回型"}
                </span>
              </div>
              <h1 className="mt-2 text-xl font-bold tracking-tight text-ink-900">
                {product.name}
              </h1>
              <p className="text-xs text-ink-500 mt-1">
                {product.type === "continuous"
                  ? `${product.cycleUnit}ごとの参加企業推移と更新フローを管理`
                  : `${product.cycleUnit}ごとの参加企業・人数・売上・アップセル状況を管理`}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <Stat label="セッション数" value={product.sessionCount?.toString() ?? "—"} />
              {product.billingMonths && (
                <Stat label="課金期間" value={`${product.billingMonths}ヶ月`} />
              )}
              {product.participantCap && (
                <Stat label="参加上限" value={`${product.participantCap}名/社`} />
              )}
              <Stat label="コース数" value={`${courses.length}`} />
            </div>
          </div>
        </header>

        {product.type === "continuous" ? (
          <ContinuousProductView
            productCode={productCode}
            contracts={myContracts}
            companies={companies}
            courses={courses}
            cycleLabelFormat={product.cycleLabelFormat}
            cycleUnit={product.cycleUnit}
          />
        ) : (
          <OneShotProductView
            productCode={productCode}
            contracts={myContracts}
            companies={companies}
            courses={courses}
            cycleLabelFormat={product.cycleLabelFormat}
            cycleUnit={product.cycleUnit}
            accent={product.accent}
          />
        )}
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-ink-50/60 border border-ink-100 px-2.5 py-1.5">
      <div className="text-[10px] text-ink-500">{label}</div>
      <div className="text-sm font-semibold text-ink-900 tabular-nums">
        {value}
      </div>
    </div>
  );
}
