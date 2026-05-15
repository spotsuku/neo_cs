"use server";

// 未割当スレッド (companyId = null) の手動アサイン Server Action (F3)
//
// Gmail 同期で email_domains / company_contacts.email 解決に失敗したスレッドを
// 後から人手で正しい企業に紐付けるための薄いアクション。
// emailRepo.setCompany() をラップし、audit_logs に流れる。

import { revalidatePath } from "next/cache";
import { emailRepo } from "@/lib/repository/server";

export type AssignThreadCompanyResult =
  | { ok: true }
  | { ok: false; message: string };

export async function assignThreadCompanyAction(
  threadId: string,
  companyId: string
): Promise<AssignThreadCompanyResult> {
  const tid = threadId.trim();
  const cid = companyId.trim();
  if (!tid) return { ok: false, message: "threadId が空です" };
  if (!cid) return { ok: false, message: "企業を選択してください" };

  try {
    await emailRepo.setCompany(tid, cid);
    revalidatePath("/inbox/unassigned");
    revalidatePath("/inbox");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
