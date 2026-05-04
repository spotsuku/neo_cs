/**
 * /api/integrations/drive/retry/[companyId] — Drive フォルダ手動リトライ (admin/manager only)
 *
 * 目的:
 *   - handoff受信時に Drive 連携が transient で失敗した場合に手動でやり直す
 *   - 既に companies.drive_folder_url が入っていれば 200 (no-op) で URL を返す
 *
 * 認証:
 *   Authorization: Bearer <Supabase JWT>  (app_users.role in admin/manager のみ)
 */

import { NextRequest } from "next/server";
import { verifyBearer } from "@/lib/security/auth";
import { provisionDriveFolder } from "@/lib/integrations/drive-provisioning";
import { getServiceClient } from "@/lib/supabase/server";
import { getLogger } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const requestId = crypto.randomUUID();
  const log = (await getLogger()).child({ requestId, route: "api/integrations/drive/retry" });
  const { companyId } = await params;

  // 認証/認可
  const actor = await verifyBearer(req);
  if (!actor) return json({ error: "unauthorized", request_id: requestId }, 401);
  if (!["admin", "manager"].includes(actor.role)) {
    return json({ error: "forbidden", request_id: requestId }, 403);
  }

  // 会社存在チェック
  const sb = getServiceClient();
  const { data: company } = await sb
    .from("companies")
    .select("id, name, drive_folder_url")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) return json({ error: "not_found", request_id: requestId }, 404);

  // 既に存在する場合は no-op
  if (company.drive_folder_url) {
    return json(
      {
        status: "already_present",
        folderUrl: company.drive_folder_url,
        request_id: requestId,
      },
      200,
    );
  }

  // 紐づく最新 handoff を引いて handoffId に更新を波及
  const { data: handoff } = await sb
    .from("sales_handoffs")
    .select("id")
    .eq("company_id", companyId)
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const result = await provisionDriveFolder({
    companyId,
    companyName: company.name,
    handoffId: handoff?.id ?? null,
    requestId,
  });

  if (!result.ok) {
    log.error({
      kind: "drive.retry_failed",
      companyId,
      code: result.error?.code,
      message: result.error?.message,
    });
    return json(
      {
        error: "drive_failed",
        code: result.error?.code ?? "unknown",
        message: result.error?.message ?? "unknown",
        request_id: requestId,
      },
      502,
    );
  }

  return json(
    {
      status: result.reason ?? "ok",
      folderId: result.folderId ?? null,
      folderUrl: result.folderUrl ?? null,
      request_id: requestId,
    },
    200,
  );
}
