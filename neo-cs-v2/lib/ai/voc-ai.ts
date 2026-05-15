// VoC 候補抽出 (Claude による semantic 分類版)
//
// 役割:
//   - lib/domain/voc/voc.ts の extractVocCandidates と同じ I/F を保ちつつ、
//     キーワード辞書ではなく Claude API で要望/不満/提案を抽出する
//   - extractVocCandidates (sync) はクライアントプレビュー用に存続。本関数は
//     Server Action 経由でのみ呼ばれる前提 ("server-only" を import)
//
// フォールバック:
//   - ANTHROPIC_API_KEY 未設定 / DEGRADED_ANTHROPIC=true → keyword 版にフォールバック
//   - API エラー / parse 失敗 → keyword 版にフォールバック
//   - 個別の text 長さ < 5 文字は skip
//
// batch 設計:
//   - 1 リクエストに複数 input を載せる (id をキーに紐付ける) ことで
//     呼び出しコストを抑える。Claude は item 配列で返す
//   - 入力件数が多い場合は BATCH_SIZE 件ずつチャンクして直列に呼ぶ

import "server-only";
import {
  extractVocCandidates,
  type VocCandidate,
  type VocSourceTextInput,
  type VocTag
} from "@/lib/domain/voc/voc";
import { fetchHard } from "@/lib/security/http";
import { getLogger } from "@/lib/observability/logger";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL =
  process.env.CLAUDE_MODEL_VOC_EXTRACTION ??
  process.env.CLAUDE_MODEL ??
  "claude-sonnet-4-6";

/** 1 リクエストで扱う最大件数 (プロンプト爆発防止) */
const BATCH_SIZE = 20;
/** Claude に渡す 1 件あたりの本文最大長 */
const TEXT_MAX = 4000;

const VALID_TAGS: ReadonlySet<VocTag> = new Set<VocTag>([
  "feature_request",
  "ui_improvement",
  "content_request",
  "scheduling",
  "pricing",
  "integration",
  "bug_report",
  "other"
]);

export const VOC_AI_SYSTEM_PROMPT = `あなたは B2B カスタマーサクセスの VoC 分析者です。
顧客の発言 (アンケート回答 / 商談ログ / 週次レビュー等) から、
要望・課題・改善提案を抽出し、適切なタグと緊急度を付与してください。

各入力テキストに対し、以下を判定してください:
- isVoc: 要望・不満・改善提案など VoC として扱うべき発言か (営業挨拶 / 自動配信 / 称賛のみは false)
- excerpt: 根拠となる本文からの抜粋 (200 字以内、原文の語句を保持)
- tags: 該当タグを 1 つ以上 (複数該当可)
    - feature_request: 機能追加・新機能要望
    - ui_improvement: UI・操作性の改善
    - content_request: 教材・資料・コンテンツ要望
    - scheduling: 日程・時間帯・運用上の要望
    - pricing: 価格・プラン・費用に関する声
    - integration: 他システム連携 (Slack / Salesforce 等)
    - bug_report: 不具合・エラー
    - other: 上記いずれでもない VoC
- priority: 緊急度
    - high: 解約検討・重大な不具合・複数顧客から類似要望
    - med: 通常の要望
    - low: あれば嬉しい程度の軽微な要望
- reasoning: 判定理由 (120 字以内)

出力は strict JSON のみ:
{
  "items": [
    {
      "id": "<入力で与えられた id>",
      "isVoc": true | false,
      "excerpt": "...",
      "tags": ["feature_request", ...],
      "priority": "low" | "med" | "high",
      "reasoning": "..."
    }
  ]
}

注意:
- 入力で与えた全ての id について必ず 1 件返す (isVoc=false でも返す)
- excerpt は原文の語句を引用 (要約しない)
- tags は最低 1 つ。該当が無ければ ["other"]`;

type AiVocItem = {
  id?: string;
  isVoc?: boolean;
  excerpt?: string;
  tags?: string[];
  priority?: "low" | "med" | "high";
  reasoning?: string;
};

type AiVocResponse = { items?: AiVocItem[] };

/** AI 抽出結果に付随するメタ (UI/Server Action 側で利用) */
export type VocAiMeta = {
  priority: "low" | "med" | "high";
  reasoning: string;
};

/** AI 出力用の拡張 candidate (VocCandidate の全フィールド + AI メタ) */
export type VocAiCandidate = VocCandidate & { aiMeta: VocAiMeta };

/**
 * Claude による VoC 抽出。失敗時は keyword 版にフォールバック。
 * 戻り値型は VocCandidate[] (extractVocCandidates と同一 I/F)。
 *
 * AI メタ (priority / reasoning) も欲しい場合は extractVocCandidatesWithAIVerbose を使う。
 */
export async function extractVocCandidatesWithAI(
  inputs: VocSourceTextInput[]
): Promise<VocCandidate[]> {
  const verbose = await extractVocCandidatesWithAIVerbose(inputs);
  return verbose.map(({ aiMeta: _aiMeta, ...rest }) => rest);
}

/** AI メタ付きで返す版 (Server Action から priority を VocItem に反映するため) */
export async function extractVocCandidatesWithAIVerbose(
  inputs: VocSourceTextInput[]
): Promise<VocAiCandidate[]> {
  const log = (await getLogger()).child({ integration: "voc-ai" });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || process.env.DEGRADED_ANTHROPIC === "true") {
    log.info({
      kind: "fallback_to_keyword",
      reason: !apiKey ? "no_api_key" : "degraded",
      count: inputs.length
    });
    return extractVocCandidates(inputs).map((c) => ({
      ...c,
      aiMeta: { priority: "med", reasoning: "keyword fallback" }
    }));
  }

  const valid = inputs.filter((i) => i.text && i.text.length >= 5);
  if (valid.length === 0) return [];

  const detectedAt = new Date().toISOString();
  const out: VocAiCandidate[] = [];
  const seen = new Set<string>(); // sourceId + excerpt の重複排除

  // BATCH_SIZE 件ずつ直列に呼ぶ (並列にすると rate limit が怖い)
  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const chunk = valid.slice(i, i + BATCH_SIZE);
    const result = await callClaudeForChunk(chunk, apiKey, log);
    if (!result) {
      // chunk 単位で失敗した場合、その chunk のみ keyword 版にフォールバック
      const fb = extractVocCandidates(chunk, detectedAt);
      for (const c of fb) {
        const key = `${c.sourceId}::${c.excerpt}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          ...c,
          aiMeta: { priority: "med", reasoning: "keyword fallback (AI error)" }
        });
      }
      continue;
    }

    // id → input の map (id は chunk 内のローカル index で採番)
    const byId = new Map<string, VocSourceTextInput>();
    for (let j = 0; j < chunk.length; j++) {
      byId.set(idForIndex(j), chunk[j]);
    }

    for (const item of result.items ?? []) {
      if (!item || item.isVoc !== true) continue;
      const src = item.id ? byId.get(item.id) : undefined;
      if (!src) continue;
      const excerpt = (item.excerpt ?? "").trim().slice(0, 200);
      if (excerpt.length === 0) continue;
      const tags = Array.isArray(item.tags)
        ? (item.tags.filter((t): t is VocTag =>
            VALID_TAGS.has(t as VocTag)
          ) as VocTag[])
        : [];
      const suggestedTags: VocTag[] = tags.length > 0 ? tags : ["other"];
      const priority: "low" | "med" | "high" =
        item.priority === "low" || item.priority === "high"
          ? item.priority
          : "med";
      const reasoning =
        typeof item.reasoning === "string" ? item.reasoning.slice(0, 200) : "";

      const key = `${src.sourceId}::${excerpt}`;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({
        sourceType: src.sourceType,
        sourceId: src.sourceId,
        contractId: src.contractId,
        companyId: src.companyId,
        excerpt,
        matchedKeywords: ["AI"],
        suggestedTags,
        detectedAt,
        aiMeta: { priority, reasoning }
      });
    }
  }

  log.info({ kind: "ai_extracted", input: valid.length, output: out.length });
  return out;
}

function idForIndex(idx: number): string {
  return `voc_${idx}`;
}

async function callClaudeForChunk(
  chunk: VocSourceTextInput[],
  apiKey: string,
  log: Awaited<ReturnType<typeof getLogger>>
): Promise<AiVocResponse | null> {
  const userPrompt = buildUserPrompt(chunk);
  try {
    const { response } = await fetchHard(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: VOC_AI_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }]
      }),
      timeoutMs: 45_000,
      retryNonIdempotent: true
    });
    if (!response.ok) {
      const text = await response.text();
      log.warn({
        kind: "claude_http_error",
        status: response.status,
        body: text.slice(0, 500)
      });
      return null;
    }
    const json = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (json.content ?? [])
      .map((c) => (c.type === "text" ? c.text ?? "" : ""))
      .join("");
    const cleaned = text
      .replace(/^[\s\S]*?```json\s*/i, "")
      .replace(/```[\s\S]*$/, "")
      .trim();
    const parsed = JSON.parse(
      cleaned.length > 0 ? cleaned : text
    ) as AiVocResponse;
    return parsed;
  } catch (e) {
    log.warn({ kind: "claude_parse_failed", message: (e as Error).message });
    return null;
  }
}

/** Claude に渡す user メッセージを構築 (id を採番して紐付け) */
export function buildUserPrompt(chunk: VocSourceTextInput[]): string {
  const blocks = chunk.map((input, idx) => {
    const id = idForIndex(idx);
    const text = (input.text ?? "").slice(0, TEXT_MAX);
    return [
      `--- item ---`,
      `id: ${id}`,
      `source_type: ${input.sourceType}`,
      `source_id: ${input.sourceId}`,
      `text:`,
      text
    ].join("\n");
  });
  return [
    `以下 ${chunk.length} 件の顧客発言について、JSON で VoC 判定結果を返してください。`,
    "id は必ずそのまま含めてください。",
    "",
    ...blocks
  ].join("\n");
}
