/**
 * /api/integrations/sales/handoff — 営業 (neo-sales) → CS 引継ぎ webhook 受信
 *
 * 認証:
 *   Authorization: Bearer ${SALES_HANDOFF_SECRET}
 *
 * 重複防止 (多重防御):
 *   1. アプリ層: Idempotency-Key ヘッダ (in-memory Map, 24h)
 *   2. DB層: sales_handoffs.sales_deal_id UNIQUE
 *
 * 動作:
 *   1. 認証 → ペイロード validate
 *   2. sales_handoffs から sales_deal_id 既存チェック (= 既存なら duplicate 返却)
 *   3. companies INSERT (id は cuid 風 generate)
 *   4. company_contacts INSERT (is_primary=true)
 *   5. contracts INSERT (status='handoff')
 *   6. assignments INSERT (sales_owner.email を app_users から引いて role='secondary')
 *      - app_users に該当が無い場合は assignments スキップ
 *   7. sales_handoffs に status='processed' で確定 (元 payload を保管)
 *   8. Slack 通知 (#cs-handoff)
 *
 * エラー:
 *   - 内部詳細はマスクして request_id のみ返す。Sentry に詳細送付。
 */

import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import {
  validatePayload,
  mapToCompanyData,
  mapToContactData,
  mapToContractData,
  type SalesHandoffPayload,
} from "@/lib/integrations/sales-handoff";
import { notifySalesHandoff } from "@/lib/notifications/sales-handoff";
import { provisionDriveFolder } from "@/lib/integrations/drive-provisioning";
import { getServiceClient } from "@/lib/supabase/server";
import { getLogger } from "@/lib/observability/logger";
import { captureException } from "@/lib/observability/sentry";
import { DEFAULT_ORG_ID } from "@/lib/repository/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL ?? "http://localhost:3000";

// inFlight ロック (同インスタンス内での同 deal 並行処理を防ぐ best-effort)。
// multi-instance 環境では DB の sales_handoffs.sales_deal_id UNIQUE と
// idempotency_key UNIQUE が真の重複防止の責任を持つ。
const inFlightDeals = new Set<string>();

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** cuid 風の短いID。pgcrypto に依存せずアプリ側で生成。 */
function generateId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${ts}${rand}`;
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = (await getLogger()).child({ requestId, route: "api/integrations/sales/handoff" });

  // ── 認証 ──
  const secret = process.env.SALES_HANDOFF_SECRET;
  if (!secret) {
    log.error({ kind: "misconfigured" }, "SALES_HANDOFF_SECRET not set");
    return json({ error: "misconfigured", request_id: requestId }, 503);
  }
  const auth = req.headers.get("authorization") ?? "";
  // タイミング攻撃対策で固定長比較する。長さが違う場合は早期失敗
  const expected = `Bearer ${secret}`;
  const authBuf = Buffer.from(auth);
  const expectedBuf = Buffer.from(expected);
  const authOk =
    authBuf.length === expectedBuf.length && timingSafeEqual(authBuf, expectedBuf);
  if (!authOk) {
    log.warn({ kind: "unauthorized" });
    return json({ error: "unauthorized", request_id: requestId }, 401);
  }

  // ── Idempotency-Key (任意) ──
  // 旧来は in-memory Map で判定していたが、Vercel multi-instance 環境では
  // 別インスタンスのリクエストで重複検出できないため、(organization_id,
  // idempotency_key) UNIQUE を持つ sales_handoffs に事前レコードを置いて
  // DB レベルで原子的に判定する (migration 0033)。
  const idemKey = req.headers.get("idempotency-key");
  if (idemKey) {
    const sbEarly = getServiceClient();
    const { data: existingByIdem } = await sbEarly
      .from("sales_handoffs")
      .select("id, company_id, status")
      .eq("organization_id", DEFAULT_ORG_ID)
      .eq("idempotency_key", idemKey)
      .maybeSingle();
    if (existingByIdem) {
      log.info({ kind: "idempotent_skip", idemKey, handoffId: existingByIdem.id });
      return json(
        {
          status: "duplicate",
          reason: "idempotency_key",
          handoffId: existingByIdem.id,
          companyId: existingByIdem.company_id ?? null,
          request_id: requestId,
        },
        200,
      );
    }
  }

  // ── ペイロード ──
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json", request_id: requestId }, 400);
  }
  const v = validatePayload(body);
  if (!v.ok) {
    log.warn({ kind: "validation_failed", errors: v.errors });
    return json({ error: "validation_failed", details: v.errors, request_id: requestId }, 400);
  }
  const payload: SalesHandoffPayload = v.data;

  // ── 同 deal 並行ロック ──
  if (inFlightDeals.has(payload.salesDealId)) {
    log.warn({ kind: "concurrent_skip", salesDealId: payload.salesDealId });
    return json({ status: "skipped", reason: "concurrent_run", request_id: requestId }, 200);
  }
  inFlightDeals.add(payload.salesDealId);
  const started = Date.now();

  try {
    const sb = getServiceClient();

    // ── DB側 重複確認 ──
    const { data: existing } = await sb
      .from("sales_handoffs")
      .select("id, company_id, status")
      .eq("sales_deal_id", payload.salesDealId)
      .maybeSingle();

    if (existing) {
      log.info({ kind: "db_duplicate", salesDealId: payload.salesDealId, handoffId: existing.id });
      return json(
        {
          status: "duplicate",
          handoffId: existing.id,
          companyId: existing.company_id,
          request_id: requestId,
        },
        200,
      );
    }

    // ── companies INSERT ──
    const companyId = generateId("co");
    const companyRow = {
      id: companyId,
      organization_id: DEFAULT_ORG_ID,
      ...mapToCompanyData(payload),
    };
    const { error: coErr } = await sb.from("companies").insert(companyRow);
    if (coErr) throw new Error(`company_insert_failed: ${coErr.message}`);

    // ── company_contacts INSERT ──
    const contactId = generateId("ct");
    const contactRow = {
      id: contactId,
      organization_id: DEFAULT_ORG_ID,
      company_id: companyId,
      ...mapToContactData(payload),
    };
    const { error: ctErr } = await sb.from("company_contacts").insert(contactRow);
    if (ctErr) throw new Error(`contact_insert_failed: ${ctErr.message}`);

    // ── contracts INSERT ──
    const contractId = generateId("ctr");
    const contractRow = {
      id: contractId,
      organization_id: DEFAULT_ORG_ID,
      company_id: companyId,
      ...mapToContractData(payload),
    };
    const { error: ccErr } = await sb.from("contracts").insert(contractRow);
    if (ccErr) throw new Error(`contract_insert_failed: ${ccErr.message}`);

    // ── assignments (営業担当を secondary として記録) ──
    let assignmentId: string | null = null;
    if (payload.salesOwner?.email) {
      const { data: ownerUser } = await sb
        .from("app_users")
        .select("id")
        .eq("email", payload.salesOwner.email)
        .maybeSingle();
      if (ownerUser?.id) {
        const { data: aRow, error: aErr } = await sb
          .from("assignments")
          .insert({
            organization_id: DEFAULT_ORG_ID,
            company_id: companyId,
            user_id: ownerUser.id,
            role: "secondary",
            note: "営業引継ぎ時に自動付与",
          })
          .select("id")
          .maybeSingle();
        if (!aErr && aRow) assignmentId = aRow.id;
      }
    }

    // ── sales_handoffs 確定 ──
    // idempotency_key も同時に永続化 (multi-instance での重複防止)
    const { data: handoffRow, error: hErr } = await sb
      .from("sales_handoffs")
      .insert({
        organization_id: DEFAULT_ORG_ID,
        sales_deal_id: payload.salesDealId,
        idempotency_key: idemKey,
        company_id: companyId,
        primary_contact_id: contactId,
        contract_id: contractId,
        sales_owner_email: payload.salesOwner?.email ?? null,
        payload,
        status: "processed",
        processed_at: new Date().toISOString(),
        processed_by_kind: "system",
      })
      .select("id")
      .maybeSingle();
    if (hErr) throw new Error(`handoff_insert_failed: ${hErr.message}`);

    // ── Google Drive 自動作成 (失敗しても handoff は成功扱いとし、
    //    後で手動リトライ可能にする。詳細は lib/integrations/drive-provisioning.ts) ──
    let driveFolderUrl: string | null = null;
    try {
      const driveRes = await provisionDriveFolder({
        companyId,
        companyName: payload.company.name,
        handoffId: handoffRow?.id ?? null,
        date: payload.contract.startDate,
        requestId,
      });
      if (driveRes.ok && driveRes.folderUrl) driveFolderUrl = driveRes.folderUrl;
    } catch (e) {
      log.warn({ kind: "drive_provision_failed", message: (e as Error).message });
    }

    // ── Slack 通知 (失敗しても 200 を返す) ──
    try {
      await notifySalesHandoff({
        salesDealId: payload.salesDealId,
        companyName: payload.company.name,
        productCode: payload.contract.productCode,
        startDate: payload.contract.startDate,
        amountJpy: payload.contract.amountJpy ?? null,
        primaryContactName: payload.primaryContact.name,
        salesOwnerEmail: payload.salesOwner?.email ?? null,
        dashboardUrl: `${APP_BASE_URL}/companies/${companyId}`,
        receivedAt: new Date().toISOString(),
        notes: payload.notes ?? null,
      });
    } catch (e) {
      log.warn({ kind: "slack_notify_failed", message: (e as Error).message });
    }

    const latencyMs = Date.now() - started;
    log.info({
      kind: "handoff.processed",
      salesDealId: payload.salesDealId,
      companyId,
      contractId,
      assignmentId,
      latencyMs,
    });
    return json(
      {
        status: "ok",
        handoffId: handoffRow?.id ?? null,
        companyId,
        contractId,
        primaryContactId: contactId,
        assignmentId,
        driveFolderUrl,
        dashboardUrl: `${APP_BASE_URL}/companies/${companyId}`,
        request_id: requestId,
      },
      200,
    );
  } catch (e) {
    const latencyMs = Date.now() - started;
    const message = (e as Error).message;
    log.error({ kind: "handoff.failed", latencyMs, message, salesDealId: payload.salesDealId });
    captureException(e, {
      tags: { route: "api/integrations/sales/handoff" },
      extra: { requestId, salesDealId: payload.salesDealId },
    });
    // 失敗もしくは partial 状態を sales_handoffs に記録 (best-effort)
    try {
      const sb = getServiceClient();
      await sb.from("sales_handoffs").insert({
        organization_id: DEFAULT_ORG_ID,
        sales_deal_id: payload.salesDealId,
        sales_owner_email: payload.salesOwner?.email ?? null,
        payload,
        status: "failed",
        error_detail: message.slice(0, 500),
      });
    } catch {
      // unique violation などは握りつぶす
    }
    return json({ error: "internal_error", request_id: requestId }, 500);
  } finally {
    inFlightDeals.delete(payload.salesDealId);
  }
}
