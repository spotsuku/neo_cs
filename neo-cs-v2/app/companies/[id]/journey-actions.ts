"use server";

// 企業ジャーニー / 事業ジャーニーのステージ更新 Server Action
//
// 後退時 (toStage.displayOrder < fromStage.displayOrder) は
// acknowledgeRegression=true を必須化し、UI 側で確認モーダルを出させる。

import { revalidatePath } from "next/cache";
import { getRepo } from "@/lib/repository/server";

export type SetCompanyJourneyStageActionInput = {
  companyId: string;
  toStageKey: string;
  acknowledgeRegression?: boolean;
  note?: string;
};

export type ActionResult =
  | { ok: true }
  | { ok: false; code: "REGRESSION_REQUIRES_ACK" | "UNKNOWN"; message: string };

export async function setCompanyJourneyStageAction(
  input: SetCompanyJourneyStageActionInput
): Promise<ActionResult> {
  const repo = getRepo();
  try {
    await repo.companyJourneys.setStage({
      companyId: input.companyId,
      toStageKey: input.toStageKey,
      acknowledgeRegression: input.acknowledgeRegression,
      note: input.note
    });
    revalidatePath(`/companies/${input.companyId}`);
    return { ok: true };
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "REGRESSION_REQUIRES_ACK") {
      return {
        ok: false,
        code: "REGRESSION_REQUIRES_ACK",
        message: (e as Error).message
      };
    }
    return { ok: false, code: "UNKNOWN", message: (e as Error).message };
  }
}

export type SetBusinessJourneyStageActionInput = {
  contractId: string;
  companyId: string;
  toStageKey: string;
  acknowledgeRegression?: boolean;
  note?: string;
};

export async function setBusinessJourneyStageAction(
  input: SetBusinessJourneyStageActionInput
): Promise<ActionResult> {
  const repo = getRepo();
  try {
    await repo.businessJourneys.setStage({
      contractId: input.contractId,
      toStageKey: input.toStageKey,
      acknowledgeRegression: input.acknowledgeRegression,
      note: input.note
    });
    revalidatePath(`/companies/${input.companyId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, code: "UNKNOWN", message: (e as Error).message };
  }
}
