"use server";

// 企業天気の手動オーバーライド Server Actions

import { revalidatePath } from "next/cache";
import { getRepo } from "@/lib/repository/server";
import type { CompanyWeather } from "@/lib/domain/weather";

export async function setCompanyWeatherAction(input: {
  companyId: string;
  weather: CompanyWeather;
  note?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const repo = getRepo();
  try {
    await repo.companyWeatherOverrides.set(input.companyId, input.weather, {
      note: input.note
    });
    revalidatePath(`/companies/${input.companyId}`);
    revalidatePath("/companies");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function clearCompanyWeatherAction(input: {
  companyId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const repo = getRepo();
  try {
    await repo.companyWeatherOverrides.clear(input.companyId);
    revalidatePath(`/companies/${input.companyId}`);
    revalidatePath("/companies");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
