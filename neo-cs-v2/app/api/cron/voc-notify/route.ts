/**
 * /api/cron/voc-notify — VOC (Voice of Customer) Slack 通知バッチ (H項)
 *
 * 起動経路:
 *   1) Vercel Cron (vercel.json で週次定義: UTC水曜 0:00 = JST水曜 09:00)
 *      Authorization: Bearer ${CRON_SECRET}
 *   2) 手動キック (緊急時 / 検証)
 *
 * 動作:
 *   - 02 H項提供 lib/notifications/voc.ts:dispatchPendingVocNotifications() を呼ぶ
 *   - priority='high' + unNotified の voc_items を Slack #voc に流す
 *   - dedup は slack.ts → lib/notifications/dedup.ts ファサード経由 (memory|supabase)
 *
 * churn-notify / expansion-notify と同じガード:
 *   - inFlight ロック
 *   - 構造化ログ + Sentry連携
 *   - エラー詳細はクライアント非開示 (request_id のみ)
 */

import { NextRequest } from "next/server";
import { dispatchPendingVocNotifications } from "@/lib/notifications/voc";
import { getLogger } from "@/lib/observability/logger";
import { captureException } from "@/lib/observability/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let inFlight = false;

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = (await getLogger()).child({ requestId, route: "api/cron/voc-notify" });

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
    const result = await dispatchPendingVocNotifications();
    const latencyMs = Date.now() - started;
    log.info({ kind: "voc_dispatch.done", latencyMs, ...result });
    return json({ status: "ok", request_id: requestId, latencyMs, ...result }, 200);
  } catch (e) {
    const latencyMs = Date.now() - started;
    log.error({
      kind: "voc_dispatch.failed",
      latencyMs,
      message: (e as Error).message
    });
    captureException(e, { tags: { route: "api/cron/voc-notify" }, extra: { requestId } });
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
