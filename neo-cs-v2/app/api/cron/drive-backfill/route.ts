/**
 * /api/cron/drive-backfill — 旧契約 (drive folder 未作成) を一括補完
 *
 * 起動経路:
 *   1) Vercel Cron (vercel.json で週次定義)
 *   2) 開発時のオンデマンド呼び出し (curl)
 *
 * 動作:
 *   - companies で drive_folder_id IS NULL かつ is_active のレコードを最大10件取得
 *   - 各 company について provisionDriveFolder() を直列実行 (Drive APIレートを抑える)
 *   - 結果をログ + サマリで返却
 *
 * 認証: CRON_SECRET (Bearer)
 */

import { NextRequest } from "next/server";
import { provisionDriveFolder } from "@/lib/integrations/drive-provisioning";
import { configured as driveConfigured } from "@/lib/integrations/google-drive";
import { getServiceClient } from "@/lib/supabase/server";
import { getLogger } from "@/lib/observability/logger";
import { captureException } from "@/lib/observability/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_LIMIT = 10;

let inFlight = false;

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = (await getLogger()).child({ requestId, route: "api/cron/drive-backfill" });

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
    return json({ status: "skipped", reason: "in_flight", request_id: requestId }, 200);
  }
  inFlight = true;

  try {
    if (!driveConfigured()) {
      return json({ status: "noop", reason: "drive_not_configured", request_id: requestId }, 200);
    }

    const sb = getServiceClient();
    const { data: targets, error } = await sb
      .from("companies")
      .select("id, name")
      .eq("is_active", true)
      .is("drive_folder_id", null)
      .order("created_at", { ascending: true })
      .limit(BATCH_LIMIT);
    if (error) throw new Error(`backfill.fetch: ${error.message}`);

    const summary = { total: targets?.length ?? 0, created: 0, reused: 0, failed: 0 };
    const details: Array<{ companyId: string; status: string; folderUrl?: string; error?: string }> = [];

    for (const c of targets ?? []) {
      const r = await provisionDriveFolder({
        companyId: c.id,
        companyName: c.name,
        requestId,
      });
      if (!r.ok) {
        summary.failed += 1;
        details.push({ companyId: c.id, status: "failed", error: r.error?.code });
      } else if (r.reason === "created") {
        summary.created += 1;
        details.push({ companyId: c.id, status: "created", folderUrl: r.folderUrl });
      } else if (r.reason === "reused" || r.reason === "already_present") {
        summary.reused += 1;
        details.push({ companyId: c.id, status: r.reason, folderUrl: r.folderUrl });
      }
    }

    log.info({ kind: "drive.backfill.done", ...summary });
    return json({ status: "ok", summary, details, request_id: requestId }, 200);
  } catch (e) {
    log.error({ kind: "drive.backfill.failed", message: (e as Error).message });
    captureException(e, { tags: { route: "api/cron/drive-backfill" }, extra: { requestId } });
    return json({ error: "internal_error", request_id: requestId }, 500);
  } finally {
    inFlight = false;
  }
}
