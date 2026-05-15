// buildUserPrompt の構造テスト
//
// 本ファイルでは Claude API を叩く部分はテストしない (E2E / fixture でカバー)。
// id 採番 / 入力テキスト切詰めなど、純粋な prompt 構築ロジックのみ検証。

import { describe, it, expect } from "vitest";
import { buildUserPrompt } from "./voc-ai";

describe("buildUserPrompt", () => {
  it("入力件数と id を chunk 内 index で採番する", () => {
    const prompt = buildUserPrompt([
      { sourceType: "survey_response", sourceId: "s1", text: "機能を追加してほしい" },
      { sourceType: "meeting_log", sourceId: "m1", text: "価格が高い" }
    ]);
    expect(prompt).toContain("2 件");
    expect(prompt).toContain("id: voc_0");
    expect(prompt).toContain("id: voc_1");
    expect(prompt).toContain("source_id: s1");
    expect(prompt).toContain("source_id: m1");
    expect(prompt).toContain("機能を追加してほしい");
  });

  it("text が長すぎる場合は 4000 文字で切り詰める", () => {
    const long = "あ".repeat(10000);
    const prompt = buildUserPrompt([
      { sourceType: "weekly_review", sourceId: "w1", text: long }
    ]);
    // prompt 中の text ブロック以外にも文字があるので、概ね 4000 + ヘッダ程度に収まる
    const matches = prompt.match(/あ/g) ?? [];
    expect(matches.length).toBe(4000);
  });
});
