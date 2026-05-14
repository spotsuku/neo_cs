// Stakeholder engagement tier 分布の小バー (Server Component)
//
// /team や /companies/[id] で使う想定の純表示コンポーネント。
// 各 tier の件数と相対比率を 4 色のスタックバー + 凡例で表示する。

import {
  engagementTierBadgeClass,
  engagementTierLabel,
  engagementTierOrder,
  type EngagementTier
} from "@/lib/domain/community/engagement";

const BAR_COLOR: Record<EngagementTier, string> = {
  core: "#10B981",
  active: "#3D9EFF",
  casual: "#94A3B8",
  at_risk: "#EF4444"
};

export function EngagementDistribution({
  tally,
  title = "エンゲージメント分布",
  showLegend = true
}: {
  tally: Record<EngagementTier, number>;
  title?: string;
  showLegend?: boolean;
}) {
  const total = engagementTierOrder.reduce((s, t) => s + tally[t], 0);
  return (
    <div className="surface p-4">
      <div className="text-caption text-neutral-500">{title}</div>
      <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
        {total === 0 ? (
          <div className="w-full bg-neutral-100" />
        ) : (
          engagementTierOrder.map((t) => {
            const pct = (tally[t] / total) * 100;
            if (pct === 0) return null;
            return (
              <div
                key={t}
                style={{ width: `${pct}%`, background: BAR_COLOR[t] }}
                title={`${engagementTierLabel[t]} ${tally[t]}件`}
              />
            );
          })
        )}
      </div>
      {showLegend && (
        <div className="mt-3 grid grid-cols-2 gap-1.5 text-caption">
          {engagementTierOrder.map((t) => (
            <div key={t} className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: BAR_COLOR[t] }}
                />
                <span className={`px-1.5 rounded-pill ${engagementTierBadgeClass[t]}`}>
                  {engagementTierLabel[t]}
                </span>
              </span>
              <span className="font-medium text-neutral-700">{tally[t]}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 text-[10px] text-neutral-500">合計 {total} 名</div>
    </div>
  );
}
