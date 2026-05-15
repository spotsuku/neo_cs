// Inner Rings UI (F5): コア候補発見動線
//
// 企業詳細 overview タブの CCC セクション直下に置く 4-tier の「リング」可視化。
// 各 stakeholder は core / active / casual / at_risk のいずれかのカラムに並ぶ。
// 自動算出値 (computeStakeholderEngagement) が現 tier より高位を示している場合、
// 「昇格候補」バッジを付ける — CS が "発見すべき" コア候補を一覧で見つけられるようにする。
//
// Server Component (state を持たない読み取り専用ビュー)。

import {
  engagementTierLabel,
  engagementTierOrder,
  type EngagementTier
} from "@/lib/domain/community/engagement";

// 構造的に必要なフィールドだけを宣言 — mock/cycles と repository/types の両方を受け入れる。
type Stakeholder = {
  id: string;
  name: string;
  role: string;
  department?: string;
  engagementTier?: EngagementTier | null;
};

type SuggestedInfo = {
  suggestedTier: EngagementTier;
  reasons?: string[]; // 現実装の computeStakeholderEngagement は reasons を返さないため optional
};

export type InnerRingsSectionProps = {
  companyId: string;
  stakeholders: Stakeholder[];
  computedByStakeholder: Record<string, SuggestedInfo>;
};

// tier rank: 値が大きいほど "中心リング" に近い (core が最上位)
const tierRank: Record<EngagementTier, number> = {
  core: 4,
  active: 3,
  casual: 2,
  at_risk: 1
};

// カラム見出し / カードの配色
const columnStyle: Record<EngagementTier, { header: string; card: string; dot: string }> = {
  core: {
    header: "bg-blue-50 border-blue-500 text-blue-700",
    card: "bg-white border-blue-200",
    dot: "bg-blue-500"
  },
  active: {
    header: "bg-blue-50/50 border-blue-300 text-blue-600",
    card: "bg-white border-blue-100",
    dot: "bg-blue-300"
  },
  casual: {
    header: "bg-gray-50 border-gray-300 text-gray-700",
    card: "bg-white border-gray-200",
    dot: "bg-gray-400"
  },
  at_risk: {
    header: "bg-red-50 border-red-500 text-red-700",
    card: "bg-white border-red-200",
    dot: "bg-red-500"
  }
};

// initials: 氏名のうち最初の 1 文字 (avatar 円表示用)
function initial(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "?";
  // 全角括弧で始まる場合は中身の先頭を取る (例: "（人事部長）" → "人")
  const m = trimmed.match(/[^\s（）()【】\[\]]/);
  return (m ? m[0] : trimmed[0]).toUpperCase();
}

function isPromotionCandidate(
  s: Stakeholder,
  computed: SuggestedInfo | undefined
): boolean {
  if (!computed) return false;
  if (!s.engagementTier) return false;
  return tierRank[computed.suggestedTier] > tierRank[s.engagementTier];
}

function StakeholderRingCard({
  stakeholder,
  computed,
  tier
}: {
  stakeholder: Stakeholder;
  computed: SuggestedInfo | undefined;
  tier: EngagementTier;
}) {
  const promote = isPromotionCandidate(stakeholder, computed);
  const style = columnStyle[tier];
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 ${style.card}`}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ${style.dot}`}
        aria-hidden
      >
        {initial(stakeholder.name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold text-ink-800">
          {stakeholder.name}
        </div>
        <div className="truncate text-[10px] text-ink-500">
          {stakeholder.role}
          {stakeholder.department ? ` / ${stakeholder.department}` : ""}
        </div>
        {promote && computed && (
          <div className="mt-1">
            <span className="inline-flex items-center rounded-pill bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-800">
              昇格候補 → {engagementTierLabel[computed.suggestedTier]}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function RingColumn({
  tier,
  stakeholders,
  computedByStakeholder
}: {
  tier: EngagementTier;
  stakeholders: Stakeholder[];
  computedByStakeholder: Record<string, SuggestedInfo>;
}) {
  const style = columnStyle[tier];
  const list = stakeholders.filter((s) => s.engagementTier === tier);
  return (
    <div className="flex flex-col gap-2">
      <div
        className={`flex items-center justify-between rounded-md border-l-4 px-2.5 py-1.5 ${style.header}`}
      >
        <div className="flex items-center gap-1.5">
          <span className={`inline-block h-2 w-2 rounded-full ${style.dot}`} />
          <span className="text-xs font-semibold">
            {engagementTierLabel[tier]}
          </span>
        </div>
        <span className="rounded-pill bg-white/70 px-2 py-0.5 text-[10px] font-semibold">
          {list.length}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {list.length === 0 ? (
          <div className="rounded-lg border border-dashed border-ink-200 px-2.5 py-3 text-center text-[11px] text-ink-400">
            このリングにはまだ誰もいません
          </div>
        ) : (
          list.map((s) => (
            <StakeholderRingCard
              key={s.id}
              stakeholder={s}
              computed={computedByStakeholder[s.id]}
              tier={tier}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function InnerRingsSection({
  companyId: _companyId,
  stakeholders,
  computedByStakeholder
}: InnerRingsSectionProps) {
  // 未測定 (engagementTier = null/undefined) は別セクションで列挙
  const unmeasured = stakeholders.filter((s) => !s.engagementTier);

  // 全員が 0 件なら何も出さない (overview が空欄だらけになるのを避ける)
  if (stakeholders.length === 0) return null;

  return (
    <section className="liquid-surface space-y-3 p-5">
      <div>
        <div className="text-sm font-semibold text-ink-700">
          Inner Rings (関与度リング)
        </div>
        <div className="mt-0.5 text-[11px] text-ink-500">
          顧客側担当者を関与度 tier ごとに並べた可視化。「昇格候補」は自動算出値が現 tier より高い人 — コア候補発見の起点に。
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {engagementTierOrder.map((tier) => (
          <RingColumn
            key={tier}
            tier={tier}
            stakeholders={stakeholders}
            computedByStakeholder={computedByStakeholder}
          />
        ))}
      </div>

      {unmeasured.length > 0 && (
        <div className="rounded-lg border border-dashed border-ink-200 bg-ink-50/30 px-3 py-2">
          <div className="text-[11px] font-semibold text-ink-600">
            未測定 {unmeasured.length} 件 — 関与度を判定する
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {unmeasured.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1 rounded-pill border border-ink-200 bg-white px-2 py-0.5 text-[10px] text-ink-700"
              >
                <span className="font-medium">{s.name}</span>
                <span className="text-ink-400">/ {s.role}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
