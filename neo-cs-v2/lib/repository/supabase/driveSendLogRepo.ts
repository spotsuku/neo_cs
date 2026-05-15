// F4: Drive テンプレート送付履歴 (Supabase 実装)
//
// マイグレーション: supabase/migrations/0045_drive_send_logs.sql
// 書き込みは runAfterWrite(audit hook) を経由して audit_logs に流す。

import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import { DEFAULT_ORG_ID } from "../types";
import type {
  DriveSendChannel,
  DriveSendLog,
  DriveSendLogCreateInput,
  DriveSendLogListFilter,
  DriveSendLogRepo
} from "../types";

type Row = {
  id: string;
  organization_id: string;
  company_id: string;
  contract_id: string | null;
  product_code: string | null;
  drive_file_id: string;
  drive_file_name: string;
  drive_file_version_label: string | null;
  sent_to_email: string;
  sent_to_contact_id: string | null;
  sent_by_user_id: string;
  sent_via: string;
  note: string | null;
  sent_at: string;
  created_at: string;
};

function toDomain(r: Row): DriveSendLog {
  return {
    id: r.id,
    organizationId: r.organization_id,
    companyId: r.company_id,
    contractId: r.contract_id,
    productCode: r.product_code,
    driveFileId: r.drive_file_id,
    driveFileName: r.drive_file_name,
    driveFileVersionLabel: r.drive_file_version_label,
    sentToEmail: r.sent_to_email,
    sentToContactId: r.sent_to_contact_id,
    sentByUserId: r.sent_by_user_id,
    sentVia: r.sent_via as DriveSendChannel,
    note: r.note,
    sentAt: r.sent_at,
    createdAt: r.created_at
  };
}

function parseSort(sort?: string): { column: string; ascending: boolean } {
  const raw = (sort ?? "sent_at desc").trim().toLowerCase();
  const parts = raw.split(/\s+/);
  const column = parts[0] || "sent_at";
  const ascending = parts[1] !== "desc";
  return { column, ascending };
}

export const supabaseDriveSendLogRepo: DriveSendLogRepo = {
  async list(filter?: DriveSendLogListFilter) {
    const sb = getServiceClient();
    const { column, ascending } = parseSort(filter?.sort);
    let q = sb.from("drive_send_logs").select("*").order(column, { ascending });
    if (filter?.companyId) q = q.eq("company_id", filter.companyId);
    if (filter?.contractId) q = q.eq("contract_id", filter.contractId);
    if (filter?.productCode) q = q.eq("product_code", filter.productCode);
    if (filter?.sentByUserId) q = q.eq("sent_by_user_id", filter.sentByUserId);
    if (filter?.sentAtFrom) q = q.gte("sent_at", filter.sentAtFrom);
    if (filter?.sentAtTo) q = q.lte("sent_at", filter.sentAtTo);
    if (filter?.limit != null) q = q.limit(filter.limit);
    const { data, error } = await q;
    if (error) throw new Error(`drive_send_logs.list: ${error.message}`);
    return (data ?? []).map((r: Row) => toDomain(r));
  },

  async listByCompany(companyId, opts) {
    const sb = getServiceClient();
    let q = sb
      .from("drive_send_logs")
      .select("*")
      .eq("company_id", companyId)
      .order("sent_at", { ascending: false });
    if (opts?.limit != null) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) throw new Error(`drive_send_logs.listByCompany: ${error.message}`);
    return (data ?? []).map((r: Row) => toDomain(r));
  },

  async create(input: DriveSendLogCreateInput) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const row: Record<string, unknown> = {
      organization_id: input.organizationId ?? DEFAULT_ORG_ID,
      company_id: input.companyId,
      contract_id: input.contractId ?? null,
      product_code: input.productCode ?? null,
      drive_file_id: input.driveFileId,
      drive_file_name: input.driveFileName,
      drive_file_version_label: input.driveFileVersionLabel ?? null,
      sent_to_email: input.sentToEmail,
      sent_to_contact_id: input.sentToContactId ?? null,
      sent_by_user_id: input.sentByUserId,
      sent_via: input.sentVia,
      note: input.note ?? null
    };
    if (input.sentAt) row.sent_at = input.sentAt;
    const { data, error } = await sb
      .from("drive_send_logs")
      .insert(row)
      .select()
      .single();
    if (error) {
      // 0047 で張った UNIQUE (drive_file_id, company_id, sent_to_email, sent_at) との
      // 衝突。再同期で同一 Gmail message から抽出した重複なので、既存行を返して呼び出し側に
      // 同一 I/F を提供する。
      if (error.code === "23505") {
        const sentAtIso = (row.sent_at as string | undefined) ?? new Date().toISOString();
        const { data: existing, error: lookupErr } = await sb
          .from("drive_send_logs")
          .select()
          .eq("drive_file_id", input.driveFileId)
          .eq("company_id", input.companyId)
          .eq("sent_to_email", input.sentToEmail)
          .eq("sent_at", sentAtIso)
          .single();
        if (lookupErr || !existing) {
          throw new Error(`drive_send_logs.create dedup lookup failed: ${lookupErr?.message ?? "no row"}`);
        }
        return toDomain(existing as Row);
      }
      throw new Error(`drive_send_logs.create: ${error.message}`);
    }
    const created = toDomain(data as Row);
    await runAfterWrite({
      entityType: "drive_send_logs",
      entityId: created.id,
      after: created,
      action: "create",
      ctx
    });
    return created;
  }
};
