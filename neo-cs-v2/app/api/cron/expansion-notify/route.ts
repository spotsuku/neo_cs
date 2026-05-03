/**
 * /api/cron/expansion-notify — エクスパンション機会 Slack 通知バッチ
 *
 * 起動経路:
 *   1) Vercel Cron (vercel.json で週次定義: UTC月曜 0:00 = JST月曜 09:00)
 *      Authorization: Bearer ${CRON_SECRET}
 *   2) 手動キック (緊急時 / 検証)
 *
 * 動作:
 *   - 02 lib/notifications/expansion.ts:dispatchPendingExpansionNotifications() を呼ぶ
 *   - openOnly + unNotifiedOnly + score >= EXPANSION_NOTIFY_THRESHOLD のみ通過
 *   - 通知成功時は expansionOpportunityRepo.markNotified() で永続マーク (DB側)
 *   - dedup は slack.ts → lib/notifications/dedup.ts ファサード経由 (memory|supabase)
 *
 * churn-notify と同じガード:
 *   - inFlight ロック (同プロセス内同時起動防止)
 *   - 構造化ログ + Sentry連携
 *   - エラー詳細はクライアント非開示 (request_id のみ)
 */

import { NextRequest } from "next/server";
import { dispatchPendingExpansionNotifications } from "@/lib/notifications/expansion";
import { getLogger } from "@/lib/observability/logger";
import { captureException } from "@/lib/observability/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let inFlight = false;

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = (await getLogger()).child({ requestId, route: "api/cron/expansion-notify" });

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
    return json({ status: "skipped", reason: "concurrent_run", request_id: requestId }, 200);
  }
  inFlight = true;
  const started = Date.now();

  try {
    const result = await dispatchPendingExpansionNotifications();
    const latencyMs = Date.now() - started;
    log.info({ kind: "expansion_dispatch.done", latencyMs, ...result });
    return json({ status: "ok", request_id: requestId, latencyMs, ...result }, 200);
  } catch (e) {
    const latencyMs = Date.now() - started;
    log.error({
      kind: "expansion_dispatch.failed",
      latencyMs,
      message: (e as Error).message
    });
    captureException(e, { tags: { route: "api/cron/expansion-notify" }, extra: { requestId } });
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
