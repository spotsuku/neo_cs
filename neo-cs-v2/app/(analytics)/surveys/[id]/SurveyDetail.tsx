"use client";

import { useState } from "react";
import Link from "next/link";
import { ProductBadge } from "@/components/contract/ProductBadge";
import { KpiCard } from "@/components/kpi/KpiCard";
import type {
  Survey,
  SurveyResponse,
  SurveyInsight,
  SurveyImport,
  SurveyInsightCategory,
  SurveySchedule
} from "@/lib/master/surveys";
import { describeRespondentTarget, describeTrigger } from "@/lib/master/surveys";
import { aggregateSurvey, questionById } from "@/lib/master/surveys";
import { ProductCode } from "@/lib/master";
import { VocScanButton } from "@/components/voc/VocScanButton";
import type { VocSourceTextInput } from "@/lib/domain/voc/voc";

type Tab = "summary" | "insights" | "responses" | "imports";

const tabs: { key: Tab; label: string }[] = [
  { key: "summary", label: "集計" },
  { key: "insights", label: "AIインサイト" },
  { key: "responses", label: "生回答" },
  { key: "imports", label: "取込履歴" }
];

const categoryStyle: Record<SurveyInsightCategory, { label: string; color: string; bg: string }> = {
  positive: { label: "ポジティブ", color: "#10B981", bg: "#10B98114" },
  concern: { label: "懸念", color: "#F59E0B", bg: "#F59E0B14" },
  suggestion: { label: "提案", color: "#3D9EFF", bg: "#3D9EFF14" },
  complaint: { label: "不満", color: "#EF4444", bg: "#EF444414" }
};

export function SurveyDetail({
  survey,
  schedule,
  product,
  companyName,
  companyId,
  responses,
  insights,
  imports,
  aggregation,
  targetCount,
  byCompany
}: {
  survey: Survey;
  schedule?: SurveySchedule;
  product?: ProductCode;
  companyName?: string;
  companyId?: string;
  responses: SurveyResponse[];
  insights: SurveyInsight[];
  imports: SurveyImport[];
  aggregation: ReturnType<typeof aggregateSurvey>;
  targetCount: number;
  byCompany: { companyId: string; companyName: string; count: number }[];
}) {
  const [tab, setTab] = useState<Tab>("summary");
  const responseRate = targetCount > 0 ? Math.round((responses.length / targetCount) * 100) : 0;

  // VOC スキャン用入力: 全 response の自由記述 (string value) を集約
  const vocInputs: VocSourceTextInput[] = responses.flatMap((r) =>
    r.answers
      .filter((a): a is typeof a & { value: string } => typeof a.value === "string" && a.value.length >= 5)
      .map((a) => ({
        sourceType: "survey_response" as const,
        sourceId: r.id,
        text: a.value,
        companyId: r.companyId
      }))
  );

  return (
    <main className="mx-auto max-w-[1720px] px-6 py-8 space-y-6">
      <div className="text-xs text-ink-500">
        <Link href="/surveys" className="hover:text-ink-700">アンケート</Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink-700">{survey.title}</span>
      </div>

      {/* ヘッダ */}
      <section className="liquid-surface p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-ink-500">
              {product && <ProductBadge code={product} size="sm" />}
              {companyName && (
                <>
                  <span>・</span>
                  {companyId ? (
                    <Link href={`/companies/${companyId}`} className="hover:text-ink-700">
                      {companyName}
                    </Link>
                  ) : (
                    <span>{companyName}</span>
                  )}
                </>
              )}
              <span>・</span>
              <span>
                {survey.respondentType === "stakeholder" ? "担当者向け" : "参加者向け"}
              </span>
            </div>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-ink-900">
              {survey.title}
            </h1>
            <div className="mt-2 text-sm text-ink-500">
              期間: {survey.openedAt} 〜 {survey.closedAt ?? "実施中"}
              {survey.productSessionLabel && (
                <span className="ml-2 text-ink-700">・ {survey.productSessionLabel}</span>
              )}
            </div>
            {schedule && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-ink-50 px-3 py-1 text-[11px] text-ink-700">
                <span className="font-semibold">📅 {schedule.name}</span>
                <span className="text-ink-500">
                  / {describeRespondentTarget(schedule.respondentTarget)} / {describeTrigger(schedule.trigger)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="回答率"
            value={`${responseRate}%`}
            sub={`${responses.length} / ${targetCount}名`}
          />
          <KpiCard
            label="NPS"
            value={aggregation.npsScore !== undefined ? String(aggregation.npsScore) : "—"}
          />
          <KpiCard
            label="満足度（平均）"
            value={
              aggregation.satisfactionMean !== undefined
                ? aggregation.satisfactionMean.toFixed(2)
                : "—"
            }
            sub="1-5"
          />
          <KpiCard label="質問数" value={String(aggregation.byQuestion.length)} />
        </div>
      </section>

      {/* VOC スキャン (H項) */}
      {vocInputs.length > 0 && (
        <div className="flex items-center justify-end">
          <VocScanButton inputs={vocInputs} companyId={companyId} />
        </div>
      )}

      {/* タブ */}
      <nav className="flex items-center gap-1 border-b border-ink-100">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={[
                "px-4 py-2.5 text-sm transition relative -mb-px",
                active
                  ? "text-ink-900 font-semibold border-b-2 border-ink-900"
                  : "text-ink-500 hover:text-ink-700"
              ].join(" ")}
            >
              {t.label}
              {t.key === "insights" && insights.length > 0 && (
                <span className="ml-1 text-[10px] text-brand-pink">{insights.length}</span>
              )}
            </button>
          );
        })}
      </nav>

      {tab === "summary" && <SummaryTab aggregation={aggregation} byCompany={byCompany} />}
      {tab === "insights" && <InsightsTab insights={insights} responses={responses} />}
      {tab === "responses" && <ResponsesTab responses={responses} />}
      {tab === "imports" && <ImportsTab imports={imports} />}
    </main>
  );
}

function SummaryTab({
  aggregation,
  byCompany
}: {
  aggregation: ReturnType<typeof aggregateSurvey>;
  byCompany: { companyId: string; companyName: string; count: number }[];
}) {
  const totalByCompany = byCompany.reduce((s, c) => s + c.count, 0);
  return (
    <section className="space-y-4">
      {byCompany.length > 1 && (
        <div className="liquid-surface p-5">
          <div className="text-sm font-semibold text-ink-700 mb-3">企業別の回答内訳</div>
          <ul className="space-y-1.5">
            {byCompany
              .slice()
              .sort((a, b) => b.count - a.count)
              .map((c) => {
                const pct = totalByCompany > 0 ? (c.count / totalByCompany) * 100 : 0;
                return (
                  <li key={c.companyId} className="flex items-center gap-2 text-xs">
                    <Link
                      href={`/companies/${c.companyId}`}
                      className="w-40 truncate text-ink-700 hover:underline"
                    >
                      {c.companyName}
                    </Link>
                    <div className="flex-1 h-3 rounded-full bg-ink-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: "#10B981" }}
                      />
                    </div>
                    <span className="w-12 text-right text-ink-700">{c.count}件</span>
                  </li>
                );
              })}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {aggregation.byQuestion.map((q) => (
        <div key={q.questionKey} className="liquid-surface p-5">
          <div className="text-xs text-ink-500 font-medium">{q.questionKey}</div>
          <div className="mt-1 text-sm text-ink-900">{q.questionText}</div>

          {q.type === "scale" && q.distribution && (
            <div className="mt-4">
              {q.mean !== undefined && (
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-2xl font-bold text-ink-900">{q.mean.toFixed(2)}</span>
                  <span className="text-xs text-ink-500">平均 / 回答 {q.respondedCount}件</span>
                </div>
              )}
              <div className="space-y-1">
                {Object.entries(q.distribution).map(([k, v]) => {
                  const total = Object.values(q.distribution!).reduce((s, x) => s + x, 0);
                  const w = total > 0 ? (v / total) * 100 : 0;
                  return (
                    <div key={k} className="flex items-center gap-2 text-xs">
                      <span className="w-6 text-ink-500 text-right">{k}</span>
                      <div className="flex-1 h-3 rounded-full bg-ink-100 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${w}%`, background: "#3D9EFF" }}
                        />
                      </div>
                      <span className="w-8 text-ink-700 text-right">{v}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(q.type === "choice" || q.type === "multi_choice") && q.distribution && (
            <div className="mt-4 space-y-1">
              {Object.entries(q.distribution).map(([k, v]) => {
                const total = Object.values(q.distribution!).reduce((s, x) => s + x, 0);
                const w = total > 0 ? (v / total) * 100 : 0;
                return (
                  <div key={k} className="flex items-center gap-2 text-xs">
                    <span className="w-32 truncate text-ink-700">{k}</span>
                    <div className="flex-1 h-3 rounded-full bg-ink-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${w}%`, background: "#8B5CF6" }}
                      />
                    </div>
                    <span className="w-8 text-ink-700 text-right">{v}</span>
                  </div>
                );
              })}
            </div>
          )}

          {(q.type === "text" || q.type === "long_text") && (
            <div className="mt-3 text-xs text-ink-500">
              自由記述 ・ {q.respondedCount} 件の回答（AIインサイトタブで分析結果を確認）
            </div>
          )}
        </div>
      ))}
      </div>
    </section>
  );
}

function InsightsTab({
  insights,
  responses
}: {
  insights: SurveyInsight[];
  responses: SurveyResponse[];
}) {
  if (insights.length === 0) {
    return (
      <section className="liquid-surface p-10 text-center text-sm text-ink-500">
        AIインサイトはまだありません
      </section>
    );
  }

  const grouped = (Object.keys(categoryStyle) as SurveyInsightCategory[]).map((cat) => ({
    category: cat,
    items: insights.filter((i) => i.category === cat)
  }));

  return (
    <section className="space-y-4">
      <div className="text-[11px] text-ink-500">
        🤖 自由記述からAIが抽出（モック実装・決定論的）
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {grouped.map((g) => (
          <div key={g.category} className="liquid-surface p-5">
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  color: categoryStyle[g.category].color,
                  background: categoryStyle[g.category].bg
                }}
              >
                {categoryStyle[g.category].label}
              </span>
              <span className="text-[11px] text-ink-500">{g.items.length}件</span>
            </div>
            {g.items.length === 0 && (
              <div className="text-xs text-ink-500">この分類のインサイトはありません</div>
            )}
            <ul className="space-y-3">
              {g.items.map((ins) => {
                const q = questionById(ins.questionId);
                const sources = responses.filter((r) => ins.sourceResponseIds.includes(r.id));
                return (
                  <li key={ins.id} className="rounded-xl border border-ink-100 p-3 bg-white">
                    <div className="text-sm text-ink-900">{ins.summary}</div>
                    <div className="mt-1 text-[11px] text-ink-500">
                      {q?.text ?? ins.questionId} ・ confidence {Math.round(ins.confidence * 100)}%
                    </div>
                    {sources.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-[11px] text-ink-500 cursor-pointer hover:text-ink-700">
                          根拠 ({sources.length}件) を見る
                        </summary>
                        <ul className="mt-2 space-y-1.5">
                          {sources.slice(0, 3).map((r) => {
                            const ans = r.answers.find((a) => a.questionId === ins.questionId);
                            return (
                              <li key={r.id} className="text-xs text-ink-700 bg-ink-50 rounded p-2">
                                <span className="text-ink-500">{r.respondentName}: </span>
                                {typeof ans?.value === "string" ? ans.value : ""}
                              </li>
                            );
                          })}
                        </ul>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function ResponsesTab({ responses }: { responses: SurveyResponse[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (responses.length === 0) {
    return (
      <section className="liquid-surface p-10 text-center text-sm text-ink-500">
        回答はまだありません
      </section>
    );
  }
  return (
    <section className="liquid-surface overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] text-ink-500 border-b border-ink-100">
            <th className="px-5 py-3 font-medium">回答者</th>
            <th className="px-3 py-3 font-medium">提出日</th>
            <th className="px-3 py-3 font-medium">回答数</th>
            <th className="px-5 py-3 font-medium w-20"></th>
          </tr>
        </thead>
        <tbody>
          {responses.map((r) => (
            <RespondentRows key={r.id} r={r} openId={openId} setOpenId={setOpenId} />
          ))}
        </tbody>
      </table>
    </section>
  );
}

function RespondentRows({
  r,
  openId,
  setOpenId
}: {
  r: SurveyResponse;
  openId: string | null;
  setOpenId: (v: string | null) => void;
}) {
  return (
    <>
              <tr className="border-b border-ink-50 hover:bg-ink-50/50">
                <td className="px-5 py-3 font-medium">{r.respondentName}</td>
                <td className="px-3 py-3 text-ink-500 text-xs">{r.submittedAt}</td>
                <td className="px-3 py-3 text-ink-700">{r.answers.length} 項目</td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => setOpenId(openId === r.id ? null : r.id)}
                    className="text-xs text-ink-700 hover:underline"
                  >
                    {openId === r.id ? "閉じる" : "展開 →"}
                  </button>
                </td>
              </tr>
              {openId === r.id && (
                <tr className="bg-ink-50/40">
                  <td colSpan={4} className="px-5 py-4">
                    <ul className="space-y-2">
                      {r.answers.map((a) => {
                        const q = questionById(a.questionId);
                        return (
                          <li key={a.questionId} className="text-xs">
                            <span className="text-ink-500">{q?.text ?? a.questionId}: </span>
                            <span className="text-ink-900">
                              {Array.isArray(a.value) ? a.value.join(", ") : String(a.value)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </td>
                </tr>
              )}
    </>
  );
}

function ImportsTab({ imports }: { imports: SurveyImport[] }) {
  if (imports.length === 0) {
    return (
      <section className="liquid-surface p-10 text-center text-sm text-ink-500">
        このアンケートに紐づく取込履歴はありません
      </section>
    );
  }
  return (
    <section className="liquid-surface overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] text-ink-500 border-b border-ink-100">
            <th className="px-5 py-3 font-medium">ファイル名</th>
            <th className="px-3 py-3 font-medium">取込日</th>
            <th className="px-3 py-3 font-medium">取込者</th>
            <th className="px-3 py-3 font-medium">行数</th>
            <th className="px-3 py-3 font-medium">ステータス</th>
            <th className="px-5 py-3 font-medium">AI要約</th>
          </tr>
        </thead>
        <tbody>
          {imports.map((imp) => (
            <tr key={imp.id} className="border-b border-ink-50 last:border-0">
              <td className="px-5 py-3 font-medium text-ink-900">{imp.fileName}</td>
              <td className="px-3 py-3 text-ink-500 text-xs">{imp.uploadedAt}</td>
              <td className="px-3 py-3 text-ink-700">{imp.uploadedBy}</td>
              <td className="px-3 py-3 text-ink-700">{imp.rowCount}</td>
              <td className="px-3 py-3 text-xs text-ink-700">{imp.status}</td>
              <td className="px-5 py-3 text-xs text-ink-500">{imp.aiSummary}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
