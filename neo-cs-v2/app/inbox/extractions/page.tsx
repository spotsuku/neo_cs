import { TopNavServer } from "@/components/TopNavServer";
import { ExtractionsView } from "./ExtractionsView";
import { aiExtractions, emailThreads, emailMessages } from "@/lib/mock/email";
import { companies } from "@/lib/mock/entities";

export default function ExtractionsPage() {
  return (
    <>
      <TopNavServer current="/inbox" />
      <ExtractionsView
        extractions={aiExtractions}
        threads={emailThreads}
        messages={emailMessages}
        companies={companies}
      />
    </>
  );
}
