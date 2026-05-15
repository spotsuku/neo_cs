import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// 今日 = 2026-05-15 (システムメモリ参照)。dueDate <= today で overdue 判定。
const TODAY = "2026-05-15";

const seedContracts = [
  // active: 含める
  {
    id: "ct-1",
    companyId: "co-1",
    product: "neoa",
    status: "active",
    cycleNumber: 2
  },
  // churned: 除外
  {
    id: "ct-2",
    companyId: "co-2",
    product: "neoa",
    status: "churned",
    cycleNumber: 1
  },
  // renewed: 除外
  {
    id: "ct-3",
    companyId: "co-3",
    product: "neoa",
    status: "renewed",
    cycleNumber: 1
  }
];

const seedItems = [
  // overdue かつ todo → 通知される
  {
    id: "ob-1",
    contractId: "ct-1",
    categoryKey: "kickoff",
    itemKey: "intro",
    name: "キックオフ実施",
    dueDate: "2026-05-10",
    assignee: "u-1",
    status: "todo",
    required: true
  },
  // overdue だが done → 除外
  {
    id: "ob-2",
    contractId: "ct-1",
    categoryKey: "kickoff",
    itemKey: "doc",
    name: "資料共有",
    dueDate: "2026-05-01",
    assignee: "u-1",
    status: "done",
    required: true
  },
  // overdue だが not_applicable → 除外
  {
    id: "ob-3",
    contractId: "ct-1",
    categoryKey: "kickoff",
    itemKey: "opt",
    name: "追加オプション",
    dueDate: "2026-05-01",
    assignee: "u-1",
    status: "not_applicable",
    required: false
  },
  // 未来 dueDate → 除外
  {
    id: "ob-4",
    contractId: "ct-1",
    categoryKey: "kickoff",
    itemKey: "future",
    name: "未来タスク",
    dueDate: "2026-06-01",
    assignee: "u-1",
    status: "todo",
    required: true
  }
];

const enqueued: Array<Record<string, unknown>> = [];

vi.mock("@/lib/repository/server", () => ({
  contractRepo: {
    list: vi.fn(async () => seedContracts)
  },
  onboardingItemRepo: {
    listByContractIds: vi.fn(async (ids: string[]) =>
      seedItems.filter((i) => ids.includes(i.contractId))
    )
  },
  companyRepo: {
    getById: vi.fn(async (id: string) => ({
      id,
      name: id === "co-1" ? "アクメ社" : id
    }))
  }
}));

vi.mock("./inbox", () => ({
  enqueueNotification: vi.fn(async (input: Record<string, unknown>) => {
    enqueued.push(input);
  }),
  resolvePrimaryAssignee: vi.fn(async () => "u-primary")
}));

beforeEach(() => {
  enqueued.length = 0;
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T03:00:00Z`));
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("dispatchOnboardingOverdueNotifications", () => {
  it("期限超過の未完了項目のみ通知する (done/not_applicable/未来は除外)", async () => {
    const { dispatchOnboardingOverdueNotifications } = await import(
      "./onboarding-overdue"
    );
    const r = await dispatchOnboardingOverdueNotifications();
    expect(r.scanned).toBe(1);
    expect(r.notified).toBe(1);
    expect(r.errors).toEqual([]);
    expect(enqueued).toHaveLength(1);
    const n = enqueued[0];
    expect(n.userId).toBe("u-1"); // item.assignee が設定済なのでそれを使う
    expect(n.category).toBe("onboarding");
    expect(n.sourceType).toBe("onboarding_task");
    expect(n.sourceId).toBe("ob-1");
    expect(n.relatedCompanyId).toBe("co-1");
    expect(n.relatedContractId).toBe("ct-1");
    expect(String(n.title)).toContain("キックオフ実施");
    expect(String(n.body)).toContain("アクメ社");
    expect(String(n.body)).toContain("2期");
    expect(n.linkHref).toBe("/companies/co-1");
  });

  it("assignee 未設定の場合は primary owner にフォールバックする", async () => {
    seedItems[0].assignee = ""; // 一時的に空
    try {
      const { dispatchOnboardingOverdueNotifications } = await import(
        "./onboarding-overdue"
      );
      const r = await dispatchOnboardingOverdueNotifications();
      expect(r.notified).toBe(1);
      expect(enqueued[0].userId).toBe("u-primary");
    } finally {
      seedItems[0].assignee = "u-1";
    }
  });
});
