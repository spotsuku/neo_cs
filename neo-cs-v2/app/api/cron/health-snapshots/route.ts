// /api/cron/health-snapshots — 日次 health_score_snapshots バッチ
//
// 起動経路:
//   1) Vercel Cron (vercel.json で日次 02:30 JST = 17:30 UTC を定義)
//   2) 開発時のオンデマンド呼び出し:
//        curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/health-snapshots
//
// 動作:
//   - 全 active 契約をスキャン
//   - lib/domain/health.computeFromContract() で score / color / factors を算出
//   - getRepo().healthSnapshots.upsert() で本日分を upsert
//   - 認証: CRON_SECRET (環境変数) と Bearer 照合。未設定環境は 503
//   - 同時実行ロック (in-memory) で重複起動時は skip
//
// REPO_DRIVER=mock の場合は in-memory 上に upsert されるだけだが、画面表示・
// 開発確認には十分。本番は REPO_DRIVER=supabase で health_score_snapshots に永続化。

import { NextRequest } from "next/server";
import { getRepo } from "@/lib/repository/server";
import { DEFAULT_ORG_ID } from "@/lib/repository";
import { computeHealthScore, deriveMockFactors } from "@/lib/domain/health";
import { getLogger } from "@/lib/observability/logger";
import { captureException } from "@/lib/observability/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let inFlight = false;

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = (await getLogger()).child({ requestId, route: "api/cron/health-snapshots" });

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
    const repo = getRepo();
    const contracts = await repo.contracts.list({ activeOnly: true });
    const today = new Date().toISOString().slice(0, 10);

    let written = 0;
    let failed = 0;
    for (const c of contracts) {
      try {
        const factors = deriveMockFactors({
          contractId: c.id,
          product: c.product,
          baselineColor: c.healthScore?.color,
          endDate: c.endDate,
          asOf: today
        });
        const breakdown = computeHealthScore(factors, `${today}T00:00:00Z`);
        await repo.healthSnapshots.upsert({
          organizationId: c.organizationId ?? DEFAULT_ORG_ID,
          contractId: c.id,
          asOf: today,
          score: breakdown.score,
          color: breakdown.color,
          factors,
          computedAt: breakdown.computedAt
        });
        written++;
      } catch (e) {
        failed++;
        log.warn({
          kind: "snapshot_failed",
          contractId: c.id,
          message: (e as Error).message
        });
      }
    }

    const latencyMs = Date.now() - started;
    log.info({ kind: "health_batch.done", latencyMs, total: contracts.length, written, failed });
    return json(
      { status: "ok", request_id: requestId, latencyMs, total: contracts.length, written, failed },
      200
    );
  } catch (e) {
    const latencyMs = Date.now() - started;
    log.error({ kind: "health_batch.failed", latencyMs, message: (e as Error).message });
    captureException(e, { tags: { route: "api/cron/health-snapshots" }, extra: { requestId } });
    return json({ error: "batch_failed", request_id: requestId }, 500);
  } finally {
    inFlight = false;
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}
