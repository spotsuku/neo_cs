import { Suspense } from "react";
import { TopNavServer } from "@/components/nav/TopNavServer";
import { InboxView } from "./InboxView";
import {
  emailRepo,
  aiExtractionRepo,
  companyRepo,
  contactRepo,
  contractRepo,
  programRepo
} from "@/lib/repository/server";
import { getPermissionContext } from "@/lib/auth/server";
import { DEFAULT_ORG_ID } from "@/lib/repository/types";

// CS運用の中核: 全社横断のメールキュー
// 「自分宛 / 自分が返信担当 / 事業別 / すべて」で切替
//
// 本番 supabase は空 DB のため、emailRepo / aiExtractionRepo / contactRepo は
// 実質空配列を返す。adapter で旧 mock 互換 shape に変換し、UI は「データ無し」
// 状態で正しく描画される。
export default async function InboxPage() {
  const ctx = await getPermissionContext();
  const orgId = ctx.actor?.organizationId ?? DEFAULT_ORG_ID;

  const [threadsRaw, companies, contracts, programs] = await Promise.all([
    emailRepo.listThreads({ organizationId: orgId }),
    companyRepo.list(),
    contractRepo.list(),
    programRepo.listTerms({ status: ["active", "draft"] })
  ]);

  // 全 thread の messages を集約
  const messagesNested = await Promise.all(
    threadsRaw.map((t) => emailRepo.listMessages(t.id))
  );
  const messagesRaw = messagesNested.flat();

  // 全企業の AI 抽出を集約 (supabase 空 DB なら空配列)
  const extractionsNested = await Promise.all(
    companies.map((c) => aiExtractionRepo.listByCompany(c.id))
  );
  const extractionsRaw = extractionsNested.flat();

  // 全企業の contacts を集約 (空 DB なら空配列)
  const contactsNested = await Promise.all(
    companies.map((c) => contactRepo.listByCompany(c.id))
  );
  const contactsRaw = contactsNested.flat();

  // adapter: repo shape → 旧 mock 互換 shape
  // 本番に存在しない概念 (slaDeadline / programTermId / messageIds 等) は undefined / 空
  const adaptedThreads = threadsRaw.map((t) => {
    const msgIds = messagesRaw
      .filter((m) => m.threadId === t.id)
      .map((m) => m.id);
    return {
      id: t.id,
      companyId: t.companyId ?? "",
      contractId: undefined,
      programTermId: undefined,
      subject: t.subject,
      status: t.status,
      assignee: t.assigneeUserId ?? "",
      assigneeReason: t.assigneeReason,
      receivedBy: undefined,
      slaDeadline: undefined,
      lastMessageAt: t.lastInboundAt ?? t.lastOutboundAt ?? t.updatedAt,
      messageIds: msgIds,
      statusHistory: [] as never[]
    };
  });

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

  // 旧 enum (5 種) と repo の新 enum (5 種) の対応
  // - onboarding_task_done → progress_signal
  // - stakeholder_change   → progress_signal
  // - negative_signal      → risk_signal
  // - next_action          → meeting_request
  // - renewal_signal       → churn_signal / expansion_signal
  // View 側の TYPE_LABEL / TYPE_COLOR は新 enum 5 種で再定義済み
  const adaptedExtractions = extractionsRaw.map((x) => ({
    id: x.id,
    threadId: x.sourceType === "email" ? x.sourceId : "",
    messageId: x.sourceType === "email" ? x.sourceId : "",
    type: x.extractionType,
    targetId: undefined,
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
      <Suspense fallback={<div className="p-8 text-sm text-ink-500">読み込み中...</div>}>
        <InboxView
          threads={adaptedThreads}
          messages={adaptedMessages}
          extractions={adaptedExtractions}
          companies={companies}
          contacts={contactsRaw}
          contracts={contracts}
          programs={programs}
          internalComments={[]}
        />
      </Suspense>
    </>
  );
}
