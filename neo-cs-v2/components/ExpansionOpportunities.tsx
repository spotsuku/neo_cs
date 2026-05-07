// エクスパンション機会セクション (ダッシュボード用 Server Component)
// ChurnAlerts と並列配置を想定。score 高い順、kind バッジ付き。

import Link from "next/link";
import { expansionOpportunityRepo, companyRepo } from "@/lib/repository/server";
import { ProductBadge } from "@/components/ProductBadge";
import {
  EXPANSION_KIND_LABEL,
  EXPANSION_RULE_LABEL
} from "@/lib/domain/expansion";

const KIND_BADGE: Record<string, string> = {
  upsell_higher_plan: "bg-info-50 text-info-700 border-info-100",
  cross_sell_other_product: "bg-brand-purple/10 text-brand-purple border-brand-purple/20",
  seat_expansion: "bg-success-50 text-success-700 border-success-100",
  renewal_uplift: "bg-warning-50 text-warning-700 border-warning-100"
};

function yen(v: number): string {
  return `¥${v.toLocaleString("ja-JP")}`;
}

export async function ExpansionOpportunities({ limit = 6 }: { limit?: number }) {
  const [opportunities, companies] = await Promise.all([
    expansionOpportunityRepo.list({ openOnly: true }),
    companyRepo.list()
  ]);
  const companyById = new Map(companies.map((c) => [c.id, c]));

  const top = opportunities.slice(0, limit);
  const totalUpsell = opportunities.reduce(
    (s, o) => s + (o.estimatedUpsellJpy ?? 0),
    0
  );

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-h4 font-semibold text-neutral-900">
          エクスパンション機会 ({opportunities.length} 件)
        </h2>
        <div className="flex items-center gap-3 text-caption">
          <span className="text-neutral-500">
            想定アップセル合計
            <span className="ml-1 text-success-700 font-semibold tabular-nums">
              {yen(totalUpsell)}
            </span>
          </span>
          <Link
            href="/companies"
            className="text-neutral-500 hover:text-neutral-700 focus-ring rounded-sm"
          >
            企業一覧 →
          </Link>
        </div>
      </div>

      <div className="surface overflow-hidden">
        {top.length === 0 ? (
          <div className="p-6 text-center text-body text-neutral-500">
            検知中のエクスパンション機会はありません
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {top.map((op) => {
              const co = companyById.get(op.companyId);
              return (
                <li key={op.id} className="px-4 py-3 hover:bg-neutral-50/60">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <Link
                      href={`/companies/${op.companyId}`}
                      className="text-body font-medium text-neutral-900 hover:underline focus-ring rounded-sm"
                    >
                      {co?.name ?? op.companyId}
                    </Link>
                    <ProductBadge code={op.product} size="sm" />
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-pill border text-caption ${KIND_BADGE[op.kind] ?? ""}`}
                    >
                      {EXPANSION_KIND_LABEL[op.kind]}
                    </span>
                    <span className="text-caption text-neutral-500">
                      {EXPANSION_RULE_LABEL[op.rule]}
                    </span>
                    <span className="ml-auto text-caption text-neutral-500 tabular-nums">
                      score{" "}
                      <span className="font-semibold text-neutral-900">
                        {op.score}
                      </span>
                    </span>
                  </div>
                  <p className="mt-1 text-body text-neutral-700">{op.reason}</p>
                  <div className="mt-1 flex items-baseline gap-3 text-caption text-neutral-500 flex-wrap">
                    <span>推奨: {op.suggestedAction}</span>
                    {op.estimatedUpsellJpy && (
                      <span className="text-success-700">
                        想定 +{yen(op.estimatedUpsellJpy)}
                      </span>
                    )}
                    {op.notifiedAt && (
                      <span className="text-success-700">✓ Slack通知済</span>
                    )}
                    {op.handedOffAt && (
                      <span className="text-info-700">
                        営業引継: {op.handedOffTo}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
