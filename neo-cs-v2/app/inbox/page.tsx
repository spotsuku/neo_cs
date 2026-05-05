import { Suspense } from "react";
import { TopNavServer } from "@/components/TopNavServer";
import { InboxView } from "./InboxView";
import {
  emailThreads,
  emailMessages,
  aiExtractions,
  internalThreadComments
} from "@/lib/mock/email";
import { companies, contacts } from "@/lib/mock/entities";
import { allContracts } from "@/lib/mock/onboarding";
import { programRepo } from "@/lib/repository";

// CS運用の中核: 全社横断のメールキュー
// 「自分宛 / 自分が返信担当 / 事業別 / すべて」で切替
export default async function InboxPage() {
  const programs = await programRepo.listTerms({ status: ["active", "draft"] });
  return (
    <>
      <TopNavServer current="/inbox" />
      <Suspense fallback={<div className="p-8 text-sm text-ink-500">読み込み中...</div>}>
        <InboxView
          threads={emailThreads}
          messages={emailMessages}
          extractions={aiExtractions}
          companies={companies}
          contacts={contacts}
          contracts={allContracts}
          programs={programs}
          internalComments={internalThreadComments}
        />
      </Suspense>
    </>
  );
}
