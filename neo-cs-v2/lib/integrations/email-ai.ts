// 受信メール → AI 抽出パイプライン (Claude)
//
// 役割:
//   - inbound メールの本文を Claude に渡し、CS 業務に必要なシグナルを抽出
//   - 抽出種別: progress_signal / risk_signal / churn_signal /
//     expansion_signal / meeting_request
//   - 抽出結果は ai_extractions に「未承認 (reviewed=false)」で保存
//   - /inbox/extractions で人間がレビュー → 承認時にジャーニーや todo に反映
//
// 設計判断:
//   - cron 内から呼ぶため /api/claude プロキシ経由ではなく Anthropic API を直叩き
//   - ANTHROPIC_API_KEY 未設定なら no-op (本番環境変数で制御)
//   - JSON 強制 (Claude の output を JSON.parse できる形にプロンプトで誘導)
//   - 抽出が空でも error にしない (ノイズ的な短文に対する安全弁)

import "server-only";
import {
  aiExtractionRepo,
  type AiExtractionType
} from "@/lib/repository/server";
import { fetchHard } from "@/lib/security/http";
import { getLogger } from "@/lib/observability/logger";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL =
  process.env.CLAUDE_MODEL_MAIL_EXTRACTION ??
  process.env.CLAUDE_MODEL ??
  "claude-sonnet-4-6";

const SYSTEM_PROMPT = `あなたはB2B カスタマーサクセスのアナリストです。受信メールの本文から、
担当 CS が把握しておくべきシグナルを構造化抽出してください。

抽出種別 (extraction_type):
  - progress_signal:  オンボーディング進捗 / タスク完了 / 担当者交代など前進系
  - risk_signal:      不満・困りごと・利用減・体制リスクなどの懸念
  - churn_signal:     解約検討を匂わせる発言・予算カット・代替検討
  - expansion_signal: 利用拡大・追加発注・他部門への展開意向
  - meeting_request:  打合せ依頼・日程調整

出力は strict JSON:
{
  "extractions": [
    {
      "type": "progress_signal" | "risk_signal" | "churn_signal" | "expansion_signal" | "meeting_request",
      "excerpt": "本文からの根拠引用 (200 字以内)",
      "confidence": 0.0-1.0,
      "suggested_action": "CS が取るべき次の一手 (任意, 80 字以内)"
    }
  ]
}

注意:
- 該当シグナルが無い場合は空配列 ({"extractions": []})
- 営業挨拶・自動配信・社内連絡など業務上意味のないメールは空配列
- excerpt は原文の引用、suggested_action は提案文 (動詞で始める)
- 最大 3 件まで`;

type ExtractionItem = {
  type: AiExtractionType;
  excerpt: string;
  confidence?: number;
  suggested_action?: string;
};

type ExtractionResult = { extractions: ExtractionItem[] };

const VALID_TYPES: ReadonlySet<AiExtractionType> = new Set<AiExtractionType>([
  "progress_signal",
  "risk_signal",
  "churn_signal",
  "expansion_signal",
  "meeting_request"
]);

export type EmailExtractionInput = {
  organizationId: string;
  /** email_messages.id */
  messageId: string;
  companyId?: string;
  companyName?: string;
  subject: string;
  body: string;
  senderEmail: string;
  sentAt: string;
};

export type EmailExtractionStats = {
  attempted: boolean;
  saved: number;
  reason?: string;
};

/**
 * 1 通の inbound メールから AI 抽出を実行し ai_extractions に保存。
 * ANTHROPIC_API_KEY 未設定 / DEGRADED_ANTHROPIC=true 時は noop。
 */
export async function extractAndSaveEmailSignals(
  input: EmailExtractionInput
): Promise<EmailExtractionStats> {
  const log = (await getLogger()).child({
    integration: "email-ai",
    messageId: input.messageId,
    companyId: input.companyId
  });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { attempted: false, saved: 0, reason: "no_api_key" };
  if (process.env.DEGRADED_ANTHROPIC === "true") {
    return { attempted: false, saved: 0, reason: "degraded" };
  }
  // 本文が短すぎる場合は skip (挨拶程度)
  const body = (input.body ?? "").trim();
  if (body.length < 40) return { attempted: false, saved: 0, reason: "too_short" };

  const userPrompt = [
    `件名: ${input.subject}`,
    `送信者: ${input.senderEmail}`,
    input.companyName ? `企業: ${input.companyName}` : "",
    `送信日時: ${input.sentAt}`,
    "",
    "本文:",
    body.slice(0, 8000)
  ]
    .filter(Boolean)
    .join("\n");

  let parsed: ExtractionResult;
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
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }]
      }),
      timeoutMs: 30_000,
      retryNonIdempotent: true
    });
    if (!response.ok) {
      const text = await response.text();
      log.warn({
        kind: "claude_http_error",
        status: response.status,
        body: text.slice(0, 500)
      });
      return { attempted: true, saved: 0, reason: `http_${response.status}` };
    }
    const json = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (json.content ?? [])
      .map((c) => (c.type === "text" ? c.text ?? "" : ""))
      .join("");
    // Claude が ```json ... ``` で包む場合に剥がす
    const cleaned = text
      .replace(/^[\s\S]*?```json\s*/i, "")
      .replace(/```[\s\S]*$/, "")
      .trim();
    parsed = JSON.parse(cleaned.length > 0 ? cleaned : text) as ExtractionResult;
  } catch (e) {
    log.warn({ kind: "claude_parse_failed", message: (e as Error).message });
    return { attempted: true, saved: 0, reason: "parse_failed" };
  }

  const items = Array.isArray(parsed.extractions) ? parsed.extractions : [];
  let saved = 0;
  for (const it of items.slice(0, 3)) {
    if (!VALID_TYPES.has(it.type as AiExtractionType)) continue;
    const excerpt = (it.excerpt ?? "").trim();
    if (excerpt.length === 0) continue;
    try {
      await aiExtractionRepo.create({
        organizationId: input.organizationId,
        sourceType: "email",
        sourceId: input.messageId,
        companyId: input.companyId,
        extractionType: it.type as AiExtractionType,
        excerpt: excerpt.slice(0, 500),
        confidence:
          typeof it.confidence === "number"
            ? Math.max(0, Math.min(1, it.confidence))
            : undefined,
        suggestedAction: it.suggested_action?.slice(0, 200)
      });
      saved++;
    } catch (e) {
      log.warn({
        kind: "extraction_save_failed",
        message: (e as Error).message
      });
    }
  }
  log.info({ kind: "extracted", saved, candidates: items.length });
  return { attempted: true, saved };
}
