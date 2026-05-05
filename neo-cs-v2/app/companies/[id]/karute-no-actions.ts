"use server";

// カルテNo. 変更 Server Action

import { revalidatePath } from "next/cache";
import { getRepo } from "@/lib/repository/server";

export type SetKaruteNoResult =
  | { ok: true }
  | {
      ok: false;
      code: "KARUTE_NO_CONFLICT" | "KARUTE_NO_INVALID" | "UNKNOWN";
      message: string;
    };

export async function setCompanyKaruteNoAction(input: {
  companyId: string;
  newNo: number;
}): Promise<SetKaruteNoResult> {
  const repo = getRepo();
  try {
    await repo.companies.setKaruteNo(input.companyId, input.newNo);
    revalidatePath(`/companies/${input.companyId}`);
    revalidatePath("/companies");
    return { ok: true };
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "KARUTE_NO_CONFLICT" || code === "KARUTE_NO_INVALID") {
      return { ok: false, code, message: (e as Error).message };
    }
    return { ok: false, code: "UNKNOWN", message: (e as Error).message };
  }
}
