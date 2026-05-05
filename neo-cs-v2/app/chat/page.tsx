import { TopNavServer } from "@/components/TopNavServer";
import { ChatView } from "./ChatView";
import { getRepo } from "@/lib/repository/server";
import { getPermissionContext } from "@/lib/auth/server";
import { DEFAULT_ORG_ID } from "@/lib/repository/types";

// アプリ全体のチャット
//   - DM / 事業部 / メールスレッド（受信箱の社内チャット）を統合
//   - mock / supabase ドライバを Repository 経由で透過
export default async function ChatPage() {
  const repo = getRepo();
  const ctx = await getPermissionContext();
  const orgId = ctx.actor?.organizationId ?? DEFAULT_ORG_ID;
  const userName = ctx.actor?.name ?? "古野";

  const channels = await repo.chats.listChannels({
    organizationId: orgId,
    userName
  });
  const initialChannelId = channels[0]?.id ?? "";
  const initialMessages = initialChannelId
    ? await repo.chats.listMessages(initialChannelId)
    : [];
  const users = await repo.users.list({ activeOnly: true });

  return (
    <>
      <TopNavServer current="/chat" />
      <ChatView
        initialChannels={channels}
        initialChannelId={initialChannelId}
        initialMessages={initialMessages}
        memberNames={users.map((u) => u.name)}
        currentUserName={userName}
      />
    </>
  );
}
