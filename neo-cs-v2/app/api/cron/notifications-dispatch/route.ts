/**
 * /api/cron/notifications-dispatch — 通知 inbox 日次バッチ
 *
 * 集約対象:
 *   - 週次レビュー未提出
 *   - 更新ウィンドウ突入 (契約終了 90 日前)
 *   - オンボタスク期限超過
 *
 * VOC 作成時 / 解約予兆 Slack 通知時の通知は別経路 (Server Action から直接 enqueue) で
 * 即時に走るため、本バッチでは扱わない。
 *
 * 認証: CRON_SECRET と Bearer トークン照合。
 * 冪等性: enqueueNotification 側で (userId, sourceType, sourceId) dedup されるため
 *         同日に複数回叩いても重複生成されない。
 */

import { NextRequest } from "next/server";
import { dispatchAllNotifications } from "@/lib/notifications/dispatchers";
import { getLogger } from "@/lib/observability/logger";
import { captureException } from "@/lib/observability/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let inFlight = false;

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = (await getLogger()).child({
    requestId,
    route: "api/cron/notifications-dispatch"
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
    log.warn({ kind: "concurrent_skip" });
    return json(
      { status: "skipped", reason: "concurrent_run", request_id: requestId },
      200
    );
  }
  inFlight = true;
  const started = Date.now();

  try {
    const result = await dispatchAllNotifications();
    const latencyMs = Date.now() - started;
    log.info({ kind: "notifications_dispatch.done", latencyMs, ...result });
    return json(
      { status: "ok", request_id: requestId, latencyMs, ...result },
      200
    );
  } catch (e) {
    const latencyMs = Date.now() - started;
    log.error({
      kind: "notifications_dispatch.failed",
      latencyMs,
      message: (e as Error).message
    });
    captureException(e, {
      tags: { route: "api/cron/notifications-dispatch" },
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
