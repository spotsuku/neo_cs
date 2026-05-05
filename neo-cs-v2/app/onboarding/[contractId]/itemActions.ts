"use server";

// オンボ項目 (contract_onboarding_items) のステータス・期日・担当・メモ更新

import { revalidatePath } from "next/cache";
import { getRepo } from "@/lib/repository/server";
import type { OnboardingItemEditableStatus } from "@/lib/repository/types";

export async function setOnboardingItemStatus(
  itemId: string,
  contractId: string,
  status: OnboardingItemEditableStatus
) {
  const repo = getRepo();
  await repo.onboardingItems.update(itemId, { status });
  revalidatePath(`/onboarding/${contractId}`);
  revalidatePath("/onboarding");
}

export async function setOnboardingItemDueDate(
  itemId: string,
  contractId: string,
  dueDate: string | null
) {
  const repo = getRepo();
  await repo.onboardingItems.update(itemId, { dueDate });
  revalidatePath(`/onboarding/${contractId}`);
}

export async function setOnboardingItemAssignee(
  itemId: string,
  contractId: string,
  assignee: string | null
) {
  const repo = getRepo();
  await repo.onboardingItems.update(itemId, { assignee });
  revalidatePath(`/onboarding/${contractId}`);
}

export async function setOnboardingItemNote(
  itemId: string,
  contractId: string,
  note: string | null
) {
  const repo = getRepo();
  await repo.onboardingItems.update(itemId, { note });
  revalidatePath(`/onboarding/${contractId}`);
}
