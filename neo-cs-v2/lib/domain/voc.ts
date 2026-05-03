// Voice of Customer (VOC) 候補抽出 (純関数 — health/churn/expansion/renewal と同じ設計)
//
// 設計原則:
//   - 副作用なし。Repository を取らない。プレーンテキスト + メタ情報のみ受ける
//   - mock 時点はキーワード辞書 + 簡易ルールベース
//   - 将来 Anthropic API でセマンティック分類に置換する際も同じ I/F (extractVocCandidates)
//
// 抽出ルール:
//   1. キーワード辞書 (REQUEST_KEYWORDS) のいずれかに textが含まれる場合「要望候補」
//   2. 該当タグ (TAG_KEYWORDS) を全て付与 (複数該当可)
//   3. 文を最大 SENTENCE_MAX 文字で抽出 (前後の文脈を含む excerpt)
//
// reviews/05_事業営業責任者.md / reviews/12_他部署連携.md:
//   顧客の声を構造化して開発に届ける導線が無い、を解消

export type VocSourceType = "survey_response" | "meeting_log" | "weekly_review";

export type VocCandidate = {
  /** 抽出元 */
  sourceType: VocSourceType;
  sourceId: string;
  /** 紐付け先 (任意) */
  contractId?: string;
  companyId?: string;
  /** 元テキストから切り出した抜粋 (最大 SENTENCE_MAX 文字) */
  excerpt: string;
  /** マッチしたキーワード(複数) */
  matchedKeywords: string[];
  /** カテゴリタグ候補 */
  suggestedTags: VocTag[];
  detectedAt: string;
};

export type VocTag =
  | "feature_request"
  | "ui_improvement"
  | "content_request"
  | "scheduling"
  | "pricing"
  | "integration"
  | "bug_report"
  | "other";

export const VOC_TAG_LABEL: Record<VocTag, string> = {
  feature_request: "機能要望",
  ui_improvement: "UI改善",
  content_request: "コンテンツ要望",
  scheduling: "日程・運用",
  pricing: "価格・プラン",
  integration: "連携",
  bug_report: "不具合報告",
  other: "その他"
};

// ── 抽出キーワード ──────────────────────────────────────────────
// 「要望っぽい」発言を検出する語彙。最小限から始める。
const REQUEST_KEYWORDS = [
  "してほしい",
  "して欲しい",
  "してほしかった",
  "があれば",
  "が欲しい",
  "があると",
  "を追加",
  "を導入",
  "が不便",
  "やりにくい",
  "わかりにくい",
  "改善",
  "拡張",
  "対応してほしい",
  "あったら嬉しい",
  "オプション",
  "機能を",
  "オプションで"
];

// タグ判定用キーワード辞書 (VocTag => keywords)
const TAG_KEYWORDS: Record<VocTag, string[]> = {
  feature_request: ["機能", "機能を", "を追加", "を導入"],
  ui_improvement: ["UI", "画面", "見た目", "わかりにくい", "操作", "やりにくい"],
  content_request: ["コンテンツ", "教材", "資料", "動画", "事例", "ケーススタディ"],
  scheduling: ["日程", "時間帯", "夜", "土日", "オンライン", "リスケ"],
  pricing: ["価格", "値段", "費用", "料金", "プラン", "見積"],
  integration: ["連携", "API", "Slack", "Salesforce", "freee", "Notion"],
  bug_report: ["バグ", "不具合", "動かない", "エラー", "落ちる"],
  other: []
};

const SENTENCE_MAX = 140;

function pickExcerpt(text: string, keyword: string): string {
  const idx = text.indexOf(keyword);
  if (idx < 0) return text.slice(0, SENTENCE_MAX);
  // キーワード前後 ±60 文字程度を抽出
  const start = Math.max(0, idx - 60);
  const end = Math.min(text.length, idx + keyword.length + 80);
  let out = text.slice(start, end);
  if (start > 0) out = "…" + out;
  if (end < text.length) out = out + "…";
  return out.length > SENTENCE_MAX ? out.slice(0, SENTENCE_MAX) + "…" : out;
}

function inferTags(text: string): VocTag[] {
  const tags = new Set<VocTag>();
  for (const [tag, kws] of Object.entries(TAG_KEYWORDS) as [VocTag, string[]][]) {
    if (tag === "other") continue;
    for (const kw of kws) {
      if (text.includes(kw)) {
        tags.add(tag);
        break;
      }
    }
  }
  if (tags.size === 0) tags.add("other");
  return Array.from(tags);
}

export type VocSourceTextInput = {
  sourceType: VocSourceType;
  sourceId: string;
  text: string;
  contractId?: string;
  companyId?: string;
};

export function extractVocCandidates(
  inputs: VocSourceTextInput[],
  asOf: string = new Date().toISOString()
): VocCandidate[] {
  const out: VocCandidate[] = [];
  const seen = new Set<string>(); // sourceId + excerpt の重複排除

  for (const input of inputs) {
    if (!input.text || input.text.length < 5) continue;
    const matched: string[] = [];
    for (const kw of REQUEST_KEYWORDS) {
      if (input.text.includes(kw)) matched.push(kw);
    }
    if (matched.length === 0) continue;

    const excerpt = pickExcerpt(input.text, matched[0]);
    const dedupKey = `${input.sourceId}::${excerpt}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    out.push({
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      contractId: input.contractId,
      companyId: input.companyId,
      excerpt,
      matchedKeywords: matched,
      suggestedTags: inferTags(input.text),
      detectedAt: asOf
    });
  }

  return out;
}

/** 単一テキストの簡易チェック (UI の「VOC候補をスキャン」プレビュー用) */
export function isLikelyVoc(text: string): boolean {
  if (!text || text.length < 5) return false;
  return REQUEST_KEYWORDS.some((kw) => text.includes(kw));
}
