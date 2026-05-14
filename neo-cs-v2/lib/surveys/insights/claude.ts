// Claude API による分析（API KEY 設定後に有効化される）。
// 現状は KEY 未設定運用前提のスタブ。実装は別タスクで /api/claude 経由に乗せる。

import type { InsightInput, InsightOutput } from "./types";

export async function extractInsightsClaude(_input: InsightInput): Promise<InsightOutput> {
  throw new Error(
    "extractInsightsClaude is not implemented yet. Set ANTHROPIC_API_KEY and implement before enabling."
  );
}
