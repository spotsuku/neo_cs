// 決定論的な AI 分析モック。
// - scale 質問: 平均値・分布から「強み(positive/strength)」「弱み(concern/weakness)」を判定
// - 自由記述: VOC で使われているキーワード辞書を流用して category 分類
// 出力は SurveyInsightRecord[] と short summary。

import type { SurveyInsightRecord } from "@/lib/repository/types";
import type { InsightInput, InsightOutput } from "./types";

const KEYWORDS: Record<SurveyInsightRecord["category"], string[]> = {
  positive: ["良かった", "わかりやすい", "面白い", "楽しい", "感謝", "ありがとう", "成長", "学べた"],
  concern: ["不安", "難しい", "足りない", "わかりにくい", "不足", "迷"],
  suggestion: ["欲しい", "あれば", "してほしい", "増やして", "拡充", "改善できれば"],
  complaint: ["遅い", "悪い", "ひどい", "不満", "つまらない", "意味がない"],
  strength: [],
  weakness: []
};

export function extractInsightsMock(input: InsightInput): InsightOutput {
  const { surveyId, questions, responses } = input;
  const insights: SurveyInsightRecord[] = [];
  const now = new Date().toISOString();
  let id = 1;

  // ① scale 質問の strength/weakness
  for (const q of questions) {
    if (q.type !== "scale") continue;
    const values: number[] = [];
    const sources: string[] = [];
    for (const r of responses) {
      const a = r.answers.find((x) => x.questionId === q.id);
      if (!a) continue;
      const n = typeof a.value === "number" ? a.value : Number(a.value);
      if (!Number.isNaN(n)) {
        values.push(n);
        sources.push(r.id);
      }
    }
    if (values.length === 0) continue;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const max = q.scaleMax ?? 5;
    const ratio = mean / max;
    if (ratio >= 0.8) {
      insights.push({
        id: `ins-${surveyId}-${id++}`,
        surveyId,
        questionId: q.id,
        category: "strength",
        summary: `「${q.text}」の平均は ${mean.toFixed(2)} / ${max} と高く、強みとして評価されている`,
        sourceResponseIds: sources,
        confidence: 0.85,
        createdAt: now
      });
    } else if (ratio < 0.6) {
      insights.push({
        id: `ins-${surveyId}-${id++}`,
        surveyId,
        questionId: q.id,
        category: "weakness",
        summary: `「${q.text}」の平均は ${mean.toFixed(2)} / ${max} と低く、改善余地がある`,
        sourceResponseIds: sources,
        confidence: 0.8,
        createdAt: now
      });
    }
  }

  // ② 自由記述のキーワード分類
  for (const q of questions) {
    if (q.type !== "long_text" && q.type !== "text") continue;
    for (const cat of ["positive", "concern", "suggestion", "complaint"] as const) {
      const matched: typeof responses = [];
      for (const r of responses) {
        const a = r.answers.find((x) => x.questionId === q.id);
        if (!a || typeof a.value !== "string") continue;
        const text = a.value as string;
        if (KEYWORDS[cat].some((kw) => text.includes(kw))) matched.push(r);
      }
      if (matched.length === 0) continue;
      insights.push({
        id: `ins-${surveyId}-${id++}`,
        surveyId,
        questionId: q.id,
        category: cat,
        summary: `「${q.text}」の自由記述から ${categoryLabel(cat)} の声が ${matched.length} 件抽出されました`,
        sourceResponseIds: matched.map((r) => r.id),
        confidence: 0.65,
        createdAt: now
      });
    }
  }

  const strengthCount = insights.filter((i) => i.category === "strength").length;
  const weaknessCount = insights.filter((i) => i.category === "weakness").length;
  const concernCount = insights.filter((i) => i.category === "concern" || i.category === "complaint").length;
  const summary = `決定論的モックによる分析: 強み ${strengthCount} / 弱み ${weaknessCount} / 懸念 ${concernCount} を抽出（全${insights.length}件）`;

  return { insights, summary };
}

function categoryLabel(c: SurveyInsightRecord["category"]): string {
  return {
    positive: "ポジティブ",
    concern: "懸念",
    suggestion: "改善提案",
    complaint: "不満",
    strength: "強み",
    weakness: "弱み"
  }[c];
}
