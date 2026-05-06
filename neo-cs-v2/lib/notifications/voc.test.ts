import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// vocItemRepo / companyRepo / userRepo をモック化
const seedItems = [
  // priority=high, unNotified, companyあり → 通知される
  {
    id: "v-1",
    organizationId: "org",
    sourceType: "survey_response" as const,
    sourceId: "s1",
    contractId: "c-1",
    companyId: "co-1",
    excerpt: "管理画面が重い",
    tags: ["ux", "performance"],
    status: "open" as const,
    priority: "high" as const,
    assignedTo: "u-1",
    comments: [],
    createdAt: "2026-05-01T01:00:00Z",
    updatedAt: "2026-05-01T01:00:00Z"
  },
  // priority=med → スキップ (low_priority)
  {
    id: "v-2",
    organizationId: "org",
    sourceType: "meeting_log" as const,
    sourceId: "s2",
    contractId: "c-2",
    companyId: "co-2",
    excerpt: "FAQ強化希望",
    tags: ["docs"],
    status: "open" as const,
    priority: "med" as const,
    comments: [],
    createdAt: "2026-05-01T02:00:00Z",
    updatedAt: "2026-05-01T02:00:00Z"
  }
];

const markedNotified: string[] = [];

vi.mock("@/lib/repository", () => ({
  vocItemRepo: {
    list: vi.fn(async (filter: { priority?: string; unNotifiedOnly?: boolean }) => {
      // dispatch 側のフィルタ条件を尊重 (priority='high' + unNotifiedOnly)
      return seedItems.filter((v) => {
        if (filter.priority && v.priority !== filter.priority) return false;
        return true;
      });
    }),
    markNotified: vi.fn(async (id: string) => {
      markedNotified.push(id);
    })
  },
  companyRepo: {
    getById: vi.fn(async (id: string) => ({
      id,
      name: id === "co-1" ? "アクメ社" : "B社",
      ownerName: "古野"
    }))
  },
  userRepo: {
    getById: vi.fn(async (id: string) => (id === "u-1" ? { id, name: "三木" } : null))
  }
}));

vi.mock("./slack", () => ({
  notifyVocItem: vi.fn(async () => true)
}));

beforeEach(() => {
  markedNotified.length = 0;
});
afterEach(() => vi.clearAllMocks());

describe("dispatchPendingVocNotifications", () => {
  it("priority=high のみ通知 / med は skip", async () => {
    const { dispatchPendingVocNotifications } = await import("./voc");
    const r = await dispatchPendingVocNotifications();
    // mock vocItemRepo.list は priority filter を反映するため、
    // dispatch 側で渡す { priority: 'high' } により high のみ来る → notified=1
    expect(r.attempted).toBe(1);
    expect(r.notified).toBe(1);
    expect(r.failed).toBe(0);
    expect(markedNotified).toEqual(["v-1"]);
  });

  it("buildPayload は VocItemNotification の必須フィールドを揃える", async () => {
    const slack = await import("./slack");
    const { dispatchPendingVocNotifications } = await import("./voc");
    await dispatchPendingVocNotifications();
    expect(slack.notifyVocItem).toHaveBeenCalledOnce();
    const arg = vi.mocked(slack.notifyVocItem).mock.calls[0][0];
    expect(arg.vocItemId).toBe("v-1");
    expect(arg.companyName).toBe("アクメ社");
    expect(arg.priority).toBe("high");
    expect(arg.sourceType).toBe("survey_response");
    expect(arg.assignedToName).toBe("三木");
    expect(arg.tags.length).toBeGreaterThan(0);
    expect(arg.dashboardUrl).toContain("/voc#v-1");
    expect(arg.companyDashboardUrl).toContain("/companies/co-1");
  });

  it("notifyVocItem が false 返すと post_failed に分類", async () => {
    const slack = await import("./slack");
    vi.mocked(slack.notifyVocItem).mockResolvedValueOnce(false);
    const { dispatchPendingVocNotifications } = await import("./voc");
    const r = await dispatchPendingVocNotifications();
    expect(r.notified).toBe(0);
    expect(r.failed).toBe(1);
    expect(markedNotified).toEqual([]);
  });
});
