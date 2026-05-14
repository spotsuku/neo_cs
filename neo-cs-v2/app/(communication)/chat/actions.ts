"use server";

// チャット (DM / 事業部 / メールスレッド統合) の Server Actions
//
// Repository 経由で mock / supabase 両ドライバに対応。

import { revalidatePath } from "next/cache";
import { getRepo } from "@/lib/repository/server";
import { DEFAULT_ORG_ID } from "@/lib/repository/types";
import { getPermissionContext } from "@/lib/auth/server";
import type { ChatChannel, ChatMessage } from "@/lib/repository/types";

async function currentActor(): Promise<{ orgId: string; userName: string }> {
  const ctx = await getPermissionContext();
  return {
    orgId: ctx.actor?.organizationId ?? DEFAULT_ORG_ID,
    userName: ctx.actor?.name ?? "古野"
  };
}

export async function listChannelsAction(): Promise<ChatChannel[]> {
  const repo = getRepo();
  const { orgId, userName } = await currentActor();
  return repo.chats.listChannels({ organizationId: orgId, userName });
}

export async function listMessagesAction(channelId: string): Promise<ChatMessage[]> {
  const repo = getRepo();
  return repo.chats.listMessages(channelId);
}

export async function postMessageAction(input: {
  channelId: string;
  body: string;
  mentions: string[];
}): Promise<ChatMessage> {
  const repo = getRepo();
  const { userName } = await currentActor();
  const msg = await repo.chats.postMessage({
    channelId: input.channelId,
    authorName: userName,
    body: input.body,
    mentions: input.mentions
  });
  revalidatePath("/chat");
  return msg;
}

export async function ensureDmAction(otherName: string): Promise<ChatChannel> {
  const repo = getRepo();
  const { orgId, userName } = await currentActor();
  const ch = await repo.chats.ensureDm({
    organizationId: orgId,
    userA: userName,
    userB: otherName
  });
  revalidatePath("/chat");
  return ch;
}
