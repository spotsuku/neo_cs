// 経営ダッシュボード「全社 Inner Rings 総覧」セクション (Server Component)。
//
// buildCommunityOverview() の出力を受け取り、以下を表示する:
//   1. 上段: tier 別 stakeholder 件数の 4 タイル (core / active / casual / at_risk)
//   2. 中段: 「昇格候補」リスト と 「離脱危機企業」リスト (各行 → /companies/[id])
//
// State を持たないので Server Component とする。

import Link from "next/link";
import { engagementTierLabel } from "@/lib/domain/community/engagement";
import type { CommunityOverview } from "@/lib/domain/community/overview";

const DASH = "—";

type TierTileProps = {
  label: string;
  count: number;
  tone: "core" | "active" | "casual" | "at_risk";
};

const TILE_STYLE: Record<TierTileProps["tone"], string> = {
  // core (濃い青) / active (薄い青) / casual (灰) / at_risk (赤)
  core: "bg-blue-50 border-blue-300 text-blue-800",
  active: "bg-blue-50/60 border-blue-200 text-blue-700",
  casual: "bg-neutral-100 border-neutral-300 text-neutral-700",
  at_risk: "bg-red-50 border-red-300 text-red-700"
};

function TierTile({ label, count, tone }: TierTileProps) {
  return (
    <div className={`rounded-lg border p-4 ${TILE_STYLE[tone]}`}>
      <div className="text-caption font-medium">{label}</div>
      <div className="mt-1 text-2xl font-bold">{count}</div>
      <div className="text-[10px] opacity-70">名 (stakeholder)</div>
    </div>
  );
}

export function CommunityOverviewSection({
  overview
}: {
  overview: CommunityOverview;
}) {
  const { tierCounts, promotionCandidates, atRiskCompanies } = overview;

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-base font-bold text-neutral-900">
          全社 Inner Rings 総覧
        </h2>
        <p className="text-caption text-neutral-500">
          全社 stakeholder の関与度分布と、いま動くべき「昇格候補 / 離脱危機企業」一覧
        </p>
      </header>

      {/* 上段: 4 タイル */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <TierTile label="コア" count={tierCounts.core} tone="core" />
        <TierTile label="アクティブ" count={tierCounts.active} tone="active" />
        <TierTile label="カジュアル" count={tierCounts.casual} tone="casual" />
        <TierTile label="離脱危機" count={tierCounts.at_risk} tone="at_risk" />
      </div>

      {/* 中段: 2 カラム */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* 昇格候補 */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-neutral-800">
              昇格候補
            </h3>
            <span className="text-[10px] text-neutral-500">
              自動算出が現 tier を上回る上位 {promotionCandidates.length} 名
            </span>
          </div>
          {promotionCandidates.length === 0 ? (
            <div className="py-6 text-center text-caption text-neutral-400">
              {DASH} 該当者なし {DASH}
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {promotionCandidates.map((p) => (
                <li key={p.stakeholderId}>
                  <Link
                    href={`/companies/${p.companyId}`}
                    className="block py-2 hover:bg-neutral-50"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-neutral-900">
                        {p.stakeholderName}
                      </span>
                      <span className="truncate text-[11px] text-neutral-500">
                        {p.companyName}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-neutral-600">
                      {p.currentTier
                        ? engagementTierLabel[p.currentTier]
                        : "未測定"}
                      {" → "}
                      <span className="font-semibold text-blue-700">
                        {engagementTierLabel[p.suggestedTier]}
                      </span>
                    </div>
                    {p.reasons.length > 0 && (
                      <div className="mt-0.5 truncate text-[10px] text-neutral-500">
                        {p.reasons.join(" ・ ")}
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 離脱危機企業 */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-neutral-800">
              離脱危機企業
            </h3>
            <span className="text-[10px] text-neutral-500">
              集約 tier が at_risk な企業 上位 {atRiskCompanies.length} 社
            </span>
          </div>
          {atRiskCompanies.length === 0 ? (
            <div className="py-6 text-center text-caption text-neutral-400">
              {DASH} 該当企業なし {DASH}
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {atRiskCompanies.map((c) => (
                <li key={c.companyId}>
                  <Link
                    href={`/companies/${c.companyId}`}
                    className="block py-2 hover:bg-neutral-50"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-neutral-900">
                        {c.companyName}
                      </span>
                      <span className="rounded-pill bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                        at_risk {c.stakeholderAtRiskCount} 名
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-neutral-500">
                      担当 {c.ownerName ?? DASH}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
