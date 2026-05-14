/**
 * /api/cron/gmail-sync — Gmail 受信箱同期バッチ
 *
 * Vercel Cron から 30 分毎 (30,0,30 .. min毎) に起動。
 * 全 user_gmail_connections について messages を Gmail API から取得し
 * email_threads / email_messages に保存、新着は user_notifications に enqueue。
 *
 * 初回同期では 2026-03-01 以降を遡って取得 (CS ステータス管理向け)。
 *
 * 認証: CRON_SECRET と Bearer トークン照合。
 * 冪等性: gmail_message_id でユニーク制約があるため同日に複数回叩いても重複なし。
 * タイムアウト対策: 1 ユーザにつき最大 200 件/run、Vercel cron 60s 制限内で完走。
 */

import { NextRequest } from "next/server";
import { syncAllConnections } from "@/lib/integrations/gmail-sync";
import { getLogger } from "@/lib/observability/logger";
import { captureException } from "@/lib/observability/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 大量メールの取り込みに備えて最大実行時間を拡張 (Pro plan: 300s)
export const maxDuration = 300;

let inFlight = false;

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = (await getLogger()).child({ requestId, route: "api/cron/gmail-sync" });

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return json({ error: "misconfigured", request_id: requestId }, 503);
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return json({ error: "unauthorized", request_id: requestId }, 401);
  }

  if (inFlight) {
    return json(
      { status: "skipped", reason: "concurrent_run", request_id: requestId },
      200
    );
  }
  inFlight = true;
  const started = Date.now();

  try {
    const result = await syncAllConnections();
    const latencyMs = Date.now() - started;
    const summary = result.results.reduce(
      (acc, r) => ({
        fetched: acc.fetched + r.fetched,
        inserted: acc.inserted + r.inserted,
        skipped: acc.skipped + r.skipped,
        notified: acc.notified + r.notified,
        errors: acc.errors + r.errors.length
      }),
      { fetched: 0, inserted: 0, skipped: 0, notified: 0, errors: 0 }
    );
    log.info({
      kind: "gmail_sync.done",
      latencyMs,
      connections: result.total,
      ...summary
    });
    return json(
      {
        status: "ok",
        request_id: requestId,
        latencyMs,
        connections: result.total,
        ...summary
      },
      200
    );
  } catch (e) {
    const latencyMs = Date.now() - started;
    log.error({
      kind: "gmail_sync.failed",
      latencyMs,
      message: (e as Error).message
    });
    captureException(e, {
      tags: { route: "api/cron/gmail-sync" },
      extra: { requestId }
    });
    return json({ error: "sync_failed", request_id: requestId }, 500);
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
