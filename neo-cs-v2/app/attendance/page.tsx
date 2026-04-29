import { TopNav } from "@/components/TopNav";
import { AttendanceClient } from "./AttendanceClient";
import { participants, sessions, attendanceRecords } from "@/lib/mock/participants";
import { allContracts } from "@/lib/mock/onboarding";
import { companies } from "@/lib/mock/entities";
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
      <TopNav current="/attendance" />
      <AttendanceClient
        initialParticipants={participants}
        initialSessions={sessions}
        initialRecords={attendanceRecords}
        contracts={allContracts}
        companies={companies}
        products={products}
        initialSessionId={initialSessionId}
      />
    </>
  );
}
