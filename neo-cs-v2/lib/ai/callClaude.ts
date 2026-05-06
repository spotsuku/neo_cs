/**
 * /api/claude プロキシを叩くためのクライアント側ヘルパ。
 *
 * - purpose は型で固定（route.ts の MODEL_BY_PURPOSE と一致）
 * - Supabase の access_token を Bearer として自動付与
 * - レスポンスは Anthropic Messages API そのまま
 *   ({ content: [{ type, text }], usage: {...} } 形式)
 *
 * 使い方:
 *   const text = await callClaudeText({
 *     purpose: "survey_insight",
 *     system: "あなたはCSアナリストです",
 *     messages: [{ role: "user", content: "..." }],
 *   });
 */
import { createBrowserClient } from "@supabase/ssr";

export type ClaudePurpose =
  | "survey_insight"
  | "survey_import"
  | "weekly_review"
  | "voc_extraction"
  | "mail_analysis"
  | "mail_extraction"
  | "mail_reply"
  | "mail_summary";

export type ClaudeMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ClaudeRequest = {
  purpose: ClaudePurpose;
  messages: ClaudeMessage[];
  system?: string;
};

export type ClaudeResponse = {
  content: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

export class ClaudeApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public requestId?: string,
    public retryAfterSec?: number,
  ) {
    super(`claude_api_error: ${code} (status=${status}, request_id=${requestId ?? "-"})`);
    this.name = "ClaudeApiError";
  }
}

let cachedBrowserToken: { token: string; expiresAt: number } | null = null;

async function getBearerToken(): Promise<string> {
  const now = Date.now();
  if (cachedBrowserToken && cachedBrowserToken.expiresAt > now + 30_000) {
    return cachedBrowserToken.token;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new ClaudeApiError(500, "supabase_env_missing");
  const sb = createBrowserClient(url, anon);
  const { data, error } = await sb.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new ClaudeApiError(401, "no_session");
  }
  const token = data.session.access_token;
  const expiresAt =
    typeof data.session.expires_at === "number"
      ? data.session.expires_at * 1000
      : now + 60_000;
  cachedBrowserToken = { token, expiresAt };
  return token;
}

/** raw 形式 (Anthropic Messages API そのまま) を返す */
export async function callClaude(req: ClaudeRequest): Promise<ClaudeResponse> {
  const token = await getBearerToken();
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(req),
  });
  const reqId = res.headers.get("X-Request-Id") ?? undefined;
  if (!res.ok) {
    let code = `http_${res.status}`;
    let retryAfterSec: number | undefined;
    try {
      const body = (await res.json()) as { error?: string; retry_after_sec?: number };
      if (body.error) code = body.error;
      if (typeof body.retry_after_sec === "number") retryAfterSec = body.retry_after_sec;
    } catch {
      /* ignore */
    }
    throw new ClaudeApiError(res.status, code, reqId, retryAfterSec);
  }
  return (await res.json()) as ClaudeResponse;
}

/** content から text を結合して返すショートハンド */
export async function callClaudeText(req: ClaudeRequest): Promise<string> {
  const data = await callClaude(req);
  return data.content
    .map((c) => (c.type === "text" ? c.text ?? "" : ""))
    .join("")
    .trim();
}
