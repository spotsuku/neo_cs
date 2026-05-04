"use server";

// 顧客側担当者 (stakeholder) の engagement_tier 手動上書き Server Action
//
// 監査ログは StakeholderRepo.setEngagementTier 内の runAfterWrite で記録される。

import { revalidatePath } from "next/cache";
import { getRepo } from "@/lib/repository/server";
import type { EngagementTierValue } from "@/lib/repository/types";

export type SetStakeholderEngagementTierInput = {
  stakeholderId: string;
  companyId: string;
  /** null で override 解除 (suggestedTier 追従) */
  tier: EngagementTierValue | null;
  note?: string;
};

export async function setStakeholderEngagementTier(
  input: SetStakeholderEngagementTierInput
): Promise<{ ok: true }> {
  const repo = getRepo();
  await repo.stakeholders.setEngagementTier(input.stakeholderId, {
    tier: input.tier,
    note: input.note
  });
  revalidatePath(`/companies/${input.companyId}`);
  revalidatePath("/team");
  revalidatePath("/");
  return { ok: true };
}
