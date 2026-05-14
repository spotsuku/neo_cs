"use client";

// 経営ダッシュボード (Executive Dashboard)
//
// 目的: 数字を見て経営判断が一発でできる
// 構成:
//   ① 経営サマリー帯 (3 タイル)
//   ② 年間更新型ブロック (academia/hyogikai)
//   ③ 単発型ブロック (aiken/commu)
//   ④ 企業ジャーニー分布 (クリックで詳細モーダル)
//   ⑤ 事業別アクティブ社数 (4 タイル)
//   ⑥ 対応漏れ企業リスト

import { useMemo, useState } from "react";
import Link from "next/link";
import type {
  ContinuousKpis,
  OneShotKpis,
  ProductActivity
} from "@/lib/domain/kpi/exec-kpi";
import { PRODUCT_LABEL } from "@/lib/domain/kpi/exec-kpi";
import {
  MISSED_REASON_LABEL,
  type MissedCompany,
  type MissedReason
} from "@/lib/domain/churn/missed-response";
import type { JourneyStageDefinition, CompanyJourney } from "@/lib/repository";

type CompanyLite = { id: string; name: string; ownerName?: string };

export type ExecutiveDashboardProps = {
  asOf: string;
  continuous: ContinuousKpis;
  oneShot: OneShotKpis;
  productActivity: ProductActivity[];
  journeyStages: JourneyStageDefinition[];
  companyJourneys: CompanyJourney[];
  companies: CompanyLite[];
  missed: MissedCompany[];
  /** 戦略資産社数 (投資対象化以降ステージにいる社) */
  strategicAssetCount: number;
  /** 全社アクティブ社数 (4事業のいずれかで現在/直近窓内に発注) */
  totalActiveCompanies: number;
};

function fmtYen(n: number): string {
  if (n === 0) return "¥0";
  if (Math.abs(n) >= 100_000_000) return `¥${(n / 100_000_000).toFixed(1)}億`;
  if (Math.abs(n) >= 10_000) return `¥${Math.round(n / 10_000).toLocaleString("ja-JP")}万`;
  return `¥${n.toLocaleString("ja-JP")}`;
}
function fmtPct(r: number, digits = 1): string {
  return `${(r * 100).toFixed(digits)}%`;
}

export function ExecutiveDashboard(props: ExecutiveDashboardProps) {
  const {
    asOf,
    continuous,
    oneShot,
    productActivity,
    journeyStages,
    companyJourneys,
    companies,
    missed,
    strategicAssetCount,
    totalActiveCompanies
  } = props;

  const companyById = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies]
  );
  const journeyByCompany = useMemo(
    () => new Map(companyJourneys.map((j) => [j.companyId, j])),
    [companyJourneys]
  );

  const stagesSorted = useMemo(
    () => [...journeyStages].sort((a, b) => a.displayOrder - b.displayOrder),
    [journeyStages]
  );
  const stageDistribution = useMemo(() => {
    const map = new Map<string, CompanyJourney[]>();
    for (const s of stagesSorted) map.set(s.stageKey, []);
    for (const j of companyJourneys) {
      const arr = map.get(j.currentStageKey) ?? [];
      arr.push(j);
      map.set(j.currentStageKey, arr);
    }
    return map;
  }, [companyJourneys, stagesSorted]);

  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      {/* ① 経営サマリー帯 */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-h3 font-semibold text-neutral-900">経営サマリー</h2>
          <span className="text-caption text-neutral-500">{asOf} 時点</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SummaryTile
            label="全社アクティブ社数"
            value={`${totalActiveCompanies}`}
            unit="社"
            sub="4 事業のいずれかで稼働中 (継続 + 直近90日単発)"
            tone="brand"
          />
          <SummaryTile
            label="戦略資産社数"
            value={`${strategicAssetCount}`}
            unit="社"
            sub="企業ジャーニー「投資対象化」以降に到達"
            tone="success"
          />
          <SummaryTile
            label="対応漏れ"
            value={`${missed.length}`}
            unit="社"
            sub="接触途絶 / 担当未割当 / ジャーニー停滞 / VOC放置"
            tone={missed.length > 0 ? "danger" : "neutral"}
            href="#missed-list"
          />
        </div>
      </section>

      {/* ② 年間更新型 + ③ 単発型 */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="surface p-5 space-y-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-h4 font-semibold text-neutral-900">
              年間更新型 (ACADEMIA / 評議会)
            </h3>
            <span className="text-caption text-neutral-500">
              アクティブ {continuous.activeCompanies} 社 / {continuous.activeContracts} 契約
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="ARR" value={fmtYen(continuous.totalArr)} accent="brand" />
            <Metric
              label="更新率 (直近1年)"
              value={fmtPct(continuous.renewalRate, 0)}
              sub={`${continuous.renewalRetained} / ${continuous.renewalDecided} 件`}
              accent={continuous.renewalRate >= 0.85 ? "success" : continuous.renewalRate >= 0.7 ? "warning" : "danger"}
            />
            <Metric
              label="GRR (粗維持率)"
              value={fmtPct(continuous.grossRetention, 0)}
              sub="1年前 ARR の維持割合"
              accent={continuous.grossRetention >= 0.9 ? "success" : "warning"}
            />
            <Metric
              label="更新パイプライン (90日)"
              value={fmtYen(continuous.pipelineArr)}
              sub={`${continuous.pipelineCount} 契約`}
              accent="warning"
            />
          </div>
        </div>

        <div className="surface p-5 space-y-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-h4 font-semibold text-neutral-900">
              単発型 (AI研修 / コミュマネ)
            </h3>
            <span className="text-caption text-neutral-500">直近90日</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="期間売上" value={fmtYen(oneShot.periodRevenue)} accent="brand" />
            <Metric
              label="開催数 / 受講社数"
              value={`${oneShot.periodCount} / ${oneShot.periodCompanies}`}
              sub="件 / 社"
            />
            <Metric
              label="リピート率"
              value={fmtPct(oneShot.repeatRate, 0)}
              sub={`${oneShot.repeatCompanies} / ${oneShot.periodCompanies} 社`}
              accent={oneShot.repeatRate >= 0.4 ? "success" : "warning"}
            />
            <Metric
              label="平均単価"
              value={fmtYen(oneShot.averagePrice)}
              sub={`クロスセル ${oneShot.crossSellCount} 社`}
            />
          </div>
        </div>
      </section>

      {/* ④ 企業ジャーニー分布 */}
      <section className="surface p-5 space-y-4">
        <div className="flex items-baseline justify-between">
          <h3 className="text-h4 font-semibold text-neutral-900">
            企業ジャーニー分布
          </h3>
          <span className="text-caption text-neutral-500">
            ステージをクリックで企業一覧
          </span>
        </div>
        <div className="space-y-2">
          {stagesSorted.map((stage) => {
            const list = stageDistribution.get(stage.stageKey) ?? [];
            const max = Math.max(
              1,
              ...stagesSorted.map((s) => stageDistribution.get(s.stageKey)?.length ?? 0)
            );
            const widthPct = (list.length / max) * 100;
            const isStrategic = stage.displayOrder >= 6;
            return (
              <button
                key={stage.stageKey}
                type="button"
                onClick={() => setSelectedStage(stage.stageKey)}
                className="w-full text-left grid grid-cols-[200px_1fr_60px] items-center gap-3 px-2 py-2 rounded-md hover:bg-neutral-50 focus-ring transition"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: stage.color ?? "#888" }}
                  />
                  <span className={`text-caption truncate ${isStrategic ? "font-semibold text-neutral-900" : "text-neutral-700"}`}>
                    {stage.name}
                  </span>
                </div>
                <div className="h-5 bg-neutral-100 rounded relative overflow-hidden">
                  <div
                    className="h-full rounded transition-all"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: stage.color ?? "#94a3b8",
                      opacity: 0.6
                    }}
                  />
                </div>
                <span className="text-caption tabular-nums text-neutral-700 text-right">
                  {list.length} 社
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-caption text-neutral-500 pt-2 border-t border-neutral-100">
          後半ステージ (投資対象化 / パートナー化) = 戦略資産。前半に滞留が多ければ価値伝達フェーズへの介入を検討。
        </p>
      </section>

      {/* ⑤ 事業別アクティブ社数 */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-h4 font-semibold text-neutral-900">事業別アクティブ社数</h3>
          <span className="text-caption text-neutral-500">継続 = 現在 active / 単発 = 直近90日</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {productActivity.map((p) => (
            <div key={p.product} className="surface p-4 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-caption text-neutral-500">{PRODUCT_LABEL[p.product]}</span>
                <span
                  className={`text-caption px-1.5 py-0 rounded-pill border ${
                    p.isContinuous
                      ? "bg-info-50 text-info-700 border-info-100"
                      : "bg-warning-50 text-warning-700 border-warning-100"
                  }`}
                >
                  {p.isContinuous ? "継続" : "単発"}
                </span>
              </div>
              <div className="text-h3 font-bold tabular-nums text-neutral-900">
                {p.activeCompanies} <span className="text-caption font-normal text-neutral-500">社</span>
              </div>
              <div className="text-caption text-neutral-500">
                {p.activeContracts} 契約 ・ {fmtYen(p.totalMrrOrRevenue)}
                {p.isContinuous ? "/月" : ""}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ⑥ 対応漏れ企業リスト */}
      <section id="missed-list" className="surface p-5 space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-h4 font-semibold text-neutral-900">
            対応漏れ企業
            <span className="ml-2 text-caption font-normal text-neutral-500 tabular-nums">
              {missed.length} 社
            </span>
          </h3>
          <span className="text-caption text-neutral-500">
            危険度の高い順
          </span>
        </div>
        {missed.length === 0 ? (
          <p className="text-body text-neutral-500 py-4 text-center">
            漏れている企業はありません 🎉
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {missed.slice(0, 20).map((m) => (
              <li key={m.companyId} className="py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <Link
                      href={`/companies/${m.companyId}`}
                      className="text-body font-medium text-neutral-900 hover:underline focus-ring rounded-sm"
                    >
                      {m.companyName}
                    </Link>
                    <span className="text-caption text-neutral-500">
                      担当: {m.ownerName || "未割当"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {m.reasons.map((r) => (
                      <ReasonBadge key={r} reason={r} m={m} />
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {missed.length > 20 && (
          <p className="text-caption text-neutral-500 pt-2 border-t border-neutral-100">
            上位 20 社のみ表示 (全 {missed.length} 社)
          </p>
        )}
      </section>

      {/* 企業ジャーニー詳細モーダル */}
      {selectedStage && (
        <StageDetailModal
          stage={stagesSorted.find((s) => s.stageKey === selectedStage)!}
          journeys={stageDistribution.get(selectedStage) ?? []}
          companyById={companyById}
          onClose={() => setSelectedStage(null)}
        />
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  unit,
  sub,
  tone,
  href
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  tone: "brand" | "success" | "warning" | "danger" | "neutral";
  href?: string;
}) {
  const toneClasses: Record<string, string> = {
    brand: "border-l-4 border-l-brand-purple",
    success: "border-l-4 border-l-success-500",
    warning: "border-l-4 border-l-warning-500",
    danger: "border-l-4 border-l-danger-500",
    neutral: "border-l-4 border-l-neutral-300"
  };
  const inner = (
    <div className={`surface p-5 space-y-1 ${toneClasses[tone]}`}>
      <div className="text-caption text-neutral-500">{label}</div>
      <div className="text-3xl font-bold text-neutral-900 tabular-nums">
        {value}
        {unit && <span className="text-base font-normal text-neutral-500 ml-1">{unit}</span>}
      </div>
      {sub && <div className="text-caption text-neutral-500">{sub}</div>}
    </div>
  );
  return href ? (
    <a href={href} className="block focus-ring rounded-md">
      {inner}
    </a>
  ) : (
    inner
  );
}

function Metric({
  label,
  value,
  sub,
  accent
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "brand" | "success" | "warning" | "danger";
}) {
  const accentClass: Record<string, string> = {
    brand: "text-brand-purple",
    success: "text-success-700",
    warning: "text-warning-700",
    danger: "text-danger-700"
  };
  return (
    <div className="rounded-md border border-neutral-100 bg-neutral-50/50 p-3 space-y-0.5">
      <div className="text-caption text-neutral-500">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${accent ? accentClass[accent] : "text-neutral-900"}`}>
        {value}
      </div>
      {sub && <div className="text-caption text-neutral-500">{sub}</div>}
    </div>
  );
}

function ReasonBadge({ reason, m }: { reason: MissedReason; m: MissedCompany }) {
  let detail = "";
  if (reason === "stale_contact" && m.lastTouchDays != null)
    detail = ` (${m.lastTouchDays}日)`;
  if (reason === "journey_stuck" && m.journeyStuckDays != null)
    detail = ` (${m.journeyStuckDays}日)`;
  if (reason === "voc_unresolved" && m.vocOpenCount)
    detail = ` (${m.vocOpenCount}件)`;
  const tone: Record<MissedReason, string> = {
    stale_contact: "bg-warning-50 text-warning-700 border-warning-100",
    no_owner: "bg-danger-50 text-danger-700 border-danger-100",
    journey_stuck: "bg-info-50 text-info-700 border-info-100",
    voc_unresolved: "bg-brand-purple/10 text-brand-purple border-brand-purple/20"
  };
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-pill border text-caption ${tone[reason]}`}
    >
      {MISSED_REASON_LABEL[reason]}
      {detail}
    </span>
  );
}

function StageDetailModal({
  stage,
  journeys,
  companyById,
  onClose
}: {
  stage: JourneyStageDefinition;
  journeys: CompanyJourney[];
  companyById: Map<string, CompanyLite>;
  onClose: () => void;
}) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="absolute inset-0 bg-neutral-900/40 cursor-default"
      />
      <div className="relative bg-surface rounded-xl shadow-cardHover border border-neutral-100 w-[min(720px,94vw)] max-h-[85vh] overflow-auto p-5 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: stage.color ?? "#888" }}
              />
              <h3 className="text-h4 font-semibold text-neutral-900">{stage.name}</h3>
              <span className="text-caption text-neutral-500 tabular-nums">
                {journeys.length} 社
              </span>
            </div>
            <p className="text-caption text-neutral-500 mt-1">{stage.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 rounded-md text-caption text-neutral-500 hover:bg-neutral-100 focus-ring"
          >
            ✕
          </button>
        </div>

        {journeys.length === 0 ? (
          <p className="text-body text-neutral-500 py-4 text-center">
            このステージに該当する企業はありません
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {journeys.map((j) => {
              const co = companyById.get(j.companyId);
              const days = Math.floor(
                (Date.now() - Date.parse(j.stageEnteredAt)) / (1000 * 60 * 60 * 24)
              );
              return (
                <li key={j.companyId} className="py-2.5 flex items-baseline justify-between gap-2">
                  <Link
                    href={`/companies/${j.companyId}`}
                    className="text-body font-medium text-neutral-900 hover:underline focus-ring rounded-sm"
                  >
                    {co?.name ?? j.companyId}
                  </Link>
                  <div className="flex items-baseline gap-3 text-caption text-neutral-500">
                    <span>担当: {co?.ownerName ?? "未割当"}</span>
                    <span className="tabular-nums">滞在 {days}日</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
