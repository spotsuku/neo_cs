// AI 分析の入口。ANTHROPIC_API_KEY が設定されていれば claude.ts を使い、
// 未設定なら mock.ts の決定論的実装にフォールバックする。
//
// 呼び出し元（API ルート）はこの index 経由で extractInsights() を呼ぶだけで OK。

import { extractInsightsMock } from "./mock";
import type { InsightInput, InsightOutput } from "./types";

export type { InsightInput, InsightOutput };

export async function extractInsights(input: InsightInput): Promise<InsightOutput> {
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  if (hasKey) {
    // dynamic import で API key 未設定時に Claude SDK 依存を引きずらない
    const { extractInsightsClaude } = await import("./claude");
    try {
      return await extractInsightsClaude(input);
    } catch (e) {
      // Claude 呼び出しに失敗したらモックにフォールバック（運用継続性優先）
      console.warn("[insights] Claude API failed, falling back to mock:", e);
      return extractInsightsMock(input);
    }
  }
  return extractInsightsMock(input);
}
