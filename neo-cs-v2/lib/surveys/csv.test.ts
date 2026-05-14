import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseSurveyCsv, summarizeColumns, inferQuestionType } from "./csv";

const DOWNLOADS = "/Users/furuken/Downloads";
const ACADEMIA_CSV = resolve(
  DOWNLOADS,
  "NEO ACADEMIA 1年間の振り返りアンケート（回答） - フォームの回答 1.csv"
);
const PRE_TRAINING_CSV = resolve(
  DOWNLOADS,
  "4_27 事前研修事後アンケート_回答_2026-05-01.csv"
);

describe("parseSurveyCsv", () => {
  it("BOM/CRLF/引用符内改行を含む合成CSVを正しくパースする", () => {
    const csv = `﻿id,氏名,コメント\r\n1,"太郎","これは\n複数行コメント"\r\n2,"花子","通常コメント"\r\n`;
    const parsed = parseSurveyCsv(csv);
    expect(parsed.headers).toEqual(["id", "氏名", "コメント"]);
    expect(parsed.rowCount).toBe(2);
    expect(parsed.rows[0]).toEqual(["1", "太郎", "これは\n複数行コメント"]);
    expect(parsed.rows[1]).toEqual(["2", "花子", "通常コメント"]);
  });

  it("空CSVは空配列を返す", () => {
    const parsed = parseSurveyCsv("");
    expect(parsed.rowCount).toBe(0);
    expect(parsed.headers).toEqual([]);
  });

  it("列数不揃いの行も headers 長に揃える", () => {
    const csv = "a,b,c\n1,2\n3,4,5,6";
    const parsed = parseSurveyCsv(csv);
    expect(parsed.columnCount).toBe(3);
    expect(parsed.rows[0]).toEqual(["1", "2", ""]);
    expect(parsed.rows[1]).toEqual(["3", "4", "5"]);
  });
});

describe("実 CSV ファイル取り込み（手元の Google Forms CSV）", () => {
  it.skipIf(!existsSync(ACADEMIA_CSV))(
    "NEO ACADEMIA 1年間の振り返り CSV (290行・44列・引用符内改行多数) を壊さずパースできる",
    () => {
      const raw = readFileSync(ACADEMIA_CSV, "utf-8");
      const parsed = parseSurveyCsv(raw);
      // ヘッダ列数（CSV の 1 行目をカンマで割っただけだと 30 弱、quoted/改行があるので少なくとも 40+ あるはず）
      expect(parsed.columnCount).toBeGreaterThanOrEqual(40);
      // データ行が大幅にズレていないこと（physical 290 行だが quoted 改行を含む実回答は ~58 件）
      expect(parsed.rowCount).toBeGreaterThanOrEqual(50);
      expect(parsed.rowCount).toBeLessThan(150);
      // タイムスタンプ列の値はすべて "yyyy/M/d" 形式で始まる
      const tsCol = parsed.headers.findIndex((h) => h.includes("タイムスタンプ"));
      expect(tsCol).toBeGreaterThanOrEqual(0);
      const tsValues = parsed.rows.map((r) => r[tsCol]).filter(Boolean);
      expect(tsValues.length).toBeGreaterThan(50);
      const wellFormed = tsValues.filter((v) => /^\d{4}\/\d{1,2}\/\d{1,2}/.test(v));
      // 大半が日付フォーマットなら列ズレ無し
      expect(wellFormed.length / tsValues.length).toBeGreaterThan(0.95);
    }
  );

  it.skipIf(!existsSync(PRE_TRAINING_CSV))(
    "4_27 事前研修事後アンケート CSV をパースし、企業名列が認識できる",
    () => {
      const raw = readFileSync(PRE_TRAINING_CSV, "utf-8");
      const parsed = parseSurveyCsv(raw);
      expect(parsed.rowCount).toBeGreaterThan(50);
      const companyCol = parsed.headers.findIndex((h) => h.includes("企業") || h.includes("学校"));
      expect(companyCol).toBeGreaterThanOrEqual(0);
      // 企業名列のサンプルが空でない
      const samples = parsed.rows.map((r) => r[companyCol]).filter((v) => v && v.length > 0);
      expect(samples.length).toBeGreaterThan(50);
    }
  );
});

describe("summarizeColumns + inferQuestionType", () => {
  it("数値10点満点列を scale と推定", () => {
    const csv = "Q1\n10\n9\n8\n7\n10\n";
    const parsed = parseSurveyCsv(csv);
    const samples = summarizeColumns(parsed);
    expect(inferQuestionType(samples[0], parsed.rowCount)).toBe("scale");
  });

  it("カンマ区切り複数選択は multi_choice と推定", () => {
    const csv = `Q1\n"A, B, C"\n"B, D"\n"A, B"\n"C, D"\n`;
    const parsed = parseSurveyCsv(csv);
    const samples = summarizeColumns(parsed);
    expect(inferQuestionType(samples[0], parsed.rowCount)).toBe("multi_choice");
  });

  it("長文自由記述は long_text と推定", () => {
    const csv =
      "Q1\nこれは30文字を超える長文の回答です、本当に長くて驚きました\nもう一つ別の長い回答、これも30文字を超えています\n";
    const parsed = parseSurveyCsv(csv);
    const samples = summarizeColumns(parsed);
    expect(inferQuestionType(samples[0], parsed.rowCount)).toBe("long_text");
  });
});
