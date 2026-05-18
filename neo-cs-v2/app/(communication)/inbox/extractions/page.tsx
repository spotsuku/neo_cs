import { TopNavServer } from "@/components/nav/TopNavServer";
import { ExtractionsView } from "./ExtractionsView";
import {
  emailRepo,
  aiExtractionRepo,
  companyRepo
} from "@/lib/repository/server";
import { getPermissionContext } from "@/lib/auth/server";
import { DEFAULT_ORG_ID } from "@/lib/repository/types";

// 現ログインユーザー担当の未レビュー抽出のみを取得する。
// thread / message は抽出に紐づくものだけに絞って fetch (N+1 抑制)。
export default async function ExtractionsPage() {
  const ctx = await getPermissionContext();
  const orgId = ctx.actor?.organizationId ?? DEFAULT_ORG_ID;

  const extractionsRaw = ctx.actor
    ? await aiExtractionRepo.listByMe(ctx.actor.id, { unreviewedOnly: true })
    : [];

  // email source の sourceId = email_messages.id。担当スレッドだけを引き当てる。
  const threadsRaw = ctx.actor
    ? (await emailRepo.listThreads({ organizationId: orgId })).filter(
        (t) => t.assigneeUserId === ctx.actor!.id
      )
    : [];

  const messagesNested = await Promise.all(
    threadsRaw.map((t) => emailRepo.listMessages(t.id))
  );
  const messagesRaw = messagesNested.flat();

  const companies = await companyRepo.list();

  const adaptedThreads = threadsRaw.map((t) => ({
    id: t.id,
    companyId: t.companyId ?? "",
    subject: t.subject,
    status: t.status,
    assignee: t.assigneeUserId ?? "",
    lastMessageAt: t.lastInboundAt ?? t.lastOutboundAt ?? t.updatedAt
  }));

  const adaptedMessages = messagesRaw.map((m) => ({
    id: m.id,
    threadId: m.threadId,
    from: m.senderEmail,
    to: m.recipientEmails,
    cc: [] as string[],
    sentAt: m.sentAt,
    body: m.body,
    direction: m.direction
  }));

  // sourceId(=message id) → threadId を逆引きするマップ
  const messageThreadMap = new Map(messagesRaw.map((m) => [m.id, m.threadId]));

  const adaptedExtractions = extractionsRaw.map((x) => {
    const messageId = x.sourceType === "email" ? x.sourceId : "";
    const threadId = messageId ? messageThreadMap.get(messageId) ?? "" : "";
    return {
      id: x.id,
      threadId,
      messageId,
      type: x.extractionType,
      suggestion: x.suggestedAction ?? x.excerpt ?? "",
      confidence: x.confidence ?? 0,
      status: (x.reviewed ? "approved" : "pending") as
        | "pending"
        | "approved"
        | "rejected",
      createdAt: x.createdAt
    };
  });

  return (
    <>
      <TopNavServer current="/inbox" />
      <ExtractionsView
        extractions={adaptedExtractions}
        threads={adaptedThreads}
        messages={adaptedMessages}
        companies={companies}
      />
    </>
  );
}
