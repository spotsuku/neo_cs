import { TopNavServer } from "@/components/nav/TopNavServer";
import { ExtractionsView } from "./ExtractionsView";
import {
  emailRepo,
  aiExtractionRepo,
  companyRepo
} from "@/lib/repository/server";
import { getPermissionContext } from "@/lib/auth/server";
import { DEFAULT_ORG_ID } from "@/lib/repository/types";

// 本番 supabase が空 DB なら全部空配列。adapter で旧 mock 互換 shape へ変換し
// 「データ無し」表示で正しく描画される。
export default async function ExtractionsPage() {
  const ctx = await getPermissionContext();
  const orgId = ctx.actor?.organizationId ?? DEFAULT_ORG_ID;

  const [companies, threadsRaw] = await Promise.all([
    companyRepo.list(),
    emailRepo.listThreads({ organizationId: orgId })
  ]);

  const messagesNested = await Promise.all(
    threadsRaw.map((t) => emailRepo.listMessages(t.id))
  );
  const messagesRaw = messagesNested.flat();

  const extractionsNested = await Promise.all(
    companies.map((c) => aiExtractionRepo.listByCompany(c.id))
  );
  const extractionsRaw = extractionsNested.flat();

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

  const adaptedExtractions = extractionsRaw.map((x) => ({
    id: x.id,
    threadId: x.sourceType === "email" ? x.sourceId : "",
    messageId: x.sourceType === "email" ? x.sourceId : "",
    type: x.extractionType,
    suggestion: x.suggestedAction ?? x.excerpt ?? "",
    confidence: x.confidence ?? 0,
    status: (x.reviewed ? "approved" : "pending") as
      | "pending"
      | "approved"
      | "rejected",
    createdAt: x.createdAt
  }));

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
