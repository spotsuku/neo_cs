"use server";

import { revalidatePath } from "next/cache";
import { userRepo } from "@/lib/repository/server";
import { sendReply } from "@/lib/integrations/gmail-send";

export type SendReplyInput = {
  inReplyToMessageId: string;
  body: string;
  subject?: string;
};

export async function sendReplyAction(
  input: SendReplyInput
): Promise<{ ok: boolean; messageId?: string; reason?: string }> {
  const me = await userRepo.getCurrent();
  if (!me?.id) return { ok: false, reason: "not_authenticated" };
  if (!input.body || input.body.trim().length === 0) {
    return { ok: false, reason: "empty_body" };
  }
  const result = await sendReply({
    inReplyToMessageId: input.inReplyToMessageId,
    senderUserId: me.id,
    body: input.body,
    subject: input.subject
  });
  if (result.ok) {
    revalidatePath("/inbox");
    revalidatePath(`/inbox`);
  }
  return result;
}
