import {
  CCC_PILLAR_LABEL,
  CCC_STATUS_COLOR,
  type CccConfidence,
  type CccPillarScore
} from "@/lib/domain/ccc/breakdown";

const STATUS_LABEL = {
  healthy: "順調",
  watch: "注意",
  risk: "要対応"
} as const;

const CONFIDENCE_LABEL: Record<CccConfidence, string> = {
  high: "high",
  med: "med",
  low: "low"
};

const CONFIDENCE_CLASS: Record<CccConfidence, string> = {
  high: "bg-emerald-50 text-emerald-700 border-emerald-200",
  med: "bg-sky-50 text-sky-700 border-sky-200",
  low: "bg-ink-50 text-ink-600 border-ink-200"
};

export function CccPillarCard({ pillar }: { pillar: CccPillarScore }) {
  const color = CCC_STATUS_COLOR[pillar.status];
  const dim = pillar.confidence === "low" ? "bg-gray-100" : "bg-white";

  return (
    <div
      className={[
        "rounded-md border border-ink-100 p-3",
        dim
      ].join(" ")}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-ink-900">
          {CCC_PILLAR_LABEL[pillar.key]}
        </span>
        <span className="text-base font-bold text-ink-900 tabular-nums">
          {pillar.score}
        </span>
        <span
          className={[
            "text-[12px] px-2 py-0.5 rounded-full font-semibold border",
            color.bg,
            color.text,
            color.border
          ].join(" ")}
        >
          {STATUS_LABEL[pillar.status]}
        </span>
        <span
          className={[
            "ml-auto text-[12px] px-1.5 py-0.5 rounded border font-medium",
            CONFIDENCE_CLASS[pillar.confidence]
          ].join(" ")}
          title={`信頼度: ${CONFIDENCE_LABEL[pillar.confidence]}`}
        >
          {CONFIDENCE_LABEL[pillar.confidence]}
        </span>
      </div>
      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-ink-600">
        {pillar.contributingSignals.map((s, i) => (
          <li key={i}>・{s}</li>
        ))}
      </ul>
    </div>
  );
}
