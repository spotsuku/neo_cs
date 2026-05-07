// 事業内ToDo (program_*) Supabase リポジトリ
// マイグレーション: supabase/migrations/0020_program_tasks.sql
// 純関数群: lib/domain/program.ts
//
// mock との同等性を保ちつつ、setTemplateDueDate / setTemplateAssignee の
// 「open セル一括反映」と syncCompanies の「契約スコープから対象企業を導出」
// は SQL 側で実行する。

import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import { DEFAULT_ORG_ID } from "../types";
import type {
  ProgramRepo,
  ProgramTerm,
  ProgramTaskTemplate,
  ProgramCompanyTask,
  ProgramTermStatus,
  ProgramCellStatus,
  ProgramTaskCategory
} from "../types";

// ─────────────────────────────────────────────
// Row 型 + マッパ
// ─────────────────────────────────────────────
type TermRow = {
  id: string;
  organization_id: string;
  product_code: string;
  course_key: string | null;
  cycle_no: number | null;
  label: string;
  started_at: string | null;
  closed_at: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type TemplateRow = {
  id: string;
  program_term_id: string;
  order_no: number;
  label: string;
  description: string | null;
  category: string | null;
  default_due_offset_days: number | null;
  default_due_date: string | null;
  default_assignee_to: string | null;
  created_at: string;
  updated_at: string;
};

type CellRow = {
  id: string;
  organization_id: string;
  program_term_id: string;
  template_id: string;
  company_id: string;
  contract_id: string | null;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  note: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
};

function toTerm(r: TermRow): ProgramTerm {
  return {
    id: r.id,
    organizationId: r.organization_id,
    productCode: r.product_code,
    courseKey: r.course_key,
    cycleNo: r.cycle_no,
    label: r.label,
    startedAt: r.started_at ?? undefined,
    closedAt: r.closed_at ?? undefined,
    status: r.status as ProgramTermStatus,
    createdBy: r.created_by ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

function toTemplate(r: TemplateRow): ProgramTaskTemplate {
  return {
    id: r.id,
    programTermId: r.program_term_id,
    orderNo: r.order_no,
    label: r.label,
    description: r.description ?? undefined,
    category: (r.category ?? undefined) as ProgramTaskCategory | undefined,
    defaultDueOffsetDays: r.default_due_offset_days ?? undefined,
    defaultDueDate: r.default_due_date ?? undefined,
    defaultAssigneeTo: r.default_assignee_to ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

function toCell(r: CellRow): ProgramCompanyTask {
  return {
    id: r.id,
    organizationId: r.organization_id,
    programTermId: r.program_term_id,
    templateId: r.template_id,
    companyId: r.company_id,
    contractId: r.contract_id ?? undefined,
    status: r.status as ProgramCellStatus,
    dueDate: r.due_date ?? undefined,
    assignedTo: r.assigned_to ?? undefined,
    note: r.note ?? undefined,
    completedAt: r.completed_at ?? undefined,
    completedBy: r.completed_by ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

// ─────────────────────────────────────────────
// Repo 実装
// ─────────────────────────────────────────────
export const supabaseProgramRepo: ProgramRepo = {
  async listTerms(filter) {
    const sb = getServiceClient();
    let q = sb.from("program_terms").select("*").order("started_at", {
      ascending: false,
      nullsFirst: false
    });
    if (filter?.status) {
      const arr = Array.isArray(filter.status) ? filter.status : [filter.status];
      q = q.in("status", arr);
    }
    const { data, error } = await q;
    if (error) throw new Error(`program_terms.list: ${error.message}`);
    return (data ?? []).map((r) => toTerm(r as TermRow));
  },

  async getTerm(id) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("program_terms")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`program_terms.getTerm: ${error.message}`);
    return data ? toTerm(data as TermRow) : null;
  },

  async createTerm(input) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data, error } = await sb
      .from("program_terms")
      .insert({
        organization_id: DEFAULT_ORG_ID,
        product_code: input.productCode,
        course_key: input.courseKey ?? null,
        cycle_no: input.cycleNo ?? null,
        label: input.label,
        started_at: input.startedAt ?? null,
        closed_at: input.closedAt ?? null,
        status: input.status ?? "active",
        created_by: input.createdBy ?? null
      })
      .select()
      .single();
    if (error) throw new Error(`program_terms.createTerm: ${error.message}`);
    const created = toTerm(data as TermRow);
    await runAfterWrite({
      entityType: "program_terms",
      entityId: created.id,
      after: created,
      action: "create",
      ctx
    });
    return created;
  },

  async closeTerm(id) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb
      .from("program_terms")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const { data, error } = await sb
      .from("program_terms")
      .update({ status: "closed" })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(`program_terms.closeTerm: ${error.message}`);
    const updated = toTerm(data as TermRow);
    await runAfterWrite({
      entityType: "program_terms",
      entityId: id,
      before,
      after: updated,
      action: "update",
      ctx
    });
    return updated;
  },

  async updateTerm(id, patch) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb
      .from("program_terms")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const dbPatch: Record<string, unknown> = {};
    if (patch.label !== undefined) dbPatch.label = patch.label;
    if (patch.startedAt !== undefined) dbPatch.started_at = patch.startedAt ?? null;
    if (patch.closedAt !== undefined) dbPatch.closed_at = patch.closedAt ?? null;
    if (patch.status !== undefined) dbPatch.status = patch.status;
    const { data, error } = await sb
      .from("program_terms")
      .update(dbPatch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(`program_terms.updateTerm: ${error.message}`);
    const updated = toTerm(data as TermRow);
    await runAfterWrite({
      entityType: "program_terms",
      entityId: id,
      before,
      after: updated,
      action: "update",
      ctx
    });
    return updated;
  },

  async deleteTerm(id) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb
      .from("program_terms")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!before) return; // 既に無いなら no-op (CASCADE はテンプレ・セルも巻き取る)
    const { error } = await sb.from("program_terms").delete().eq("id", id);
    if (error) throw new Error(`program_terms.deleteTerm: ${error.message}`);
    await runAfterWrite({
      entityType: "program_terms",
      entityId: id,
      before,
      action: "delete",
      ctx
    });
  },

  async listTemplates(programTermId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("program_task_templates")
      .select("*")
      .eq("program_term_id", programTermId)
      .order("order_no", { ascending: true });
    if (error) throw new Error(`program_task_templates.list: ${error.message}`);
    return (data ?? []).map((r) => toTemplate(r as TemplateRow));
  },

  async upsertTemplate(input) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    if (input.id) {
      const { data: before } = await sb
        .from("program_task_templates")
        .select("*")
        .eq("id", input.id)
        .maybeSingle();
      const { data, error } = await sb
        .from("program_task_templates")
        .update({
          program_term_id: input.programTermId,
          order_no: input.orderNo,
          label: input.label,
          description: input.description ?? null,
          category: input.category ?? null,
          default_due_offset_days: input.defaultDueOffsetDays ?? null
        })
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw new Error(`program_task_templates.update: ${error.message}`);
      const updated = toTemplate(data as TemplateRow);
      await runAfterWrite({
        entityType: "program_task_templates",
        entityId: input.id,
        before,
        after: updated,
        action: "update",
        ctx
      });
      return updated;
    }
    const { data, error } = await sb
      .from("program_task_templates")
      .insert({
        program_term_id: input.programTermId,
        order_no: input.orderNo,
        label: input.label,
        description: input.description ?? null,
        category: input.category ?? null,
        default_due_offset_days: input.defaultDueOffsetDays ?? null
      })
      .select()
      .single();
    if (error) throw new Error(`program_task_templates.insert: ${error.message}`);
    const created = toTemplate(data as TemplateRow);
    await runAfterWrite({
      entityType: "program_task_templates",
      entityId: created.id,
      after: created,
      action: "create",
      ctx
    });
    return created;
  },

  async deleteTemplate(id) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb
      .from("program_task_templates")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!before) return;
    const { error } = await sb.from("program_task_templates").delete().eq("id", id);
    if (error) throw new Error(`program_task_templates.delete: ${error.message}`);
    await runAfterWrite({
      entityType: "program_task_templates",
      entityId: id,
      before,
      action: "delete",
      ctx
    });
  },

  async setTemplateDueDate(templateId, dueDate) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    // 1. 列既定値を読む (open セルが「列既定値を継承していたか」判定に使う)
    const { data: before } = await sb
      .from("program_task_templates")
      .select("*")
      .eq("id", templateId)
      .maybeSingle();
    if (!before) throw new Error(`Template not found: ${templateId}`);
    const previousDefault = (before as TemplateRow).default_due_date;

    // 2. 列既定を更新
    const { data, error } = await sb
      .from("program_task_templates")
      .update({ default_due_date: dueDate })
      .eq("id", templateId)
      .select()
      .single();
    if (error) throw new Error(`program_task_templates.setDue: ${error.message}`);
    const updated = toTemplate(data as TemplateRow);

    // 3. open セルのうち「未設定 or 直前の列既定値と一致」のものだけ反映
    let openSelector = sb
      .from("program_company_tasks")
      .update({ due_date: dueDate })
      .eq("template_id", templateId)
      .in("status", ["pending", "in_progress"]);
    openSelector = previousDefault
      ? openSelector.or(`due_date.is.null,due_date.eq.${previousDefault}`)
      : openSelector.is("due_date", null);
    const { error: cellErr } = await openSelector;
    if (cellErr) throw new Error(`program_company_tasks.cascadeDue: ${cellErr.message}`);

    await runAfterWrite({
      entityType: "program_task_templates",
      entityId: templateId,
      before,
      after: updated,
      action: "update",
      ctx
    });
    return updated;
  },

  async setTemplateAssignee(templateId, userId, opts) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb
      .from("program_task_templates")
      .select("*")
      .eq("id", templateId)
      .maybeSingle();
    if (!before) throw new Error(`Template not found: ${templateId}`);
    const { data, error } = await sb
      .from("program_task_templates")
      .update({ default_assignee_to: userId })
      .eq("id", templateId)
      .select()
      .single();
    if (error) throw new Error(`program_task_templates.setAssignee: ${error.message}`);
    const updated = toTemplate(data as TemplateRow);

    if (opts?.propagate) {
      const { error: cellErr } = await sb
        .from("program_company_tasks")
        .update({ assigned_to: userId })
        .eq("template_id", templateId)
        .in("status", ["pending", "in_progress"]);
      if (cellErr) throw new Error(`program_company_tasks.cascadeAssignee: ${cellErr.message}`);
    }
    await runAfterWrite({
      entityType: "program_task_templates",
      entityId: templateId,
      before,
      after: updated,
      action: "update",
      ctx
    });
    return updated;
  },

  async updateTemplateMeta(templateId, patch) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const row: Record<string, unknown> = {};
    if (patch.label !== undefined) row.label = patch.label;
    if (patch.description !== undefined) row.description = patch.description ?? null;
    if (patch.category !== undefined) row.category = patch.category ?? null;
    if (patch.orderNo !== undefined) row.order_no = patch.orderNo;
    if (patch.defaultDueOffsetDays !== undefined) {
      row.default_due_offset_days = patch.defaultDueOffsetDays ?? null;
    }
    const { data: before } = await sb
      .from("program_task_templates")
      .select("*")
      .eq("id", templateId)
      .maybeSingle();
    const { data, error } = await sb
      .from("program_task_templates")
      .update(row)
      .eq("id", templateId)
      .select()
      .single();
    if (error) throw new Error(`program_task_templates.updateMeta: ${error.message}`);
    const updated = toTemplate(data as TemplateRow);
    await runAfterWrite({
      entityType: "program_task_templates",
      entityId: templateId,
      before,
      after: updated,
      action: "update",
      ctx
    });
    return updated;
  },

  async syncCompanies(programTermId) {
    const sb = getServiceClient();
    // 1. term, templates, 既存セル
    const { data: termData, error: termErr } = await sb
      .from("program_terms")
      .select("*")
      .eq("id", programTermId)
      .maybeSingle();
    if (termErr) throw new Error(`program_terms.read: ${termErr.message}`);
    if (!termData) return { created: 0 };
    const term = toTerm(termData as TermRow);

    const { data: tplRows, error: tplErr } = await sb
      .from("program_task_templates")
      .select("*")
      .eq("program_term_id", programTermId);
    if (tplErr) throw new Error(`program_task_templates.read: ${tplErr.message}`);
    const templates = (tplRows ?? []).map((r) => toTemplate(r as TemplateRow));
    if (templates.length === 0) return { created: 0 };

    // 2. スコープにマッチする契約を取得
    //    - product/course/cycle 一致 (course/cycle が null なら product だけ一致)
    //    - 評議会 (hyogikai) は academia 契約も対象に取り込む (ToDo 共通運用)
    //    - status は 動いている契約のみ (handoff/onboarding/active/renewal_window)
    const ACTIVE_STATUSES = ["handoff", "onboarding", "active", "renewal_window"];
    const productCodes =
      term.productCode === "hyogikai"
        ? ["hyogikai", "academia"]
        : [term.productCode];
    let cq = sb
      .from("contracts")
      .select("id, company_id, product_code, course_key, cycle_number, status")
      .in("product_code", productCodes)
      .in("status", ACTIVE_STATUSES);
    // course/cycle スコープは「自事業内」でのみ評価。
    // 例: 評議会 term から academia 契約を取り込む際は course/cycle 制約を適用しない。
    if (term.courseKey != null) {
      cq = cq.or(
        `product_code.neq.${term.productCode},course_key.eq.${term.courseKey}`
      );
    }
    if (term.cycleNo != null) {
      cq = cq.or(
        `product_code.neq.${term.productCode},cycle_number.eq.${term.cycleNo}`
      );
    }
    const { data: contracts, error: cErr } = await cq;
    if (cErr) throw new Error(`contracts.scope: ${cErr.message}`);

    // 3. 既存セル (3つ組ユニーク制約のため重複は SQL 側でも防げるが、
    //    INSERT 件数返却のため事前に存在確認する)
    const { data: existing, error: eErr } = await sb
      .from("program_company_tasks")
      .select("template_id, company_id")
      .eq("program_term_id", programTermId);
    if (eErr) throw new Error(`program_company_tasks.read: ${eErr.message}`);
    const existsKey = new Set(
      (existing ?? []).map((r: { template_id: string; company_id: string }) =>
        `${r.template_id}::${r.company_id}`
      )
    );

    // 4. INSERT する行を組み立て (1企業1契約のうち最新の id を contract_id に)
    const inserts: Array<Record<string, unknown>> = [];
    for (const c of contracts ?? []) {
      for (const tp of templates) {
        const key = `${tp.id}::${c.company_id}`;
        if (existsKey.has(key)) continue;
        existsKey.add(key); // 同一企業に複数契約があるケースで二重生成しない
        inserts.push({
          organization_id: DEFAULT_ORG_ID,
          program_term_id: programTermId,
          template_id: tp.id,
          company_id: c.company_id,
          contract_id: c.id,
          status: "pending",
          due_date: tp.defaultDueDate ?? null,
          assigned_to: tp.defaultAssigneeTo ?? null
        });
      }
    }
    if (inserts.length === 0) return { created: 0 };
    const { error: insErr } = await sb.from("program_company_tasks").insert(inserts);
    if (insErr) throw new Error(`program_company_tasks.insert: ${insErr.message}`);
    return { created: inserts.length };
  },

  async copyTemplates(fromTermId, toTermId) {
    const sb = getServiceClient();
    const { data: src, error } = await sb
      .from("program_task_templates")
      .select("*")
      .eq("program_term_id", fromTermId)
      .order("order_no", { ascending: true });
    if (error) throw new Error(`program_task_templates.copySrc: ${error.message}`);
    const rows = (src ?? []).map((r) => {
      const t = r as TemplateRow;
      return {
        program_term_id: toTermId,
        order_no: t.order_no,
        label: t.label,
        description: t.description,
        category: t.category,
        default_due_offset_days: t.default_due_offset_days
        // default_due_date / default_assignee_to は期固有なので複製しない
      };
    });
    if (rows.length === 0) return { copied: 0 };
    const { error: insErr } = await sb.from("program_task_templates").insert(rows);
    if (insErr) throw new Error(`program_task_templates.copyInsert: ${insErr.message}`);
    return { copied: rows.length };
  },

  async listCells(programTermId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("program_company_tasks")
      .select("*")
      .eq("program_term_id", programTermId);
    if (error) throw new Error(`program_company_tasks.list: ${error.message}`);
    return (data ?? []).map((r) => toCell(r as CellRow));
  },

  async updateCell(id, patch) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const row: Record<string, unknown> = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.dueDate !== undefined) row.due_date = patch.dueDate;
    if (patch.assignedTo !== undefined) row.assigned_to = patch.assignedTo;
    if (patch.note !== undefined) row.note = patch.note;
    if (patch.status === "done") {
      row.completed_at = new Date().toISOString();
    }
    const { data: before } = await sb
      .from("program_company_tasks")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const { data, error } = await sb
      .from("program_company_tasks")
      .update(row)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(`program_company_tasks.update: ${error.message}`);
    const updated = toCell(data as CellRow);
    await runAfterWrite({
      entityType: "program_company_tasks",
      entityId: id,
      before,
      after: updated,
      action: "update",
      ctx
    });
    return updated;
  }
};
