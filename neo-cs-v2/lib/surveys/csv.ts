// 汚いCSV（Google Forms / Notion 出力等）を堅牢にパースするユーティリティ。
// papaparse をラップして、列ヘッダ正規化・サンプル抽出・型推定の前段を担う。

import Papa from "papaparse";

export type ParsedCsv = {
  headers: string[];          // 1行目をヘッダとして取り出した配列（空白トリム済み）
  rows: string[][];           // 2行目以降。各セルは string で配列インデックスは headers と一致
  rowCount: number;           // データ行数（ヘッダを除く）
  columnCount: number;        // 列数
  warnings: string[];         // パース時に出た警告（papaparse errors を要約）
};

export type ColumnSample = {
  header: string;
  index: number;
  nonEmptyCount: number;
  sample: string[];           // 先頭から最大 5 件の非空サンプル値
  uniqueCount: number;        // ユニーク値数（multi_choice 等の推定に使う）
};

export const MAX_SAMPLE_PER_COLUMN = 5;

export function parseSurveyCsv(rawText: string): ParsedCsv {
  // BOM 除去（Excel 由来のCSVはUTF-8 BOM 付きが多い）
  const cleaned = rawText.replace(/^﻿/, "");

  const result = Papa.parse<string[]>(cleaned, {
    header: false,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
    transform: (v) => (typeof v === "string" ? v : String(v ?? ""))
  });

  const rows = (result.data as string[][]).filter(
    (r) => Array.isArray(r) && r.some((c) => (c ?? "").trim().length > 0)
  );

  if (rows.length === 0) {
    return { headers: [], rows: [], rowCount: 0, columnCount: 0, warnings: ["CSVが空です"] };
  }

  const headers = (rows[0] ?? []).map((h) => (h ?? "").trim());
  const dataRows = rows.slice(1).map((r) => {
    // 列数を headers に揃える（不足は空文字、超過は切り詰め）
    const out = new Array(headers.length).fill("");
    for (let i = 0; i < headers.length; i++) {
      out[i] = (r[i] ?? "").toString();
    }
    return out as string[];
  });

  const warnings: string[] = [];
  if (result.errors && result.errors.length > 0) {
    for (const err of result.errors.slice(0, 3)) {
      warnings.push(`row ${err.row}: ${err.message}`);
    }
    if (result.errors.length > 3) {
      warnings.push(`... 他 ${result.errors.length - 3} 件の警告`);
    }
  }

  return {
    headers,
    rows: dataRows,
    rowCount: dataRows.length,
    columnCount: headers.length,
    warnings
  };
}

// 各列の非空サンプル・ユニーク値数を取り出す。質問タイプ推定や AI マッピングの入力に使う。
export function summarizeColumns(parsed: ParsedCsv): ColumnSample[] {
  return parsed.headers.map((header, index) => {
    const values: string[] = [];
    const uniques = new Set<string>();
    for (const row of parsed.rows) {
      const v = (row[index] ?? "").trim();
      if (v.length === 0) continue;
      values.push(v);
      uniques.add(v);
    }
    return {
      header,
      index,
      nonEmptyCount: values.length,
      sample: values.slice(0, MAX_SAMPLE_PER_COLUMN),
      uniqueCount: uniques.size
    };
  });
}

// 列値から質問タイプを推定する。
// scale: "10" "8" 等の整数（0-10 or 1-5 が中心）が大半
// multi_choice: 値にカンマ "," または "、" が頻繁に含まれる
// long_text: 平均文字数 30+ または最大値 100+
// choice: ユニーク値数が（行数/2）以下で、上のいずれにも該当しない
// text: それ以外（短い自由記述）
export type InferredQuestionType = "scale" | "choice" | "multi_choice" | "long_text" | "text";

export function inferQuestionType(sample: ColumnSample, totalRows: number): InferredQuestionType {
  if (sample.nonEmptyCount === 0) return "text";

  const values = sample.sample;

  // ① 数値系（scale）が最優先
  const allNumeric = values.length > 0 && values.every((v) => /^-?\d+(\.\d+)?$/.test(v));
  if (allNumeric) {
    const nums = values.map((v) => Number(v));
    const max = Math.max(...nums);
    const min = Math.min(...nums);
    if (max <= 10 && min >= 0) return "scale";
  }

  // ② 長文（avg 25+ または max 80+）は multi_choice より優先
  // 長文に「、」が含まれていてもそれは並列表現で multi_choice ではない
  const avgLen = values.reduce((a, b) => a + b.length, 0) / Math.max(1, values.length);
  const maxLen = values.reduce((a, b) => Math.max(a, b.length), 0);
  if (avgLen >= 25 || maxLen >= 80) return "long_text";

  // ③ multi_choice：カンマ区切りで複数値を含む比率が高い
  const multiCommaRatio =
    values.filter((v) => v.includes(",") || v.includes("、")).length / Math.max(1, values.length);
  if (multiCommaRatio >= 0.4) return "multi_choice";

  // ④ choice：ユニーク値数が少ない
  if (sample.uniqueCount > 0 && totalRows > 0 && sample.uniqueCount <= Math.max(8, totalRows / 2)) {
    return "choice";
  }
  return "text";
}
