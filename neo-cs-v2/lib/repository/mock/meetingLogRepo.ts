import { meetingLogs as seed } from "@/lib/mock/entities";
import { DEFAULT_ORG_ID } from "../types";
import type {
  MeetingLog,
  MeetingLogCreateInput,
  MeetingLogListOpts,
  MeetingLogRepo
} from "../types";

const store: MeetingLog[] = seed.map((m) => ({ ...m, organizationId: DEFAULT_ORG_ID }));

function applySort(rows: MeetingLog[], sort?: string): MeetingLog[] {
  if (!sort) return rows;
  const m = sort.match(/^(\w+)\s*(asc|desc)?$/i);
  if (!m) return rows;
  const [, field, dirRaw] = m;
  const dir = (dirRaw ?? "asc").toLowerCase() === "desc" ? -1 : 1;
  const key = field as keyof MeetingLog;
  return [...rows].sort((a, b) => {
    const av = a[key] as unknown;
    const bv = b[key] as unknown;
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

export const mockMeetingLogRepo: MeetingLogRepo = {
  async listByCompany(companyId, opts?: MeetingLogListOpts) {
    const filtered = store.filter((m) => m.companyId === companyId);
    const sorted = applySort(filtered, opts?.sort);
    const sliced = opts?.limit ? sorted.slice(0, opts.limit) : sorted;
    return sliced.map((m) => ({ ...m }));
  },
  async create(input: MeetingLogCreateInput) {
    const log: MeetingLog = {
      ...input,
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      organizationId: input.organizationId ?? DEFAULT_ORG_ID
    };
    store.unshift(log);
    return { ...log };
  }
};
