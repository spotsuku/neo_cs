"use server";

import { revalidatePath } from "next/cache";
import { userRepo, userNotificationRepo } from "@/lib/repository/server";

export async function markNotificationReadAction(
  id: string
): Promise<{ ok: boolean }> {
  const me = await userRepo.getCurrent();
  if (!me?.id) return { ok: false };
  await userNotificationRepo.markRead(id, me.id);
  revalidatePath("/notifications");
  return { ok: true };
}

export async function markAllNotificationsReadAction(): Promise<{
  ok: boolean;
  count: number;
}> {
  const me = await userRepo.getCurrent();
  if (!me?.id) return { ok: false, count: 0 };
  const count = await userNotificationRepo.markAllRead(me.id);
  revalidatePath("/notifications");
  return { ok: true, count };
}
