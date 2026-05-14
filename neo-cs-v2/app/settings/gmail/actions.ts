"use server";

import { revalidatePath } from "next/cache";
import { userRepo, gmailConnectionRepo } from "@/lib/repository/server";
import { syncConnection } from "@/lib/integrations/gmail-sync";

export async function disconnectGmailAction(): Promise<{ ok: boolean }> {
  const me = await userRepo.getCurrent();
  if (!me?.id) return { ok: false };
  await gmailConnectionRepo.delete(me.id);
  revalidatePath("/settings/gmail");
  return { ok: true };
}

/** 本人の Gmail を 1 回同期。UI の「今すぐ同期」ボタンから呼び出す。 */
export async function syncGmailNowAction(): Promise<{
  ok: boolean;
  fetched?: number;
  inserted?: number;
  skipped?: number;
  errors?: number;
  message?: string;
}> {
  const me = await userRepo.getCurrent();
  if (!me?.id) return { ok: false, message: "未ログイン" };
  const conn = await gmailConnectionRepo.getByUserId(me.id);
  if (!conn) return { ok: false, message: "Gmail に未接続" };
  try {
    const r = await syncConnection(conn);
    revalidatePath("/settings/gmail");
    return {
      ok: true,
      fetched: r.fetched,
      inserted: r.inserted,
      skipped: r.skipped,
      errors: r.errors.length
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
