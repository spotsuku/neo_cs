"use server";

// オンボ画面のインライン契約ステータス変更用 Server Action。
// /companies/[id]/contract-actions の updateContractAction を流用しても良いが、
// status だけを変える単純ケースのため、薄いラッパとして切り出す。
//
// 権限: contract_manage (manager 以上)。

import { revalidatePath } from "next/cache";
import { getRepo } from "@/lib/repository/server";
import { getPermissionContext } from "@/lib/auth/server";
import { requirePermission } from "@/lib/auth/role-permissions";
import type { ContractStatus } from "@/lib/repository/types";

type Result =
  | { ok: true }
  | { ok: false; message: string };

export async function setContractStatusAction(
  contractId: string,
  status: ContractStatus
): Promise<Result> {
  try {
    const ctx = await getPermissionContext();
    await requirePermission(ctx, "contract_manage");

    const repo = getRepo();
    const before = await repo.contracts.getById(contractId);
    if (!before) return { ok: false, message: "契約が見つかりません" };

    const updated = await repo.contracts.update(contractId, { status });

    revalidatePath("/onboarding");
    revalidatePath(`/companies/${updated.companyId}`);
    revalidatePath(`/dashboard/${updated.product}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
