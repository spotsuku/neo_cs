import { TopNavServer } from "@/components/nav/TopNavServer";
import { AttendanceClient } from "./AttendanceClient";
import {
  participantRepo,
  sessionRepo,
  attendanceRepo,
  contractRepo,
  companyRepo,
  contactRepo
} from "@/lib/repository/server";
import { products } from "@/lib/master";

export const dynamic = "force-dynamic";

export default async function AttendancePage({
  searchParams
}: {
  searchParams?: Promise<{ sessionId?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const initialSessionId = sp.sessionId;

  // ─── 第1段: 親キー単独で取れるリソースを並列取得 ─────────────
  const [participants, allContracts, companies] = await Promise.all([
    participantRepo.list(),
    contractRepo.list(),
    companyRepo.list()
  ]);

  // active 派生 (companies/[id]/page.tsx と同じ式)
  const activeContracts = allContracts.filter(
    (c) => c.status !== "renewed" && c.status !== "churned"
  );

  // ─── 第2段: contract / company 単位で粒度 fetch ──────────────
  const activeContractIds = activeContracts.map((c) => c.id);
  const companyIds = companies.map((c) => c.id);

  const [sessionsByContract, recordsByContract, contactsByCompany] = await Promise.all([
    Promise.all(activeContractIds.map((id) => sessionRepo.listByContract(id))),
    Promise.all(activeContractIds.map((id) => attendanceRepo.listByContract(id))),
    Promise.all(companyIds.map((id) => contactRepo.listByCompany(id)))
  ]);

  const sessions = sessionsByContract.flat();
  const attendanceRecords = recordsByContract.flat();
  const contacts = contactsByCompany.flat();

  return (
    <>
      <TopNavServer current="/attendance" />
      <AttendanceClient
        initialParticipants={participants}
        initialSessions={sessions}
        initialRecords={attendanceRecords}
        contracts={activeContracts}
        companies={companies}
        contacts={contacts}
        products={products}
        initialSessionId={initialSessionId}
      />
    </>
  );
}
