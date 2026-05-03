/**
 * /api/cron/dedup-cleanup — 期限切れ dedup エントリの定期削除
 *
 * 起動経路:
 *   1) Vercel Cron (vercel.json で 4時間毎に定義)
 *      Authorization: Bearer ${CRON_SECRET}
 *   2) 手動キック (緊急時)
 *
 * driver=memory ならアプリプロセス内 Map の期限切れ掃除のみ。
 * driver=supabase なら notification_dedup_cleanup() RPC を呼ぶ。
 */

import { NextRequest } from "next/server";
import { cleanupExpiredDedup } from "@/lib/notifications/dedup";
import { getLogger } from "@/lib/observability/logger";
import { captureException } from "@/lib/observability/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let inFlight = false;

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = (await getLogger()).child({ requestId, route: "api/cron/dedup-cleanup" });

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
    return json({ status: "skipped", reason: "concurrent_run", request_id: requestId }, 200);
  }
  inFlight = true;
  const started = Date.now();

  try {
    const deleted = await cleanupExpiredDedup();
    const latencyMs = Date.now() - started;
    log.info({ kind: "dedup_cleanup.done", deleted, latencyMs });
    return json({ status: "ok", request_id: requestId, deleted, latencyMs }, 200);
  } catch (e) {
    log.error({
      kind: "dedup_cleanup.failed",
      message: (e as Error).message
    });
    captureException(e, { tags: { route: "api/cron/dedup-cleanup" }, extra: { requestId } });
    return json({ error: "cleanup_failed", request_id: requestId }, 500);
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
