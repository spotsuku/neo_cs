// アンケート CSV 取り込みパイプライン（純関数群）
//
// 設計:
// - パイプラインは純関数で構成し、入力 → 出力 を CLI / API / UI のどこからでも
//   再利用できる形にする。
// - I/O（DB 書き込み・Claude API 呼び出し）は本ファイルでは扱わず、
//   呼び出し元（API ルート / リポジトリ）に任せる。
//
// 主要関数:
//   parseSurveyCsv()           ※ lib/surveys/csv.ts 経由で公開
//   inferColumnMapping()       既存質問マスタとの突合 + 企業/氏名/タイムスタンプ自動判定
//   buildImportPayload()       マッピング結果から DB 投入用ペイロードを組み立て
//   matchCompanyByName()       企業名→companies マスタへのファジー突合

import {
  parseSurveyCsv as _parseSurveyCsv,
  summarizeColumns,
  inferQuestionType,
  type ParsedCsv,
  type ColumnSample
} from "@/lib/surveys/csv";
import type {
  ColumnMapping,
  SurveyQuestion,
  SurveyQuestionType,
  SurveyRespondentType
} from "@/lib/mock/surveys";
import type { Company } from "@/lib/mock/entities";

// re-export
export { _parseSurveyCsv as parseSurveyCsv };
export type { ParsedCsv, ColumnSample };

// ─────────────────────────────────────────────
// STEP 2: マッピング推定
// ─────────────────────────────────────────────

const STOP_TOKENS = ["nps", "満足", "講師", "教材", "良かった", "改善", "推奨", "進捗", "ペース", "ハンズオン", "10点"];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export type InferColumnMappingInput = {
  parsed: ParsedCsv;
  samples: ColumnSample[];
  knownQuestions: SurveyQuestion[];
};

export function inferColumnMapping(input: InferColumnMappingInput): ColumnMapping[] {
  const { parsed, samples, knownQuestions } = input;
  const rowCount = parsed.rowCount;

  return parsed.headers.map((col, idx) => {
    const lower = col.toLowerCase();
    const sample = samples[idx];

    // タイムスタンプ・回答日時 → スキップ
    if (
      col.includes("タイムスタンプ") ||
      lower.includes("timestamp") ||
      col.includes("回答日時") ||
      lower.includes("submitted_at")
    ) {
      return { csvColumn: col, matched: "skip", confidence: 0.96 };
    }

    // 企業名列：誤検出を避けるため、列名と内容の両面で判断する。
    // 「理解が深まった企業」のように設問文中に "企業" を含むだけのものを除外。
    const looksLikeCompanyHeader =
      /(企業名|会社名|所属\s*[（(]?企業)|^company|学校名|貴社/i.test(col) ||
      col === "企業" ||
      col === "会社";
    if (looksLikeCompanyHeader) {
      return { csvColumn: col, matched: "company_name", confidence: 0.94 };
    }

    // 氏名列
    if (
      lower === "name" ||
      lower.includes("respondent") ||
      col.includes("氏名") ||
      col.includes("お名前") ||
      col.includes("名前") ||
      col.includes("回答者")
    ) {
      return { csvColumn: col, matched: "respondent_name", confidence: 0.94 };
    }

    // 既存 Question とのファジーマッチ
    let best: { q: SurveyQuestion; score: number } | undefined;
    for (const q of knownQuestions) {
      const qText = q.text.toLowerCase();
      const qKey = q.key.toLowerCase();
      let score = 0;
      if (qText.includes(lower) && lower.length >= 4) score = Math.max(score, 0.78);
      if (qKey.includes(lower) && lower.length >= 4) score = Math.max(score, 0.82);
      if (lower.includes(qKey) && qKey.length >= 4) score = Math.max(score, 0.82);
      for (const tk of STOP_TOKENS) {
        if (col.includes(tk) && (q.text.includes(tk) || q.key.includes(tk))) {
          score = Math.max(score, 0.78);
        }
      }
      if (score > 0 && (!best || score > best.score)) best = { q, score };
    }

    const baseConfidence = 0.6 + ((hashStr(col) % 39) / 100);
    if (best && best.score >= 0.78) {
      return {
        csvColumn: col,
        matched: "existing",
        questionKey: best.q.key,
        confidence: Math.min(0.98, Math.max(best.score, baseConfidence))
      };
    }

    // 新規質問：列のサンプル値からタイプ推定
    const inferred = sample ? inferQuestionType(sample, rowCount) : "text";
    const mappedType: SurveyQuestionType =
      inferred === "scale"
        ? "scale"
        : inferred === "multi_choice"
          ? "multi_choice"
          : inferred === "choice"
            ? "choice"
            : inferred === "long_text"
              ? "long_text"
              : "text";

    const proposedQuestion: SurveyQuestion = {
      id: `qnew-${hashStr(col)}`,
      key: `imported_${slug(col)}_${hashStr(col).toString(36).slice(-6)}`,
      text: col,
      type: mappedType,
      ...(mappedType === "scale"
        ? sample && sample.sample.some((v) => Number(v) > 5)
          ? { scaleMin: 0, scaleMax: 10 }
          : { scaleMin: 1, scaleMax: 5 }
        : {}),
      required: false
    };

    return {
      csvColumn: col,
      matched: "new",
      proposedQuestion,
      confidence: baseConfidence
    };
  });
}

// 列ヘッダ → 識別子安全な slug。日本語は除去せず、URL 安全文字のみに変換。
function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[【】（）()「」、。\s/]+/g, "_")
    .replace(/[^a-z0-9_぀-ヿ一-鿿]/g, "")
    .slice(0, 40)
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

// ─────────────────────────────────────────────
// STEP 3: ペイロード組み立て（DB 投入直前の形）
// ─────────────────────────────────────────────

export type BuildImportPayloadInput = {
  parsed: ParsedCsv;
  mappings: ColumnMapping[];
  scheduleId: string;
  scheduleName: string;
  fileName: string;
  executedAt: string;          // "YYYY-MM-DD"
  uploadedBy?: string;
  rawCsv: string;
  respondentType: SurveyRespondentType;
  productSessionLabel?: string;
  companies: Company[];        // 企業マスタ（ファジー突合用）
  knownQuestions: SurveyQuestion[]; // 既存質問マスタ（type 解決用）
  aiSummary?: string;
};

export type ImportPayload = {
  fileName: string;
  scheduleId: string;
  executedAt: string;
  uploadedBy?: string;
  rawCsv: string;
  columnMappings: ColumnMapping[];
  newQuestions: SurveyQuestion[];
  survey: {
    title: string;
    productSessionLabel?: string;
    respondentType: SurveyRespondentType;
    expectedRespondentCount: number;
    openedAt: string;
    closedAt?: string;
    status: "draft" | "open" | "closed";
    templateName: string;
  };
  responses: Array<{
    respondentName: string;
    submittedAt: string;
    companyId: string | null;
    answers: Array<{
      questionId: string;
      value: number | string | string[];
    }>;
  }>;
  aiSummary?: string;
};

export function buildImportPayload(input: BuildImportPayloadInput): ImportPayload {
  const {
    parsed,
    mappings,
    scheduleId,
    scheduleName,
    fileName,
    executedAt,
    uploadedBy,
    rawCsv,
    respondentType,
    productSessionLabel,
    companies,
    aiSummary
  } = input;

  // 列インデックス索引
  const headerIdxByCol = new Map<string, number>();
  parsed.headers.forEach((h, i) => headerIdxByCol.set(h, i));

  // 質問マッピング → questionId 解決
  // existing なら questionKey から既存 ID を引く必要があるが、
  // pipeline は既存 question テーブルを持たないので呼び出し元で完成させる。
  // ここでは proposedQuestion.id（新規）または "existing:{questionKey}" の擬似 ID を入れる。
  const newQuestions: SurveyQuestion[] = [];
  const colToQid = new Map<string, string>();
  for (const m of mappings) {
    if (m.matched === "new" && m.proposedQuestion) {
      newQuestions.push(m.proposedQuestion);
      colToQid.set(m.csvColumn, m.proposedQuestion.id);
    } else if (m.matched === "existing" && m.questionKey) {
      colToQid.set(m.csvColumn, `existing:${m.questionKey}`);
    }
  }

  // 企業列・氏名列のインデックス
  const companyMapping = mappings.find((m) => m.matched === "company_name");
  const respondentMapping = mappings.find((m) => m.matched === "respondent_name");
  const companyIdx = companyMapping ? headerIdxByCol.get(companyMapping.csvColumn) ?? -1 : -1;
  const respondentIdx = respondentMapping ? headerIdxByCol.get(respondentMapping.csvColumn) ?? -1 : -1;

  // タイムスタンプ列（最初の skip 列でタイムスタンプ的なもの）
  const timestampIdx = parsed.headers.findIndex(
    (h) => h.includes("タイムスタンプ") || h.toLowerCase().includes("timestamp") || h.includes("回答日時")
  );

  // 各行 → response 変換
  const responses: ImportPayload["responses"] = [];
  for (const cells of parsed.rows) {
    const respondentName = respondentIdx >= 0 ? (cells[respondentIdx] ?? "").trim() : "";
    const companyName = companyIdx >= 0 ? (cells[companyIdx] ?? "").trim() : "";
    const submittedAtRaw = timestampIdx >= 0 ? (cells[timestampIdx] ?? "").trim() : "";
    const submittedAt = parseTimestamp(submittedAtRaw, executedAt);
    const companyId = matchCompanyByName(companyName, companies);

    const answers: ImportPayload["responses"][number]["answers"] = [];
    mappings.forEach((m, colIdx) => {
      if (m.matched === "skip" || m.matched === "company_name" || m.matched === "respondent_name") return;
      const raw = (cells[colIdx] ?? "").trim();
      if (!raw) return;
      const qid = colToQid.get(m.csvColumn);
      if (!qid) return;

      // 値の正規化：質問タイプを既存/新規どちらの場合も解決する
      let targetType: SurveyQuestion["type"] | undefined;
      if (m.matched === "new") {
        targetType = m.proposedQuestion?.type;
      } else if (m.matched === "existing" && m.questionKey) {
        const eq = input.knownQuestions.find((q) => q.key === m.questionKey);
        targetType = eq?.type;
      }
      let value: number | string | string[] = raw;
      if (targetType === "scale") {
        const n = Number(raw);
        if (!Number.isNaN(n)) value = n;
      } else if (targetType === "multi_choice") {
        value = raw.split(/,\s*|、\s*/).map((s) => s.trim()).filter(Boolean);
      }
      answers.push({ questionId: qid, value });
    });

    responses.push({
      respondentName,
      submittedAt,
      companyId,
      answers
    });
  }

  return {
    fileName,
    scheduleId,
    executedAt,
    uploadedBy,
    rawCsv,
    columnMappings: mappings,
    newQuestions,
    survey: {
      title: scheduleName,
      productSessionLabel,
      respondentType,
      expectedRespondentCount: responses.length,
      openedAt: executedAt,
      closedAt: executedAt,
      status: "closed",
      templateName: `${scheduleName} 取込テンプレート (${executedAt})`
    },
    responses,
    aiSummary
  };
}

// "2026/02/28 20:50:32" / "2026-04-30 21:37" / 空文字 などをパース。
// 失敗したら fallback (executedAt) を返す。
function parseTimestamp(raw: string, fallbackDate: string): string {
  if (!raw) return new Date(`${fallbackDate}T00:00:00`).toISOString();
  const normalized = raw.replace(/\//g, "-").replace(/\s+/, "T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return new Date(`${fallbackDate}T00:00:00`).toISOString();
  return d.toISOString();
}

// 企業名 → companyId のファジーマッチ。
// 完全一致 → kana 一致 → 部分一致 → null の順で試行。
export function matchCompanyByName(name: string, companies: Company[]): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  // 1. 完全一致（名前・カナ）
  const exact = companies.find((c) => c.name === trimmed || c.kana === trimmed);
  if (exact) return exact.id;
  // 2. 「株式会社」を除いた一致
  const stripped = trimmed.replace(/(株式会社|有限会社|\(株\)|\(有\))\s*/g, "").trim();
  if (stripped) {
    const stripMatch = companies.find((c) => {
      const cs = c.name.replace(/(株式会社|有限会社|\(株\)|\(有\))\s*/g, "").trim();
      return cs === stripped;
    });
    if (stripMatch) return stripMatch.id;
  }
  // 3. 部分一致（双方向）
  const partial = companies.find((c) => c.name.includes(trimmed) || trimmed.includes(c.name));
  if (partial) return partial.id;
  return null;
}
