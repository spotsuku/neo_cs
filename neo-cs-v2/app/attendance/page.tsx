import { TopNavServer } from "@/components/TopNavServer";
import { SectionSubNav, SIGNAL_SUBNAV } from "@/components/SectionSubNav";
import { AttendanceClient } from "./AttendanceClient";
import { participants, sessions, attendanceRecords } from "@/lib/mock/participants";
import { allContracts } from "@/lib/mock/onboarding";
import { companies, contacts } from "@/lib/mock/entities";
import { products } from "@/lib/mock/data";

export default async function AttendancePage({
  searchParams
}: {
  searchParams?: Promise<{ sessionId?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const initialSessionId = sp.sessionId;
  return (
    <>
      <TopNavServer current="/attendance" />
      <SectionSubNav items={SIGNAL_SUBNAV} />
      <AttendanceClient
        initialParticipants={participants}
        initialSessions={sessions}
        initialRecords={attendanceRecords}
        contracts={allContracts}
        companies={companies}
        contacts={contacts}
        products={products}
        initialSessionId={initialSessionId}
      />
    </>
  );
}
