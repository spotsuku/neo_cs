"use server";

// エクスパンション機会 Server Actions
// ContractExpansionOpportunities (components/) から呼ばれる。
// 旧コードは expansionOpportunityRepo / userRepo をクライアントから直接叩いていた。

import { revalidatePath } from "next/cache";
import {
  expansionOpportunityRepo,
  userRepo
} from "@/lib/repository/server";
import type {
  AppUser,
  ExpansionOpportunityRecord
} from "@/lib/repository/server";

export async function listExpansionsForContractAction(
  contractId: string
): Promise<ExpansionOpportunityRecord[]> {
  return expansionOpportunityRepo.listByContract(contractId, { openOnly: false });
}

export async function listActiveUsersAction(): Promise<AppUser[]> {
  return userRepo.list({ activeOnly: true });
}

export async function handOffExpansionAction(
  opId: string,
  input: { handedOffTo: string; note?: string; companyId?: string }
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await expansionOpportunityRepo.handOff(opId, {
      handedOffTo: input.handedOffTo,
      note: input.note
    });
    if (input.companyId) revalidatePath(`/companies/${input.companyId}`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : String(e)
    };
  }
}
