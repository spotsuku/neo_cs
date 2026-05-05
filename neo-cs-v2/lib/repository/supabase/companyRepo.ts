import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import { DEFAULT_ORG_ID } from "../types";
import type {
  Company,
  CompanyFilter,
  CompanyRepo,
  DemoWipeRange,
  DemoWipeResult
} from "../types";

type Row = {
  id: string;
  organization_id: string;
  corporate_number: string | null;
  name: string;
  kana: string | null;
  industry: string | null;
  address: string | null;
  group_name: string | null;
  owner_user_id: string | null;
  memo: string | null;
  drive_folder_id?: string | null;
  drive_folder_url?: string | null;
  drive_folder_created_at?: string | null;
  is_demo?: boolean | null;
  karute_no?: number | null;
  created_at?: string | null;
};

function toCompany(row: Row, ownerName: string = ""): Company {
  // Domain型 (mock互換) は ownerName / contracts / mrr / lastTouchDays を持つが、
  // これらは別テーブル / view に分離されているため本リポジトリでは省略 or 既定値。
  // 後段の画面リファクタで Repository が contracts/health/touch を組み合わせて返す。
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    kana: row.kana ?? "",
    industry: row.industry ?? "",
    address: row.address ?? "",
    group: row.group_name ?? undefined,
    ownerName,
    contracts: [],
    mrr: 0,
    lastTouchDays: 0,
    memo: row.memo ?? undefined,
    driveFolderId: row.drive_folder_id ?? null,
    driveFolderUrl: row.drive_folder_url ?? null,
    driveFolderCreatedAt: row.drive_folder_created_at ?? null,
    isDemo: row.is_demo ?? true,
    karuteNo: row.karute_no ?? undefined,
    createdAt: row.created_at ?? undefined
  };
}

function toRow(input: Partial<Company>): Partial<Row> {
  const out: Partial<Row> = {};
  if (input.id !== undefined) out.id = input.id;
  if (input.organizationId !== undefined) out.organization_id = input.organizationId;
  if (input.name !== undefined) out.name = input.name;
  if (input.kana !== undefined) out.kana = input.kana;
  if (input.industry !== undefined) out.industry = input.industry;
  if (input.address !== undefined) out.address = input.address;
  if (input.group !== undefined) out.group_name = input.group ?? null;
  if (input.memo !== undefined) out.memo = input.memo ?? null;
  if (input.isDemo !== undefined) out.is_demo = input.isDemo;
  return out;
}

export const supabaseCompanyRepo: CompanyRepo = {
  async list(filter?: CompanyFilter) {
    const sb = getServiceClient();
    let q = sb.from("companies").select("*").eq("is_active", true);
    if (filter?.organizationId) q = q.eq("organization_id", filter.organizationId);
    if (filter?.industry) q = q.eq("industry", filter.industry);
    if (filter?.search) q = q.ilike("name", `%${filter.search}%`);
    if (typeof filter?.isDemo === "boolean") q = q.eq("is_demo", filter.isDemo);
    const { data, error } = await q;
    if (error) throw new Error(`companies.list: ${error.message}`);
    return (data ?? []).map((r: Row) => toCompany(r));
  },

  async getById(id: string) {
    const sb = getServiceClient();
    const { data, error } = await sb.from("companies").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`companies.getById: ${error.message}`);
    return data ? toCompany(data as Row) : null;
  },

  async create(input) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const row: Row = {
      id: `c-${Math.random().toString(36).slice(2, 10)}`,
      organization_id: input.organizationId ?? DEFAULT_ORG_ID,
      corporate_number: null,
      name: input.name,
      kana: input.kana,
      industry: input.industry,
      address: input.address,
      group_name: input.group ?? null,
      owner_user_id: null,
      memo: input.memo ?? null,
      // is_demo: 明示指定があればそれ、なければ default true (本番開始前)
      // 本番運用開始時は登録ウィザードのチェックボックスデフォルトを false に
      // 切り替え、本フィールドの default も false に変更する想定。
      is_demo: input.isDemo ?? true
    };
    const { data, error } = await sb.from("companies").insert(row).select().single();
    if (error) throw new Error(`companies.create: ${error.message}`);
    const created = toCompany(data as Row, input.ownerName);
    await runAfterWrite({
      entityType: "companies",
      entityId: created.id,
      after: created,
      action: "create",
      ctx
    });
    return created;
  },

  async update(id, patch) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb.from("companies").select("*").eq("id", id).maybeSingle();
    const { data, error } = await sb
      .from("companies")
      .update(toRow(patch))
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(`companies.update: ${error.message}`);
    const updated = toCompany(data as Row);
    await runAfterWrite({
      entityType: "companies",
      entityId: id,
      before,
      after: updated,
      action: "update",
      ctx
    });
    return updated;
  },

  async setKaruteNo(id, newNo) {
    if (!Number.isInteger(newNo) || newNo < 1) {
      const err: Error & { code?: string } = new Error(
        "カルテNo. は 1 以上の整数を指定してください"
      );
      err.code = "KARUTE_NO_INVALID";
      throw err;
    }
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("companies")
      .update({ karute_no: newNo })
      .eq("id", id)
      .select()
      .single();
    if (error) {
      // Postgres unique violation
      if ((error as { code?: string }).code === "23505") {
        const err: Error & { code?: string } = new Error(
          `カルテNo. ${newNo} は既に使われています`
        );
        err.code = "KARUTE_NO_CONFLICT";
        throw err;
      }
      throw new Error(`companies.setKaruteNo: ${error.message}`);
    }
    return toCompany(data as Row);
  },

  async delete(id) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb.from("companies").select("*").eq("id", id).maybeSingle();
    // 論理削除: is_active=false + archived_at
    const { error } = await sb
      .from("companies")
      .update({ is_active: false, archived_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(`companies.delete: ${error.message}`);
    await runAfterWrite({
      entityType: "companies",
      entityId: id,
      before,
      action: "delete",
      ctx
    });
  },

  async setDriveFolder(id, drive) {
    const sb = getServiceClient();
    const { error } = await sb
      .from("companies")
      .update({
        drive_folder_id: drive.folderId,
        drive_folder_url: drive.folderUrl,
        drive_folder_created_at: new Date().toISOString()
      })
      .eq("id", id);
    if (error) throw new Error(`companies.setDriveFolder: ${error.message}`);
  },

  async listDemo(opts) {
    const sb = getServiceClient();
    let q = sb.from("companies").select("*").eq("is_demo", true);
    if (opts?.organizationId) q = q.eq("organization_id", opts.organizationId);
    const range: DemoWipeRange = opts?.range ?? "all";
    if (range !== "all") {
      const hours = range === "24h" ? 24 : 24 * 7;
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      q = q.gte("created_at", cutoff);
    }
    const { data, error } = await q;
    if (error) throw new Error(`companies.listDemo: ${error.message}`);
    return (data ?? []).map((r: Row) => toCompany(r));
  },

  async countDemo(opts) {
    const sb = getServiceClient();
    let q = sb
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("is_demo", true);
    if (opts?.organizationId) q = q.eq("organization_id", opts.organizationId);
    const { count, error } = await q;
    if (error) throw new Error(`companies.countDemo: ${error.message}`);
    return count ?? 0;
  },

  async wipeDemoData(opts): Promise<DemoWipeResult> {
    const sb = getServiceClient();
    // 1) 削除対象の id を確定 (CASCADE でも Audit 記録に必要)
    const targets = await this.listDemo({
      organizationId: opts.organizationId,
      range: opts.range
    });
    const ids = targets.map((c) => c.id);
    if (ids.length === 0) {
      return { deletedCompanies: 0, deletedIds: [] };
    }
    // 2) 一括 DELETE (FK CASCADE で contracts / contacts / 等も連鎖削除)
    const { error } = await sb.from("companies").delete().in("id", ids);
    if (error) throw new Error(`companies.wipeDemoData: ${error.message}`);

    // 3) audit_logs に kind=demo_wipe で1行追加
    try {
      await sb.from("audit_logs").insert({
        organization_id: opts.organizationId ?? DEFAULT_ORG_ID,
        actor_user_id: opts.actorUserId ?? null,
        actor_email: opts.actorEmail ?? null,
        action: "demo_wipe",
        target_table: "companies",
        target_id: null,
        before_data: { range: opts.range ?? "all", count: ids.length, ids },
        after_data: null
      });
    } catch (e) {
      // audit 失敗は致命ではないが stderr に
      process.stderr.write(
        JSON.stringify({
          at: new Date().toISOString(),
          kind: "demo_wipe_audit_failed",
          message: e instanceof Error ? e.message : String(e)
        }) + "\n"
      );
    }
    return { deletedCompanies: ids.length, deletedIds: ids };
  }
};
