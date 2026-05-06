// 企業天気の手動オーバーライド Supabase リポジトリ
// マイグレーション: supabase/migrations/0029_company_vision_weather_lifecycle.sql

import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import type { CompanyWeather } from "@/lib/domain/weather";
import type { CompanyWeatherRepo, CompanyWeatherOverride } from "../types";

type Row = {
  company_id: string;
  weather: string;
  note: string | null;
  updated_at: string;
  updated_by: string | null;
};

function toOverride(r: Row): CompanyWeatherOverride {
  return {
    companyId: r.company_id,
    weather: r.weather as CompanyWeather,
    note: r.note ?? undefined,
    updatedAt: r.updated_at,
    updatedBy: r.updated_by ?? undefined
  };
}

export const supabaseCompanyWeatherRepo: CompanyWeatherRepo = {
  async getAll() {
    const sb = getServiceClient();
    const { data, error } = await sb.from("company_weather_overrides").select("*");
    if (error) throw new Error(`company_weather_overrides.list: ${error.message}`);
    return (data ?? []).map((r) => toOverride(r as Row));
  },

  async get(companyId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("company_weather_overrides")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) throw new Error(`company_weather_overrides.get: ${error.message}`);
    return data ? toOverride(data as Row) : null;
  },

  async set(companyId, weather, opts) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb
      .from("company_weather_overrides")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
    const { data, error } = await sb
      .from("company_weather_overrides")
      .upsert(
        {
          company_id: companyId,
          weather,
          note: opts?.note ?? null,
          updated_by: opts?.updatedBy ?? null
        },
        { onConflict: "company_id" }
      )
      .select()
      .single();
    if (error) throw new Error(`company_weather_overrides.set: ${error.message}`);
    const next = toOverride(data as Row);
    await runAfterWrite({
      entityType: "company_weather_overrides",
      entityId: companyId,
      before,
      after: next,
      action: before ? "update" : "create",
      ctx
    });
    return next;
  },

  async clear(companyId) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb
      .from("company_weather_overrides")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
    if (!before) return;
    const { error } = await sb
      .from("company_weather_overrides")
      .delete()
      .eq("company_id", companyId);
    if (error) throw new Error(`company_weather_overrides.clear: ${error.message}`);
    await runAfterWrite({
      entityType: "company_weather_overrides",
      entityId: companyId,
      before,
      action: "delete",
      ctx
    });
  }
};
