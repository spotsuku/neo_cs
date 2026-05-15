"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/nav/TopNav";
import type { ColumnMapping } from "@/lib/master/surveys";
import { describeTrigger, describeRespondentTarget } from "@/lib/master/surveys";
import { mockAiAnalyzeCsv, surveyQuestions } from "@/lib/master/surveys";
import type { SurveySchedule } from "@/lib/repository/server";
import { parseSurveyCsv } from "@/lib/surveys/csv";
import { ProductCode, productByCode, products } from "@/lib/master";

type Step = 1 | 2 | 3;

export type ImportClientProps = {
  schedules: SurveySchedule[];
};

const SAMPLE_CSV = `企業名,氏名,NPS,全体満足度,講師の質,教材の質,良かった点,改善してほしい点,応用コース興味
イオン九州,山田 太郎,9,5,5,4,講義が分かりやすかった,音声が時々途切れた,強くある
TOTO,佐藤 花子,7,4,4,4,他社受講者との交流,進行ペースが速い,ある
レヴィアス,鈴木 一郎,8,4,5,5,ハンズオン演習が良い,資料配布が遅い,ある`;

export default function ImportClient({ schedules }: ImportClientProps) {
  const [step, setStep] = useState<Step>(1);
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [productCode, setProductCode] = useState<ProductCode | "">("");
  const [scheduleId, setScheduleId] = useState<string>("");
  const [executedAt, setExecutedAt] = useState<string>("2026-04-27");
  const [analysis, setAnalysis] = useState<ReturnType<typeof mockAiAnalyzeCsv> | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);

  const scheduleOptions = useMemo(() => {
    if (!productCode) return [];
    return schedules.filter((s) => s.product === productCode);
  }, [productCode, schedules]);

  const selectedSchedule = schedules.find((s) => s.id === scheduleId);

  // アップロード直後のパースプレビュー（Step 1 で「44 列認識した」が見える）
  const parsedPreview = useMemo(() => {
    if (!csvText) return null;
    return parseSurveyCsv(csvText);
  }, [csvText]);

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result ?? "");
      setCsvText(text);
    };
    reader.readAsText(file);
  };

  const goAnalyze = () => {
    if (!csvText || !scheduleId || !executedAt) return;
    const result = mockAiAnalyzeCsv(csvText, surveyQuestions);
    setAnalysis(result);
    setMappings(result.columnMappings);
    setStep(2);
  };

  const updateMapping = (idx: number, patch: Partial<ColumnMapping>) => {
    setMappings((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  };

  const approveAll = () => {
    setMappings((prev) => prev.map((m) => ({ ...m, approvedBy: "古野" })));
  };

  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<{
    surveyId: string;
    importId: string;
    createdQuestionCount: number;
    responseCount: number;
    insightCount: number;
    insightSummary: string;
  } | null>(null);

  const apply = async () => {
    if (!csvText || !scheduleId || !executedAt || !analysis) return;
    setApplying(true);
    setApplyError(null);
    try {
      const res = await fetch("/api/surveys/import/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId,
          fileName,
          executedAt,
          csvText,
          mappings,
          aiSummary: analysis.aiSummary
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setApplyResult(data);
      setStep(3);
    } catch (e) {
      setApplyError((e as Error).message);
    } finally {
      setApplying(false);
    }
  };

  // 完了時のサマリー（パースされた parsed.rows を使う。引用符内改行に強い）
  const summary = useMemo(() => {
    if (!analysis) return null;
    const headers = analysis.parsed.headers;
    const rows = analysis.parsed.rows;
    const companyCol = mappings.find((m) => m.matched === "company_name");
    const respondentCol = mappings.find((m) => m.matched === "respondent_name");
    const companyIdx = companyCol ? headers.indexOf(companyCol.csvColumn) : -1;
    const respondentIdx = respondentCol ? headers.indexOf(respondentCol.csvColumn) : -1;

    const companies = new Set<string>();
    const unmatched: string[] = [];
    rows.forEach((cells) => {
      if (companyIdx >= 0) {
        const v = (cells[companyIdx] ?? "").trim();
        if (v.length > 0) companies.add(v);
      }
      const name = respondentIdx >= 0 ? (cells[respondentIdx] ?? "").trim() : "";
      if (name && (name.includes("?") || name.length < 2)) unmatched.push(name);
    });
    return {
      companyCount: companies.size,
      totalRows: rows.length,
      unmatched
    };
  }, [analysis, mappings]);

  return (
    <>
      <TopNav current="/surveys" />
      <main className="mx-auto max-w-[1200px] px-6 py-8 space-y-6">
        <div className="text-xs text-ink-500">
          <Link href="/surveys" className="hover:text-ink-700">
            アンケート
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-ink-700">CSV取込</span>
        </div>

        <h1 className="text-xl font-bold tracking-tight">
          <span className="brand-text-gradient">CSVから取り込む</span>
        </h1>

        {/* ステップインジケータ */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((n) => {
            const active = step === n;
            const done = step > n;
            return (
              <div key={n} className="flex items-center gap-2">
                <span
                  className={[
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold",
                    active
                      ? "bg-ink-900 text-white"
                      : done
                      ? "bg-emerald-500 text-white"
                      : "bg-ink-100 text-ink-500"
                  ].join(" ")}
                >
                  {done ? "✓" : n}
                </span>
                <span className={["text-sm", active ? "text-ink-900 font-semibold" : "text-ink-500"].join(" ")}>
                  {n === 1 ? "アップロード" : n === 2 ? "マッピング確認" : "完了"}
                </span>
                {n < 3 && <span className="w-8 h-px bg-ink-200" />}
              </div>
            );
          })}
        </div>

        {step === 1 && (
          <section className="liquid-surface p-6 space-y-5">
            <div>
              <div className="text-sm font-semibold text-ink-700 mb-2">研修</div>
              <div className="flex flex-wrap gap-1.5">
                {products.map((p) => (
                  <button
                    key={p.code}
                    onClick={() => {
                      setProductCode(p.code);
                      setScheduleId("");
                    }}
                    className={[
                      "px-3 py-1.5 rounded-full text-xs border transition",
                      productCode === p.code
                        ? "text-white border-transparent"
                        : "bg-white text-ink-700 border-ink-100 hover:bg-ink-50"
                    ].join(" ")}
                    style={
                      productCode === p.code
                        ? { background: p.accent, borderColor: p.accent }
                        : undefined
                    }
                  >
                    {p.shortName}
                  </button>
                ))}
              </div>
            </div>

            {productCode && (
              <div>
                <div className="text-sm font-semibold text-ink-700 mb-2">アンケートスケジュール</div>
                <select
                  value={scheduleId}
                  onChange={(e) => setScheduleId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-ink-100 text-sm"
                >
                  <option value="">選択してください</option>
                  {scheduleOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {selectedSchedule && (
                  <div className="mt-2 text-[11px] text-ink-500">
                    対象者: {describeRespondentTarget(selectedSchedule.respondentTarget)} ・ トリガー: {describeTrigger(selectedSchedule.trigger)}
                  </div>
                )}
              </div>
            )}

            <div>
              <div className="text-sm font-semibold text-ink-700 mb-2">実施日</div>
              <input
                type="date"
                value={executedAt}
                onChange={(e) => setExecutedAt(e.target.value)}
                className="px-3 py-2 rounded-xl border border-ink-100 text-sm"
              />
            </div>

            <div>
              <div className="text-sm font-semibold text-ink-700 mb-2">CSVファイル</div>
              <label
                className="block border-2 border-dashed border-ink-200 rounded-xl p-8 text-center cursor-pointer hover:bg-ink-50 transition"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f) handleFile(f);
                }}
              >
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                <div className="text-sm text-ink-700">
                  {fileName ? `📄 ${fileName}` : "CSVファイルをドラッグ&ドロップ または クリックして選択"}
                </div>
                <div className="mt-1 text-[11px] text-ink-500">
                  1行目をヘッダ行として処理します
                </div>
              </label>
              <button
                type="button"
                onClick={() => {
                  setCsvText(SAMPLE_CSV);
                  setFileName("サンプル.csv");
                }}
                className="mt-2 text-xs text-ink-500 hover:text-ink-700 underline"
              >
                サンプルCSVを使う
              </button>
            </div>

            {csvText && parsedPreview && (
              <div className="space-y-2">
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900">
                  <div className="font-semibold mb-1">
                    ✅ パース成功: {parsedPreview.columnCount} 列 × {parsedPreview.rowCount} 行を認識
                  </div>
                  {parsedPreview.warnings.length > 0 && (
                    <div className="mt-1 text-[11px] text-amber-800">
                      ⚠ {parsedPreview.warnings.join(" / ")}
                    </div>
                  )}
                </div>
                <details className="rounded-xl bg-ink-50 p-3">
                  <summary className="text-[11px] text-ink-700 cursor-pointer select-none">
                    認識した列名一覧（{parsedPreview.headers.length}件）
                  </summary>
                  <ol className="mt-2 text-[11px] text-ink-700 space-y-0.5 list-decimal list-inside">
                    {parsedPreview.headers.map((h, i) => (
                      <li key={i} className="break-all">
                        {h || <em className="text-ink-400">(空ヘッダ)</em>}
                      </li>
                    ))}
                  </ol>
                </details>
                <details className="rounded-xl bg-ink-50 p-3">
                  <summary className="text-[11px] text-ink-700 cursor-pointer select-none">
                    raw CSV プレビュー（先頭600文字）
                  </summary>
                  <pre className="mt-2 text-[11px] text-ink-700 whitespace-pre max-h-40 overflow-auto">
                    {csvText.slice(0, 600)}
                    {csvText.length > 600 ? "..." : ""}
                  </pre>
                </details>
              </div>
            )}

            <div className="flex justify-end">
              <button
                disabled={!csvText || !scheduleId || !executedAt}
                onClick={goAnalyze}
                className="px-5 py-2 rounded-full bg-ink-900 text-white text-sm disabled:opacity-30"
              >
                AI解析を実行 →
              </button>
            </div>
          </section>
        )}

        {step === 2 && analysis && (
          <section className="space-y-4">
            <div className="liquid-surface p-5">
              <div className="text-sm font-semibold text-ink-700 mb-1">🤖 AI解析結果</div>
              <p className="text-sm text-ink-700">{analysis.aiSummary}</p>
              <div className="mt-2 text-[11px] text-ink-500">
                行数: {analysis.rowCount} / 列数: {mappings.length}
              </div>
              {selectedSchedule && (
                <div className="mt-2 text-[11px] text-ink-500">
                  取込先スケジュール: <strong>{selectedSchedule.name}</strong> / 実施日 {executedAt}
                </div>
              )}
            </div>

            <div className="liquid-surface overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] text-ink-500 border-b border-ink-100">
                    <th className="px-4 py-3 font-medium w-[28%]">CSV列名</th>
                    <th className="px-3 py-3 font-medium">サンプル値</th>
                    <th className="px-3 py-3 font-medium">マッピング</th>
                    <th className="px-3 py-3 font-medium">紐付け先</th>
                    <th className="px-3 py-3 font-medium">Confidence</th>
                    <th className="px-3 py-3 font-medium w-40"></th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((m, idx) => {
                    const sample = analysis.samples[idx];
                    return (
                      <tr key={idx} className="border-b border-ink-50 last:border-0 align-top">
                        <td className="px-4 py-3 font-medium text-ink-900 break-all">{m.csvColumn}</td>
                        <td className="px-3 py-3 text-ink-500 text-[11px] break-all max-w-[260px]">
                          {sample && sample.sample.length > 0 ? (
                            <div className="space-y-0.5">
                              {sample.sample.slice(0, 2).map((v, i) => (
                                <div key={i} className="line-clamp-2">{v}</div>
                              ))}
                              <div className="text-ink-400 text-[10px]">
                                {sample.nonEmptyCount}件 / unique {sample.uniqueCount}
                              </div>
                            </div>
                          ) : (
                            <span className="text-ink-400">(空)</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <MappingBadge matched={m.matched} />
                        </td>
                        <td className="px-3 py-3 text-ink-700 text-xs break-all">
                          {m.matched === "existing" && m.questionKey}
                          {m.matched === "new" && (
                            <div>
                              <div>{m.proposedQuestion?.text}</div>
                              <div className="text-ink-400 text-[10px]">
                                推定: {m.proposedQuestion?.type}
                              </div>
                            </div>
                          )}
                          {m.matched === "company_name" && "（企業特定に使用）"}
                          {m.matched === "respondent_name" && "（回答者氏名）"}
                          {m.matched === "skip" && "—"}
                        </td>
                        <td className="px-3 py-3 text-ink-700 text-xs">
                          {Math.round(m.confidence * 100)}%
                        </td>
                        <td className="px-3 py-3 text-right">
                          <select
                            value={m.matched}
                            onChange={(e) =>
                              updateMapping(idx, {
                                matched: e.target.value as ColumnMapping["matched"]
                              })
                            }
                            className="text-xs px-2 py-1 rounded-md border border-ink-100"
                          >
                            <option value="existing">既存質問</option>
                            <option value="new">新規質問</option>
                            <option value="company_name">企業名列</option>
                            <option value="respondent_name">氏名列</option>
                            <option value="skip">スキップ</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {applyError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
                ⚠ 取り込みに失敗しました: {applyError}
              </div>
            )}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep(1)}
                className="text-sm text-ink-500 hover:text-ink-700"
                disabled={applying}
              >
                ← 戻る
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={approveAll}
                  className="px-4 py-2 rounded-full bg-white border border-ink-100 text-sm text-ink-700 hover:bg-ink-50"
                  disabled={applying}
                >
                  全て承認
                </button>
                <button
                  onClick={apply}
                  className="px-5 py-2 rounded-full bg-ink-900 text-white text-sm hover:opacity-90 disabled:opacity-50"
                  disabled={applying}
                >
                  {applying ? "取り込み中…" : "適用する"}
                </button>
              </div>
            </div>
          </section>
        )}

        {step === 3 && analysis && summary && (
          <section className="liquid-surface p-8 text-center space-y-4">
            <div className="text-4xl">🎉</div>
            <div className="text-xl font-bold text-ink-900">取り込みが完了しました</div>
            {selectedSchedule && (
              <div className="text-sm text-ink-700">
                取込先: <strong>{selectedSchedule.name}</strong>{productCode ? ` (${productByCode[productCode as ProductCode].shortName})` : ""}
              </div>
            )}
            <div className="grid grid-cols-4 gap-4 max-w-2xl mx-auto pt-4">
              <div>
                <div className="text-2xl font-bold text-ink-900">{applyResult?.responseCount ?? summary.totalRows}</div>
                <div className="text-[11px] text-ink-500">取り込んだ回答</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-ink-900">{applyResult?.createdQuestionCount ?? 0}</div>
                <div className="text-[11px] text-ink-500">新規質問</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-ink-900">{summary.companyCount}</div>
                <div className="text-[11px] text-ink-500">企業マッチ</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-ink-900">{applyResult?.insightCount ?? 0}</div>
                <div className="text-[11px] text-ink-500">AIインサイト</div>
              </div>
            </div>
            <div className="rounded-xl bg-ink-50 p-4 text-sm text-ink-700 max-w-2xl mx-auto">
              🤖 {applyResult?.insightSummary ?? analysis.aiSummary}
            </div>
            {summary.unmatched.length > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 max-w-2xl mx-auto text-left">
                <div className="font-semibold mb-1">未マッチ氏名（手動修正可）</div>
                <ul className="list-disc list-inside">
                  {summary.unmatched.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-center gap-2 pt-2">
              <Link
                href="/surveys"
                className="px-5 py-2 rounded-full bg-white border border-ink-100 text-sm text-ink-700 hover:bg-ink-50"
              >
                一覧に戻る
              </Link>
              <Link
                href={applyResult ? `/surveys/${applyResult.surveyId}` : "/surveys"}
                className="px-5 py-2 rounded-full bg-ink-900 text-white text-sm hover:opacity-90"
              >
                結果を見る
              </Link>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

function MappingBadge({ matched }: { matched: ColumnMapping["matched"] }) {
  const style: Record<ColumnMapping["matched"], { label: string; color: string; bg: string }> = {
    existing: { label: "既存", color: "#10B981", bg: "#10B98114" },
    new: { label: "新規", color: "#3D9EFF", bg: "#3D9EFF14" },
    skip: { label: "スキップ", color: "#94A3B8", bg: "#94A3B814" },
    company_name: { label: "企業名", color: "#8B5CF6", bg: "#8B5CF614" },
    respondent_name: { label: "氏名", color: "#F59E0B", bg: "#F59E0B14" }
  };
  const s = style[matched];
  return (
    <span
      className="text-[11px] font-medium px-2 py-0.5 rounded-full"
      style={{ color: s.color, background: s.bg }}
    >
      {s.label}
    </span>
  );
}
