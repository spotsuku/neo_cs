// 企業ビジョン Supabase リポジトリ
// マイグレーション: supabase/migrations/0030_company_vision_weather_lifecycle.sql
// upsert で値が変わったとき、変更前を company_vision_logs に保存する。

import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import type {
  CompanyVisionRepo,
  CompanyVision,
  CompanyVisionLog,
  CompanyVisionUpsert
} from "../types";

type Field = "joinMotivation" | "longTermGoal" | "thisYearGoal" | "usagePolicy";
const FIELDS: Field[] = ["joinMotivation", "longTermGoal", "thisYearGoal", "usagePolicy"];

type VisionRow = {
  company_id: string;
  join_motivation: string | null;
  long_term_goal: string | null;
  this_year_goal: string | null;
  usage_policy: string | null;
  updated_at: string;
  updated_by: string | null;
};

type LogRow = {
  id: string;
  company_id: string;
  join_motivation: string | null;
  long_term_goal: string | null;
  this_year_goal: string | null;
  usage_policy: string | null;
  changed_fields: string[];
  recorded_at: string;
  recorded_by: string | null;
};

function toVision(r: VisionRow): CompanyVision {
  return {
    companyId: r.company_id,
    joinMotivation: r.join_motivation ?? undefined,
    longTermGoal: r.long_term_goal ?? undefined,
    thisYearGoal: r.this_year_goal ?? undefined,
    usagePolicy: r.usage_policy ?? undefined,
    updatedAt: r.updated_at,
    updatedBy: r.updated_by ?? undefined
  };
}

function toLog(r: LogRow): CompanyVisionLog {
  return {
    id: r.id,
    companyId: r.company_id,
    joinMotivation: r.join_motivation ?? undefined,
    longTermGoal: r.long_term_goal ?? undefined,
    thisYearGoal: r.this_year_goal ?? undefined,
    usagePolicy: r.usage_policy ?? undefined,
    changedFields: r.changed_fields as CompanyVisionLog["changedFields"],
    recordedAt: r.recorded_at,
    recordedBy: r.recorded_by ?? undefined
  };
}

const COL: Record<Field, keyof VisionRow> = {
  joinMotivation: "join_motivation",
  longTermGoal: "long_term_goal",
  thisYearGoal: "this_year_goal",
  usagePolicy: "usage_policy"
};

export const supabaseCompanyVisionRepo: CompanyVisionRepo = {
  async get(companyId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("company_visions")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) throw new Error(`company_visions.get: ${error.message}`);
    return data ? toVision(data as VisionRow) : null;
  },

  async upsert(input: CompanyVisionUpsert) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb
      .from("company_visions")
      .select("*")
      .eq("company_id", input.companyId)
      .maybeSingle();

    // 変更フィールドを検出 (新値が指定されていて、既存値と異なる場合)
    const changedFields: Field[] = [];
    if (before) {
      const ex = before as VisionRow;
      for (const f of FIELDS) {
        const newVal = input[f];
        if (newVal === undefined) continue;
        const trimmed = newVal.trim() || null;
        if (trimmed !== (ex[COL[f]] ?? null)) changedFields.push(f);
      }
      // 変更があれば変更前スナップショットを log に積む
      if (changedFields.length > 0) {
        const { error: logErr } = await sb.from("company_vision_logs").insert({
          company_id: input.companyId,
          join_motivation: ex.join_motivation,
          long_term_goal: ex.long_term_goal,
          this_year_goal: ex.this_year_goal,
          usage_policy: ex.usage_policy,
          changed_fields: changedFields,
          recorded_by: input.updatedBy ?? null
        });
        if (logErr) throw new Error(`company_vision_logs.insert: ${logErr.message}`);
      }
    }

    // 部分更新: undefined フィールドは触らない (existing 値を保つ)
    const row: Record<string, unknown> = {
      company_id: input.companyId,
      updated_by: input.updatedBy ?? null
    };
    for (const f of FIELDS) {
      const v = input[f];
      if (v !== undefined) row[COL[f]] = v.trim() || null;
      else if (before) row[COL[f]] = (before as VisionRow)[COL[f]];
    }
    const { data, error } = await sb
      .from("company_visions")
      .upsert(row, { onConflict: "company_id" })
      .select()
      .single();
    if (error) throw new Error(`company_visions.upsert: ${error.message}`);
    const next = toVision(data as VisionRow);
    await runAfterWrite({
      entityType: "company_visions",
      entityId: input.companyId,
      before,
      after: next,
      action: before ? "update" : "create",
      ctx
    });
    return next;
  },

  async listLogs(companyId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("company_vision_logs")
      .select("*")
      .eq("company_id", companyId)
      .order("recorded_at", { ascending: false });
    if (error) throw new Error(`company_vision_logs.list: ${error.message}`);
    return (data ?? []).map((r) => toLog(r as LogRow));
  }
};
