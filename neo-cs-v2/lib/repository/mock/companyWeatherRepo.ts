// 企業天気の手動オーバーライド (mock)
//
// 自動派生 (lib/domain/weather.ts deriveCompanyWeather) に対する手動上書き。
// 設定があれば優先表示、無ければ自動派生値を表示する。

import type { CompanyWeather } from "@/lib/domain/weather";
import type { CompanyWeatherRepo, CompanyWeatherOverride } from "../types";
import { useGlobalStore } from "./_global-store";

const store = useGlobalStore<Map<string, CompanyWeatherOverride>>(
  "__companyWeatherOverrideStore",
  () => new Map()
);

export const mockCompanyWeatherRepo: CompanyWeatherRepo = {
  async getAll() {
    return Array.from(store.values()).map((v) => ({ ...v }));
  },

  async get(companyId) {
    const v = store.get(companyId);
    return v ? { ...v } : null;
  },

  async set(companyId, weather, opts) {
    const next: CompanyWeatherOverride = {
      companyId,
      weather,
      updatedAt: new Date().toISOString(),
      updatedBy: opts?.updatedBy,
      note: opts?.note
    };
    store.set(companyId, next);
    return { ...next };
  },

  async clear(companyId) {
    store.delete(companyId);
  }
};
