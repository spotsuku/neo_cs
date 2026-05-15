/**
 * /api/cron/unassigned-ai-suggest — 未割当スレッドへの AI 企業候補提示 自動バッチ
 *
 * 起動経路:
 *   1) Vercel Cron (vercel.json: 4時間毎 / 15分オフセット)
 *   2) 開発時のオンデマンド呼び出し
 *      - curl -H "Authorization: Bearer $CRON_SECRET" \
 *          http://localhost:3000/api/cron/unassigned-ai-suggest
 *
 * 認証 / inFlight ロック / Sentry / 構造化ログは churn-notify と同一パターン。
 */

import { NextRequest } from "next/server";
import { dispatchUnassignedAiSuggestions } from "@/lib/notifications/unassigned-ai-suggest";
import { getLogger } from "@/lib/observability/logger";
import { captureException } from "@/lib/observability/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let inFlight = false;

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = (await getLogger()).child({
    requestId,
    route: "api/cron/unassigned-ai-suggest"
  });

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    log.error({ kind: "misconfigured" }, "CRON_SECRET not set");
    return json({ error: "misconfigured", request_id: requestId }, 503);
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    log.warn({ kind: "unauthorized" });
    return json({ error: "unauthorized", request_id: requestId }, 401);
  }

  if (inFlight) {
    log.warn({ kind: "concurrent_skip" }, "another batch is in flight");
    return json(
      { status: "skipped", reason: "concurrent_run", request_id: requestId },
      200
    );
  }
  inFlight = true;
  const started = Date.now();

  try {
    const result = await dispatchUnassignedAiSuggestions();
    const latencyMs = Date.now() - started;
    log.info({
      kind: "unassigned_ai_suggest.done",
      latencyMs,
      ...result
    });
    return json(
      { status: "ok", request_id: requestId, latencyMs, ...result },
      200
    );
  } catch (e) {
    const latencyMs = Date.now() - started;
    log.error({
      kind: "unassigned_ai_suggest.failed",
      latencyMs,
      message: (e as Error).message
    });
    captureException(e, {
      tags: { route: "api/cron/unassigned-ai-suggest" },
      extra: { requestId }
    });
    return json({ error: "dispatch_failed", request_id: requestId }, 500);
  } finally {
    inFlight = false;
  }
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
