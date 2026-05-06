// /api/cron/kpi-snapshots — 日次 kpi_snapshots バッチ
//
// 動作:
//   - 全 active 契約 + 未解決 churn signals を取得
//   - lib/domain/kpi の純関数 (computeMrr / computeChurnRate / computeNrr /
//     computeAtRiskMrr) で当日値を算出
//   - getRepo().kpiSnapshots.upsert() で本日分を upsert (org_id × as_of unique)
//   - /reports と app/page.tsx は kpi_snapshots を SELECT して描画 (E項宿題)

import { NextRequest } from "next/server";
import { getRepo } from "@/lib/repository/server";
import { DEFAULT_ORG_ID } from "@/lib/repository/server";
import {
  computeMrr,
  computeChurnRate,
  computeNrr,
  computeAtRiskMrr,
  periodFor
} from "@/lib/domain/kpi";
import { getLogger } from "@/lib/observability/logger";
import { captureException } from "@/lib/observability/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let inFlight = false;

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = (await getLogger()).child({ requestId, route: "api/cron/kpi-snapshots" });

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    log.error({ kind: "misconfigured" }, "CRON_SECRET not set");
    return json({ error: "misconfigured", request_id: requestId }, 503);
  }
  if ((req.headers.get("authorization") ?? "") !== `Bearer ${secret}`) {
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
    const today = new Date().toISOString().slice(0, 10);

    // 全 contract 履歴も含めて期間集計したい (renewed/churned も含む)
    const allContracts = await repo.contracts.list();
    const activeContracts = await repo.contracts.list({ activeOnly: true });
    const signals = await repo.churnSignals.list({ unresolvedOnly: true });

    const mrr = computeMrr(allContracts, today);
    const churn30 = computeChurnRate(allContracts, periodFor("last30d", today));
    const churn90 = computeChurnRate(allContracts, periodFor("last90d", today));
    const nrr30 = computeNrr(allContracts, periodFor("last30d", today));
    const nrr90 = computeNrr(allContracts, periodFor("last90d", today));
    const atRisk = computeAtRiskMrr(allContracts, signals, today);

    const activeCompanyIds = new Set(activeContracts.map((c) => c.companyId));

    const orgId =
      activeContracts[0]?.organizationId ??
      allContracts[0]?.organizationId ??
      DEFAULT_ORG_ID;

    await repo.kpiSnapshots.upsert({
      organizationId: orgId,
      asOf: today,
      totalMrr: mrr.totalMrr,
      totalArr: mrr.totalMrr * 12,
      activeContractCount: mrr.contributingContractIds.length,
      activeCompanyCount: activeCompanyIds.size,
      churnRate30d: churn30.rate,
      churnRate90d: churn90.rate,
      nrr30d: nrr30.rate,
      nrr90d: nrr90.rate,
      atRiskMrr: atRisk.atRiskMrr,
      byProduct: mrr.byProduct,
      bySegment: mrr.bySegment ?? {},
      computedAt: new Date().toISOString()
    });

    const latencyMs = Date.now() - started;
    log.info({
      kind: "kpi_batch.done",
      latencyMs,
      asOf: today,
      totalMrr: mrr.totalMrr,
      atRiskMrr: atRisk.atRiskMrr
    });
    return json({ status: "ok", request_id: requestId, latencyMs, asOf: today }, 200);
  } catch (e) {
    const latencyMs = Date.now() - started;
    log.error({ kind: "kpi_batch.failed", latencyMs, message: (e as Error).message });
    captureException(e, { tags: { route: "api/cron/kpi-snapshots" }, extra: { requestId } });
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
