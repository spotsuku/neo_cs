"use client";

// TODO(P3): supabase 実装が無いため mock を表示。実装後に props 化。
import { useMemo, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { SectionSubNav, SIGNAL_SUBNAV } from "@/components/SectionSubNav";
import { ProductBadge } from "@/components/ProductBadge";
import {
  surveys,
  surveyResponses,
  surveySchedules,
  aggregateSurvey,
  describeTrigger,
  describeRespondentTarget,
  Survey,
  SurveySchedule,
  SurveyRespondentType
} from "@/lib/mock/surveys";
import { ProductCode, products, productByCode } from "@/lib/mock/data";

type RespondentFilter = "all" | SurveyRespondentType;

export default function SurveysPage() {
  const [productFilter, setProductFilter] = useState<ProductCode | "all">("all");
  const [respondentFilter, setRespondentFilter] = useState<RespondentFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<"all" | "180" | "90" | "30">("all");

  // 研修×スケジュールでグルーピング
  const groups = useMemo(() => {
    const cutoff = new Date("2026-04-27");
    if (periodFilter !== "all") cutoff.setDate(cutoff.getDate() - Number(periodFilter));

    return surveySchedules
      .filter((sch) => productFilter === "all" || sch.product === productFilter)
      .map((sch) => {
        const items = surveys.filter((sv) => {
          if (sv.scheduleId !== sch.id) return false;
          if (periodFilter !== "all" && new Date(sv.openedAt) < cutoff) return false;
          return true;
        });
        const tplFirst = sch.templateIds[0];
        // respondentTypeはスケジュールから推定
        const respondentType: SurveyRespondentType =
          sch.respondentTarget === "all_stakeholders" || sch.respondentTarget === "primary_contact"
            ? "stakeholder"
            : "participant";
        return { schedule: sch, items, respondentType, tplFirst };
      })
      .filter(
        (g) =>
          g.items.length > 0 &&
          (respondentFilter === "all" || g.respondentType === respondentFilter)
      )
      .sort((a, b) => (a.schedule.product < b.schedule.product ? -1 : 1));
  }, [productFilter, respondentFilter, periodFilter]);

  return (
    <>
      <TopNav current="/surveys" />
      <SectionSubNav items={SIGNAL_SUBNAV} />
      <main className="mx-auto max-w-[1720px] px-6 py-8 space-y-6">
        <section className="flex items-end justify-between">
          <div>
            <div className="text-xs text-ink-500 font-medium">Survey</div>
            <h1 className="mt-1 text-xl font-bold tracking-tight">
              <span className="brand-text-gradient">アンケート</span>
            </h1>
            <div className="mt-1 text-sm text-ink-500">
              研修マスタ×スケジュールから発生したアンケートを集計・AIインサイト化
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/surveys/import"
              className="px-4 py-2 rounded-full bg-ink-900 text-white text-sm hover:opacity-90"
            >
              📁 CSVから取り込む
            </Link>
          </div>
        </section>

        {/* フィルタ */}
        <section className="liquid-surface p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-ink-500">研修</span>
            <button
              onClick={() => setProductFilter("all")}
              className={[
                "px-3 py-1 rounded-full text-xs border",
                productFilter === "all"
                  ? "bg-ink-900 text-white border-ink-900"
                  : "bg-white text-ink-700 border-ink-100"
              ].join(" ")}
            >
              すべて
            </button>
            {products.map((p) => (
              <button
                key={p.code}
                onClick={() => setProductFilter(p.code)}
                className={[
                  "px-3 py-1 rounded-full text-xs border transition",
                  productFilter === p.code
                    ? "text-white border-transparent"
                    : "bg-white text-ink-700 border-ink-100 hover:bg-ink-50"
                ].join(" ")}
                style={
                  productFilter === p.code
                    ? { background: p.accent, borderColor: p.accent }
                    : undefined
                }
              >
                {p.shortName}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-ink-500">対象者</span>
            {(["all", "stakeholder", "participant"] as RespondentFilter[]).map((r) => (
              <button
                key={r}
                onClick={() => setRespondentFilter(r)}
                className={[
                  "px-3 py-1 rounded-full text-xs border",
                  respondentFilter === r
                    ? "bg-ink-900 text-white border-ink-900"
                    : "bg-white text-ink-700 border-ink-100"
                ].join(" ")}
              >
                {r === "all" ? "すべて" : r === "stakeholder" ? "担当者" : "参加者"}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-xs text-ink-500">期間</span>
            {(["all", "180", "90", "30"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodFilter(p)}
                className={[
                  "px-3 py-1 rounded-full text-xs border",
                  periodFilter === p
                    ? "bg-ink-900 text-white border-ink-900"
                    : "bg-white text-ink-700 border-ink-100"
                ].join(" ")}
              >
                {p === "all" ? "全期間" : `直近${p}日`}
              </button>
            ))}
          </div>
        </section>

        {/* グルーピング表示 */}
        <section className="space-y-4">
          {groups.map((g) => (
            <ScheduleGroup key={g.schedule.id} schedule={g.schedule} items={g.items} respondentType={g.respondentType} />
          ))}
          {groups.length === 0 && (
            <div className="liquid-surface p-12 text-center text-sm text-ink-500">
              該当するアンケートはありません
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function ScheduleGroup({
  schedule,
  items,
  respondentType
}: {
  schedule: SurveySchedule;
  items: Survey[];
  respondentType: SurveyRespondentType;
}) {
  const product = productByCode[schedule.product];

  // 各surveyの回答数とNPS
  const enriched = items
    .map((sv) => {
      const agg = aggregateSurvey(sv.id);
      const respCount = surveyResponses.filter((r) => r.surveyId === sv.id).length;
      return { sv, agg, respCount };
    })
    .sort((a, b) => (a.sv.openedAt < b.sv.openedAt ? 1 : -1));

  return (
    <div className="liquid-surface overflow-hidden">
      <div
        className="px-5 py-3 border-b border-ink-100 flex items-center gap-3"
        style={{ background: `${product.accent}08` }}
      >
        <ProductBadge code={schedule.product} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-ink-900 truncate">{schedule.name}</div>
          <div className="mt-0.5 text-[11px] text-ink-500 flex flex-wrap items-center gap-2">
            <span>{describeRespondentTarget(schedule.respondentTarget)}</span>
            <span>・</span>
            <span>{describeTrigger(schedule.trigger)}</span>
            <span>・</span>
            <span>
              {respondentType === "stakeholder" ? "担当者向け" : "参加者向け"}
            </span>
          </div>
        </div>
        <span className="text-[11px] text-ink-500">{enriched.length}件</span>
      </div>

      <ul className="divide-y divide-ink-50">
        {enriched.map(({ sv, agg, respCount }) => {
          const target = sv.expectedRespondentCount;
          return (
            <li key={sv.id}>
              <Link
                href={`/surveys/${sv.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50/40"
              >
                <span className="text-ink-400 text-xs">└</span>
                <span className="text-sm text-ink-900 flex-1 truncate">
                  {sv.openedAt} 実施
                  {sv.productSessionLabel ? ` ・ ${sv.productSessionLabel}` : ""}
                </span>
                <span className="text-xs text-ink-500 whitespace-nowrap">
                  回答 {respCount}
                  {respondentType === "stakeholder" ? "社" : ""}/{target}
                  {respondentType === "stakeholder" ? "社" : "名"}
                </span>
                <span className="text-xs text-ink-700 whitespace-nowrap">
                  NPS{" "}
                  <span className="font-semibold">
                    {agg.npsScore !== undefined ? agg.npsScore : "—"}
                  </span>
                </span>
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                  style={{
                    color: sv.status === "open" ? "#3D9EFF" : sv.status === "closed" ? "#10B981" : "#94A3B8",
                    background:
                      sv.status === "open" ? "#3D9EFF14" : sv.status === "closed" ? "#10B98114" : "#94A3B814"
                  }}
                >
                  {sv.status === "open" ? "実施中" : sv.status === "closed" ? "終了" : "下書き"}
                </span>
                <span className="text-xs text-ink-400">→</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
