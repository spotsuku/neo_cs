"use server";

import { revalidatePath } from "next/cache";
import { userRepo, gmailConnectionRepo } from "@/lib/repository/server";

export async function disconnectGmailAction(): Promise<{ ok: boolean }> {
  const me = await userRepo.getCurrent();
  if (!me?.id) return { ok: false };
  await gmailConnectionRepo.delete(me.id);
  revalidatePath("/settings/gmail");
  return { ok: true };
}
