"use server";

// 企業ページ「契約」セクションの CRUD Server Actions
//
// 既存の cycle-actions.ts (createNextCycleAction) は「内諾→次期起票」専用のため、
// 本ファイルでは
//   - 任意のタイミングで新規契約を追加
//   - 既存契約の編集 (期間 / MRR / コース / 担当者 / 参加人数 / cycleNumber 等)
//   - 解約 (status=churned に切替)
// を提供する。
//
// 権限: lib/auth/role-permissions.ts の "contract_manage" を要求 (既定 manager 以上)。

import { revalidatePath } from "next/cache";
import { getRepo } from "@/lib/repository/server";
import { getPermissionContext } from "@/lib/auth/server";
import { requirePermission } from "@/lib/auth/role-permissions";
import { recordAudit } from "@/lib/repository/audit";
import { DEFAULT_ORG_ID } from "@/lib/repository/types";
import type {
  Contract,
  ContractCreateInput,
  ContractStatus,
  ProductCode
} from "@/lib/repository/types";

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true } & T)
  | { ok: false; message: string };

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

export async function createContractAction(input: {
  companyId: string;
  product: ProductCode;
  courseKey: string;
  startDate: string;
  endDate?: string;
  mrr?: number;
  revenue?: number;
  ownerName: string;
  participants: number;
  cycleNumber: number;
  status?: ContractStatus;
}): Promise<ActionResult<{ contractId: string }>> {
  try {
    const ctx = await getPermissionContext();
    await requirePermission(ctx, "contract_manage");

    if (!input.startDate) return fail("開始日が必要です");
    if (input.cycleNumber < 1) return fail("第◯期 / 第◯回 は 1 以上で指定してください");
    if (input.participants < 0) return fail("参加人数は 0 以上で指定してください");

    const repo = getRepo();
    const create: ContractCreateInput = {
      companyId: input.companyId,
      product: input.product,
      courseKey: input.courseKey,
      startDate: input.startDate,
      endDate: input.endDate,
      mrr: input.mrr,
      revenue: input.revenue,
      ownerName: input.ownerName,
      participants: input.participants,
      cycleNumber: input.cycleNumber,
      status: input.status ?? "active",
      organizationId: ctx.actor?.organizationId ?? DEFAULT_ORG_ID
    } as ContractCreateInput;
    const created = await repo.contracts.create(create);

    revalidatePath(`/companies/${input.companyId}`);
    revalidatePath(`/dashboard/${input.product}`);
    revalidatePath("/companies");
    return { ok: true, contractId: created.id };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function updateContractAction(input: {
  contractId: string;
  companyId: string;
  patch: {
    courseKey?: string;
    startDate?: string;
    endDate?: string | null;
    mrr?: number | null;
    revenue?: number | null;
    ownerName?: string;
    participants?: number;
    cycleNumber?: number;
    status?: ContractStatus;
    planName?: string | null;
  };
}): Promise<ActionResult<{ contract: Contract }>> {
  try {
    const ctx = await getPermissionContext();
    await requirePermission(ctx, "contract_manage");

    const repo = getRepo();
    const before = await repo.contracts.getById(input.contractId);
    if (!before) return fail("契約が見つかりません");
    if (before.companyId !== input.companyId) {
      return fail("会社 ID が契約と一致しません");
    }
    if (
      input.patch.cycleNumber !== undefined &&
      (input.patch.cycleNumber < 1 || !Number.isInteger(input.patch.cycleNumber))
    ) {
      return fail("第◯期 / 第◯回 は 1 以上の整数で指定してください");
    }
    if (input.patch.participants !== undefined && input.patch.participants < 0) {
      return fail("参加人数は 0 以上で指定してください");
    }

    // null は undefined に統一して PartialContract に渡す
    const cleanPatch: Partial<Omit<Contract, "id">> = {};
    for (const [k, v] of Object.entries(input.patch)) {
      if (v === null) {
        (cleanPatch as Record<string, unknown>)[k] = undefined;
      } else if (v !== undefined) {
        (cleanPatch as Record<string, unknown>)[k] = v;
      }
    }
    const updated = await repo.contracts.update(input.contractId, cleanPatch);

    revalidatePath(`/companies/${input.companyId}`);
    revalidatePath(`/dashboard/${updated.product}`);
    return { ok: true, contract: updated };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** 契約を解約扱い (status=churned) に切替。物理削除は行わない */
export async function cancelContractAction(input: {
  contractId: string;
  companyId: string;
  reason?: string;
}): Promise<ActionResult> {
  try {
    const ctx = await getPermissionContext();
    await requirePermission(ctx, "contract_manage");

    const repo = getRepo();
    const before = await repo.contracts.getById(input.contractId);
    if (!before) return fail("契約が見つかりません");
    if (before.companyId !== input.companyId) {
      return fail("会社 ID が契約と一致しません");
    }
    if (before.status === "churned") return fail("既に解約済みです");

    const after = await repo.contracts.update(input.contractId, {
      status: "churned"
    });

    // 解約は重要操作のため audit_logs に reason 付きで明示記録
    await recordAudit({
      action: "update",
      targetTable: "contracts",
      targetId: input.contractId,
      before,
      after,
      reason: input.reason ? `解約: ${input.reason}` : "解約",
      actor: ctx.actor
        ? {
            userId: ctx.actor.id,
            email: ctx.actor.email,
            role: ctx.actor.role,
            organizationId: ctx.actor.organizationId ?? null
          }
        : { userId: null, email: null, role: null, organizationId: null },
      request: { id: "server-action", ip: null, userAgent: null }
    });

    revalidatePath(`/companies/${input.companyId}`);
    revalidatePath(`/dashboard/${after.product}`);
    return { ok: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}
