"use server";

// ジャーニーステージ定義 (組織単位カスタム) の編集 Server Actions

import { revalidatePath } from "next/cache";
import { getRepo } from "@/lib/repository/server";
import type {
  JourneyStageUpsertInput,
  JourneyType
} from "@/lib/repository/types";

export async function upsertJourneyStageAction(input: JourneyStageUpsertInput) {
  const repo = getRepo();
  await repo.journeyStageDefinitions.upsert(input);
  revalidatePath("/settings/journey-stages");
  // 企業カルテにも反映
  revalidatePath("/companies", "layout");
  return { ok: true } as const;
}

export async function deleteJourneyStageAction(input: {
  journeyType: JourneyType;
  stageKey: string;
}) {
  const repo = getRepo();
  await repo.journeyStageDefinitions.delete(input);
  revalidatePath("/settings/journey-stages");
  revalidatePath("/companies", "layout");
  return { ok: true } as const;
}

export async function resetJourneyStagesAction(input: {
  journeyType: JourneyType;
}) {
  const repo = getRepo();
  await repo.journeyStageDefinitions.resetToDefaults(input);
  revalidatePath("/settings/journey-stages");
  revalidatePath("/companies", "layout");
  return { ok: true } as const;
}
