import { Suspense } from "react";
import { TopNav } from "@/components/TopNav";
import { InboxView } from "./InboxView";
import { emailThreads, emailMessages, aiExtractions } from "@/lib/mock/email";
import { companies } from "@/lib/mock/entities";
import { allContracts } from "@/lib/mock/onboarding";

// CS運用の中核: 全社横断のメールキュー
// 「未対応 / 自分の担当 / AI承認待ち」を即座に把握する
export default function InboxPage() {
  return (
    <>
      <TopNav current="/inbox" />
      <Suspense fallback={<div className="p-8 text-sm text-ink-500">読み込み中...</div>}>
        <InboxView
          threads={emailThreads}
          messages={emailMessages}
          extractions={aiExtractions}
          companies={companies}
          contracts={allContracts}
        />
      </Suspense>
    </>
  );
}
