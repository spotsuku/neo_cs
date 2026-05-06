// attendance_events (Mock 実装)
// データソース: lib/mock/participants.ts attendanceRecords

import {
  attendanceRecords as seed,
  sessions as seedSessions
} from "@/lib/mock/participants";
import { DEFAULT_ORG_ID } from "../types";
import type { AttendanceEvent, AttendanceRepo } from "../types";

const store: AttendanceEvent[] = seed.map((r) => ({
  ...r,
  organizationId: DEFAULT_ORG_ID
}));

export const mockAttendanceRepo: AttendanceRepo = {
  async listByContract(contractId) {
    const sessionIds = new Set(
      seedSessions.filter((s) => s.contractId === contractId).map((s) => s.id)
    );
    return store
      .filter((r) => sessionIds.has(r.sessionId))
      .map((r) => ({ ...r }));
  }
};
