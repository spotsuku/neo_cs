"use server";

// 企業ビジョン (NEO参画動機 / 中長期目標 / 今年度目標 / 活用方針) 更新 Server Action

import { revalidatePath } from "next/cache";
import { getRepo } from "@/lib/repository/server";
import { getPermissionContext } from "@/lib/auth/server";

export async function setCompanyVisionAction(input: {
  companyId: string;
  joinMotivation?: string;
  longTermGoal?: string;
  thisYearGoal?: string;
  usagePolicy?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const repo = getRepo();
  const ctx = await getPermissionContext();
  try {
    await repo.companyVisions.upsert({
      companyId: input.companyId,
      joinMotivation: input.joinMotivation?.trim() || undefined,
      longTermGoal: input.longTermGoal?.trim() || undefined,
      thisYearGoal: input.thisYearGoal?.trim() || undefined,
      usagePolicy: input.usagePolicy?.trim() || undefined,
      updatedBy: ctx.actor?.id
    });
    revalidatePath(`/companies/${input.companyId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
