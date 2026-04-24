import { notFound } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { CompanyDetail } from "./CompanyDetail";
import {
  companies,
  contacts,
  meetingLogs
} from "@/lib/mock/entities";
import {
  activeContracts,
  contractOnboardingItems
} from "@/lib/mock/onboarding";

export default async function CompanyDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = companies.find((c) => c.id === id);
  if (!company) return notFound();

  const companyContacts = contacts.filter((c) => c.companyId === id);
  const logs = meetingLogs
    .filter((m) => m.companyId === id)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const companyContracts = activeContracts.filter((c) => c.companyId === id);
  const companyItems = contractOnboardingItems.filter((i) =>
    companyContracts.some((c) => c.id === i.contractId)
  );

  return (
    <>
      <TopNav current="/companies" />
      <CompanyDetail
        company={company}
        contacts={companyContacts}
        logs={logs}
        contracts={companyContracts}
        items={companyItems}
      />
    </>
  );
}
