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

// ─────────────────────────────────────────────
// チェックポイント完了状態の切り替え
// ─────────────────────────────────────────────
import { DEFAULT_ORG_ID } from "@/lib/repository/types";
import type { JourneyType, BusinessLifecycleState } from "@/lib/repository/types";
import { getPermissionContext } from "@/lib/auth/server";

export async function toggleJourneyCheckpointAction(input: {
  journeyType: JourneyType;
  subjectId: string;
  /** ジャーニーが company の場合 = companyId、business の場合 = revalidate 用 companyId */
  companyId: string;
  stageKey: string;
  checkpointKey: string;
  done: boolean;
  note?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const repo = getRepo();
  const ctx = await getPermissionContext();
  try {
    await repo.journeyCheckpoints.setStatus({
      organizationId: ctx.actor?.organizationId ?? DEFAULT_ORG_ID,
      journeyType: input.journeyType,
      subjectId: input.subjectId,
      stageKey: input.stageKey,
      checkpointKey: input.checkpointKey,
      done: input.done,
      completedBy: ctx.actor?.id,
      note: input.note
    });
    revalidatePath(`/companies/${input.companyId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

// ─────────────────────────────────────────────
// 事業ジャーニー lifecycle 状態の遷移
// active → at_risk / churned / re_approach
// churned 時には contract_lifecycle_snapshot を凍結書き込み
// ─────────────────────────────────────────────
export async function setBusinessLifecycleStateAction(input: {
  contractId: string;
  companyId: string;
  toState: BusinessLifecycleState;
  reason?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const repo = getRepo();
  const ctx = await getPermissionContext();
  try {
    const orgId = ctx.actor?.organizationId ?? DEFAULT_ORG_ID;
    const bj = await repo.businessJourneys.getByContract(input.contractId);
    if (!bj) {
      return { ok: false, message: "事業ジャーニーが見つかりません" };
    }
    const wasChurned = bj.lifecycleState === "churned";
    await repo.businessJourneys.setLifecycleState({
      contractId: input.contractId,
      state: input.toState,
      reason: input.reason,
      changedBy: ctx.actor?.id
    });

    // 解約決定状態から復帰する場合は凍結スナップショットを削除（誤操作リカバリ）
    if (wasChurned && input.toState !== "churned") {
      await repo.contractLifecycle.unfreeze(input.contractId);
    }

    // 解約決定時は契約ライフサイクルスナップショットを凍結
    if (input.toState === "churned") {
      const checkpoints = await repo.journeyCheckpoints.list({
        organizationId: orgId,
        journeyType: "business",
        subjectId: input.contractId
      });
      const totalDone = checkpoints.filter((c) => c.done).length;
      await repo.contractLifecycle.freeze({
        contractId: input.contractId,
        organizationId: orgId,
        endedAs: "churned",
        endedAt: new Date().toISOString(),
        finalStageKey: bj.currentStageKey,
        finalLifecycleState: "churned",
        metrics: {
          checkpointDoneRatio:
            checkpoints.length > 0 ? totalDone / checkpoints.length : 0
        },
        churnReason: input.reason,
        checkpointStatusSnapshot: checkpoints
      });
    }

    revalidatePath(`/companies/${input.companyId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
