import { describe, it, expect } from "vitest";
import { buildFolderName, parseFolderName } from "./drive-naming";

describe("drive-naming.buildFolderName", () => {
  it("規定フォーマット [YYYY-MM-DD] 会社名 を生成する", () => {
    expect(buildFolderName({ companyName: "イオン九州", date: "2026-05-04" })).toBe(
      "[2026-05-04] イオン九州",
    );
  });

  it("ISO datetime も受理して日付部分のみ使う", () => {
    expect(buildFolderName({ companyName: "Acme", date: "2026-05-04T15:30:00Z" })).toBe(
      "[2026-05-04] Acme",
    );
  });

  it("date 省略時は今日の日付が入る", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(buildFolderName({ companyName: "Acme" })).toBe(`[${today}] Acme`);
  });

  it("禁止文字 / \\ : ? * | < > を除去する", () => {
    expect(buildFolderName({ companyName: "A/B\\C:D?E*F", date: "2026-01-01" })).toBe(
      "[2026-01-01] ABCDEF",
    );
  });

  it("200文字超は会社名側を切り詰める", () => {
    const long = "あ".repeat(300);
    const out = buildFolderName({ companyName: long, date: "2026-01-01" });
    expect(out.length).toBeLessThanOrEqual(200);
    expect(out.startsWith("[2026-01-01] ")).toBe(true);
  });

  it("companyName 空文字はエラー", () => {
    expect(() => buildFolderName({ companyName: "  ", date: "2026-01-01" })).toThrow();
  });

  it("不正日付はエラー", () => {
    expect(() => buildFolderName({ companyName: "x", date: "not-a-date" })).toThrow();
  });
});

describe("drive-naming.parseFolderName", () => {
  it("正規化フォーマットを分解する", () => {
    expect(parseFolderName("[2026-05-04] イオン九州")).toEqual({
      date: "2026-05-04",
      companyName: "イオン九州",
    });
  });

  it("形式不一致は null", () => {
    expect(parseFolderName("イオン九州")).toBeNull();
    expect(parseFolderName("2026-05-04 イオン")).toBeNull();
  });

  it("buildFolderName と parseFolderName は逆変換", () => {
    const name = buildFolderName({ companyName: "テスト株式会社", date: "2026-12-31" });
    expect(parseFolderName(name)).toEqual({
      date: "2026-12-31",
      companyName: "テスト株式会社",
    });
  });
});
