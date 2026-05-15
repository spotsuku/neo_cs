/**
 * /api/cron/onboarding-overdue-notify — オンボーディング期限超過 inbox 通知バッチ (F1)
 *
 * 起動経路:
 *   1) Vercel Cron (vercel.json: 毎日 01:00 UTC = JST 10:00)
 *   2) 開発時のオンデマンド呼び出し
 *      - curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/onboarding-overdue-notify
 *
 * 認証/ロック/ログは churn-notify と同パターン。
 */

import { NextRequest } from "next/server";
import { dispatchOnboardingOverdueNotifications } from "@/lib/notifications/onboarding-overdue";
import { getLogger } from "@/lib/observability/logger";
import { captureException } from "@/lib/observability/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let inFlight = false;

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = (await getLogger()).child({
    requestId,
    route: "api/cron/onboarding-overdue-notify"
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
    const result = await dispatchOnboardingOverdueNotifications();
    const latencyMs = Date.now() - started;
    log.info({
      kind: "onboarding_overdue_dispatch.done",
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
      kind: "onboarding_overdue_dispatch.failed",
      latencyMs,
      message: (e as Error).message
    });
    captureException(e, {
      tags: { route: "api/cron/onboarding-overdue-notify" },
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
