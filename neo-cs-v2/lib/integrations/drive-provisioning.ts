/**
 * Drive プロビジョニング (handoff受信時 / 手動リトライ で共通利用)
 *
 * 動作:
 *   1. configured() チェック (env未設定なら no-op success で companies/handoffs はそのまま)
 *   2. copyTemplateFolder() でテンプレ複製 (or 既存再利用)
 *   3. companies.drive_folder_url + sales_handoffs.drive_folder_url を保存
 *
 * エラー:
 *   - 失敗しても handoff 全体を失敗扱いにしない (drive はリトライ可能 transient)
 *   - 失敗内容は構造化ログ + Sentry へ記録
 */

import "server-only";
import { copyTemplateFolder, configured, DriveIntegrationError } from "./google-drive";
import { getServiceClient } from "@/lib/supabase/server";
import { getLogger } from "@/lib/observability/logger";
import { captureException } from "@/lib/observability/sentry";

export interface ProvisionDriveInput {
  companyId: string;
  companyName: string;
  /** sales_handoffs.id (省略時は handoffs を更新しない) */
  handoffId?: string | null;
  /** 命名規則に使う日付 (省略時は今日) */
  date?: string;
  /** ログ・Sentry 用 */
  requestId?: string;
}

export interface ProvisionDriveResult {
  ok: boolean;
  reason?:
    | "not_configured"
    | "already_present"
    | "created"
    | "reused"
    | "failed";
  folderId?: string;
  folderUrl?: string;
  error?: { code: string; message: string };
}

/**
 * 既に companies.drive_folder_url が入っているかチェックして
 * 入ってなければ copyTemplateFolder を呼ぶ。
 */
export async function provisionDriveFolder(
  input: ProvisionDriveInput,
): Promise<ProvisionDriveResult> {
  const log = (await getLogger()).child({
    requestId: input.requestId ?? "drive-provision",
    route: "lib/integrations/drive-provisioning",
  });

  if (!configured()) {
    log.warn({ kind: "drive.not_configured", companyId: input.companyId });
    return { ok: true, reason: "not_configured" };
  }

  const sb = getServiceClient();

  // 既存チェック
  const { data: existing } = await sb
    .from("companies")
    .select("drive_folder_id, drive_folder_url")
    .eq("id", input.companyId)
    .maybeSingle();
  if (existing?.drive_folder_url) {
    // handoffs にも未設定なら同期
    if (input.handoffId) {
      await sb
        .from("sales_handoffs")
        .update({ drive_folder_url: existing.drive_folder_url })
        .eq("id", input.handoffId)
        .is("drive_folder_url", null);
    }
    return {
      ok: true,
      reason: "already_present",
      folderId: existing.drive_folder_id ?? undefined,
      folderUrl: existing.drive_folder_url,
    };
  }

  try {
    const result = await copyTemplateFolder({
      companyName: input.companyName,
      date: input.date,
    });
    // companies に保存
    const { error: coErr } = await sb
      .from("companies")
      .update({
        drive_folder_id: result.folderId,
        drive_folder_url: result.url,
        drive_folder_created_at: new Date().toISOString(),
      })
      .eq("id", input.companyId);
    if (coErr) throw new Error(`companies.update: ${coErr.message}`);

    // sales_handoffs にも保存
    if (input.handoffId) {
      const { error: hErr } = await sb
        .from("sales_handoffs")
        .update({ drive_folder_url: result.url })
        .eq("id", input.handoffId);
      if (hErr) {
        log.warn({
          kind: "drive.handoff_update_failed",
          handoffId: input.handoffId,
          message: hErr.message,
        });
      }
    }

    log.info({
      kind: "drive.provisioned",
      companyId: input.companyId,
      folderId: result.folderId,
      reused: result.reused,
    });
    return {
      ok: true,
      reason: result.reused ? "reused" : "created",
      folderId: result.folderId,
      folderUrl: result.url,
    };
  } catch (e) {
    const code =
      e instanceof DriveIntegrationError ? e.code : "unknown";
    const message = (e as Error).message ?? "unknown";
    log.error({
      kind: "drive.provision_failed",
      companyId: input.companyId,
      code,
      message,
    });
    captureException(e, {
      tags: { route: "lib/integrations/drive-provisioning" },
      extra: { companyId: input.companyId, handoffId: input.handoffId ?? null },
    });
    return { ok: false, reason: "failed", error: { code, message } };
  }
}
