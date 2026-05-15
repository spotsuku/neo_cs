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

// ─────────────────────────────────────────────
// 未割当スレッド向け: 企業候補提示 (on-demand)
// ─────────────────────────────────────────────
//
// /inbox/unassigned から手動トリガーで呼ばれる。
// 件名・本文・送信者・受信者と既知 companies 一覧を Claude に渡し、
// 最も尤もらしい企業 id (or null) を返してもらう。
// 履歴は ai_extractions に extraction_type="company_suggestion" で残す
// (reviewed=false; 採用クリック時に既存 assignThreadCompanyAction で
//  thread.company_id が更新されるが ai_extractions 自体は audit 用途)。

const COMPANY_SUGGEST_SYSTEM_PROMPT = `あなたは B2B カスタマーサクセスのメール振り分けアシスタントです。
受信メールの件名・本文・送信者・受信者と、既知の企業リストを与えられます。
このメールがどの企業のものか、最も尤もらしい候補を 1 件だけ選んでください。

判断材料:
- 送信者メールアドレスのドメイン
- 本文・件名に登場する企業名・サービス名
- 担当者名 (本文中の署名)
- メール文中の文脈

出力は strict JSON:
{
  "company_id": "<候補企業の id> | null",
  "confidence": 0.0-1.0,
  "reasoning": "なぜそう判断したか (120 字以内)"
}

注意:
- 確信が持てない (該当無し / 営業 DM / 自動配信) 場合は company_id を null にする
- company_id は必ず与えられたリストの id をそのまま返す (新規に作らない)
- confidence は控えめに (0.5 未満なら null を推奨)`;

export type CompanySuggestInput = {
  organizationId: string;
  /** email_threads.id (履歴の sourceId として使う) */
  threadId: string;
  subject: string;
  body: string;
  senderEmail: string;
  recipients: string[];
  companies: Array<{ id: string; name: string; emailDomains?: string[] }>;
};

export type CompanySuggestResult = {
  companyId: string | null;
  confidence: number;
  reasoning: string;
};

export async function suggestCompanyForThread(
  input: CompanySuggestInput
): Promise<CompanySuggestResult> {
  const log = (await getLogger()).child({
    integration: "email-ai",
    op: "suggest_company",
    threadId: input.threadId
  });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { companyId: null, confidence: 0, reasoning: "AI 未設定" };
  }
  if (process.env.DEGRADED_ANTHROPIC === "true") {
    return { companyId: null, confidence: 0, reasoning: "AI 一時停止中" };
  }

  // 企業リストが空なら呼ぶ意味がない
  if (input.companies.length === 0) {
    return { companyId: null, confidence: 0, reasoning: "候補企業がありません" };
  }

  const companyLines = input.companies
    .slice(0, 200) // プロンプト爆発防止
    .map((c) => {
      const domains =
        c.emailDomains && c.emailDomains.length > 0
          ? ` (domains: ${c.emailDomains.join(", ")})`
          : "";
      return `- id=${c.id} / name=${c.name}${domains}`;
    })
    .join("\n");

  const body = (input.body ?? "").trim().slice(0, 6000);
  const userPrompt = [
    `件名: ${input.subject}`,
    `送信者: ${input.senderEmail}`,
    `受信者: ${input.recipients.slice(0, 5).join(", ")}`,
    "",
    "既知の企業リスト:",
    companyLines,
    "",
    "本文:",
    body
  ].join("\n");

  let parsed: { company_id: string | null; confidence?: number; reasoning?: string };
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
        max_tokens: 512,
        system: COMPANY_SUGGEST_SYSTEM_PROMPT,
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
      return { companyId: null, confidence: 0, reasoning: "推論失敗" };
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
    parsed = JSON.parse(cleaned.length > 0 ? cleaned : text);
  } catch (e) {
    log.warn({ kind: "claude_parse_failed", message: (e as Error).message });
    return { companyId: null, confidence: 0, reasoning: "推論失敗" };
  }

  // company_id が与えたリストに存在するか検証
  const rawId =
    typeof parsed.company_id === "string" && parsed.company_id.length > 0
      ? parsed.company_id
      : null;
  const matched =
    rawId !== null ? input.companies.find((c) => c.id === rawId) ?? null : null;
  const companyId = matched ? matched.id : null;
  const confidence =
    typeof parsed.confidence === "number"
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0;
  const reasoning =
    typeof parsed.reasoning === "string" && parsed.reasoning.length > 0
      ? parsed.reasoning.slice(0, 200)
      : companyId
        ? "判断根拠なし"
        : "候補が見つかりませんでした";

  // 履歴を ai_extractions に保存 (失敗しても結果は返す)
  try {
    await aiExtractionRepo.create({
      organizationId: input.organizationId,
      sourceType: "email",
      sourceId: input.threadId,
      companyId: companyId ?? undefined,
      extractionType: "company_suggestion",
      excerpt: reasoning,
      confidence,
      suggestedAction: companyId ? `企業 ${companyId} へアサインを提案` : undefined
    });
  } catch (e) {
    log.warn({
      kind: "suggestion_save_failed",
      message: (e as Error).message
    });
  }

  log.info({ kind: "company_suggested", companyId, confidence });
  return { companyId, confidence, reasoning };
}
