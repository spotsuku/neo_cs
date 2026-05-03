/**
 * /api/cron/churn-notify — 解約予兆 Slack 通知バッチ
 *
 * 起動経路:
 *   1) Vercel Cron (vercel.json で 4時間毎を定義)
 *      - リクエストには Authorization: Bearer ${CRON_SECRET} を付与する Vercel 仕様
 *   2) 開発時のオンデマンド呼び出し
 *      - curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/churn-notify
 *   3) 緊急時の手動キック (オペレータ)
 *
 * 動作:
 *   - dispatchPendingChurnNotifications() を呼び、severity=high の未通知シグナルを
 *     Slack #churn-alerts に流す。
 *   - 認証: CRON_SECRET (環境変数) と Bearer トークン照合。未設定環境は 503。
 *   - 構造化ログ + Sentry 連携、エラーは詳細マスキング (request_id のみ返却)
 *   - 同時実行ロック (in-memory): バッチが重複起動しても二重通知しない一次防護
 */

import { NextRequest } from "next/server";
import { dispatchPendingChurnNotifications } from "@/lib/notifications/churn";
import { getLogger } from "@/lib/observability/logger";
import { captureException } from "@/lib/observability/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let inFlight = false;

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = (await getLogger()).child({ requestId, route: "api/cron/churn-notify" });

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
    const result = await dispatchPendingChurnNotifications();
    const latencyMs = Date.now() - started;
    log.info({
      kind: "churn_dispatch.done",
      latencyMs,
      ...result,
    });
    return json({ status: "ok", request_id: requestId, latencyMs, ...result }, 200);
  } catch (e) {
    const latencyMs = Date.now() - started;
    log.error({
      kind: "churn_dispatch.failed",
      latencyMs,
      message: (e as Error).message,
    });
    captureException(e, { tags: { route: "api/cron/churn-notify" }, extra: { requestId } });
    return json({ error: "dispatch_failed", request_id: requestId }, 500);
  } finally {
    inFlight = false;
  }
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
