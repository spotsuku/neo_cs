import {
  CCC_PILLAR_ORDER,
  CCC_STATUS_COLOR,
  type CccBreakdown
} from "@/lib/domain/ccc/breakdown";
import { CccRadar } from "./CccRadar";
import { CccPillarCard } from "./CccPillarCard";

const STATUS_LABEL = {
  healthy: "順調",
  watch: "注意",
  risk: "要対応"
} as const;

const ENGAGEMENT_LABEL = {
  core: "Core",
  active: "Active",
  casual: "Casual",
  at_risk: "At Risk"
} as const;

// 関与度バッジ: core 青 / active 緑 / casual 灰 / at_risk 赤
const ENGAGEMENT_CLASS = {
  core: "bg-blue-50 text-blue-700 border-blue-200",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  casual: "bg-ink-50 text-ink-700 border-ink-200",
  at_risk: "bg-red-50 text-red-700 border-red-200"
} as const;

export function CccSection({ breakdown }: { breakdown: CccBreakdown }) {
  const color = CCC_STATUS_COLOR[breakdown.overallStatus];
  const tier = breakdown.engagementTier;

  return (
    <section className="liquid-surface p-5 space-y-4">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm font-semibold text-ink-700">
            CCC スコア (2026 Framework)
          </div>
          <div className="mt-0.5 text-[12px] text-ink-500">
            5 本柱 ─ 定着 / 貢献 / 支援 / 成長 / 妥当性
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-ink-900 tabular-nums">
            {breakdown.overallScore}
          </span>
          <span
            className={[
              "text-[12px] px-2 py-0.5 rounded-full font-semibold border",
              color.bg,
              color.text,
              color.border
            ].join(" ")}
          >
            {STATUS_LABEL[breakdown.overallStatus]}
          </span>
          {tier && (
            <span
              className={[
                "text-[12px] px-2 py-0.5 rounded-full font-semibold border",
                ENGAGEMENT_CLASS[tier]
              ].join(" ")}
            >
              {ENGAGEMENT_LABEL[tier]}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="flex justify-center">
          <CccRadar breakdown={breakdown} />
        </div>
        <div className="space-y-2">
          {CCC_PILLAR_ORDER.map((key) => (
            <CccPillarCard key={key} pillar={breakdown.pillars[key]} />
          ))}
        </div>
      </div>
    </section>
  );
}
