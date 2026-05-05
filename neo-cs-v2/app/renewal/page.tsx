import { TopNavServer } from "@/components/TopNavServer";
import { RenewalView } from "./RenewalView";
import { activeContracts, allContracts } from "@/lib/mock/onboarding";
import { companies } from "@/lib/mock/entities";
import { churnRecords } from "@/lib/mock/churn";

export default function RenewalPage() {
  // 更新ウィンドウ対象（status=renewal_window）
  const renewalContracts = activeContracts.filter((c) => c.status === "renewal_window");

  return (
    <>
      <TopNavServer current="/renewal" />
      <RenewalView
        renewalContracts={renewalContracts}
        allContracts={allContracts}
        companies={companies}
        churnRecords={churnRecords}
      />
    </>
  );
}
