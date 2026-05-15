import { describe, it, expect, beforeEach, vi } from "vitest";

// 未割当スレッドのモック
let seedUnassigned: Array<Record<string, unknown>> = [];
const seedMessages: Record<string, Array<Record<string, unknown>>> = {};

const listUnassignedMock = vi.fn(async (opts?: { limit?: number }) => {
  const limit = opts?.limit ?? 50;
  return seedUnassigned.slice(0, limit);
});
const listMessagesMock = vi.fn(async (threadId: string) => {
  return seedMessages[threadId] ?? [];
});
const companyListMock = vi.fn(async () => [
  { id: "co-1", name: "アクメ社" },
  { id: "co-2", name: "ベータ社" }
]);

const suggestMock = vi.fn(async () => ({
  companyId: "co-1",
  confidence: 0.7,
  reasoning: "ドメイン一致"
}));

vi.mock("@/lib/repository/server", () => ({
  emailRepo: {
    listUnassigned: listUnassignedMock,
    listMessages: listMessagesMock
  },
  companyRepo: {
    list: companyListMock
  }
}));

vi.mock("@/lib/integrations/email-ai", () => ({
  suggestCompanyForThread: suggestMock
}));

beforeEach(() => {
  seedUnassigned = [];
  for (const k of Object.keys(seedMessages)) delete seedMessages[k];
  vi.clearAllMocks();
});

describe("dispatchUnassignedAiSuggestions", () => {
  it("未割当スレッドが 0 件なら scanned=0 で companies も呼ばない", async () => {
    const { dispatchUnassignedAiSuggestions } = await import(
      "./unassigned-ai-suggest"
    );
    const r = await dispatchUnassignedAiSuggestions();
    expect(r.scanned).toBe(0);
    expect(r.suggested).toBe(0);
    expect(r.skipped).toBe(0);
    expect(r.errors).toEqual([]);
    expect(companyListMock).not.toHaveBeenCalled();
    expect(suggestMock).not.toHaveBeenCalled();
  });

  it("maxPerRun の上限が listUnassigned に伝播し、超過分は処理されない", async () => {
    // 5 件未割当だが maxPerRun=2 で 2 件だけ処理する
    for (let i = 1; i <= 5; i++) {
      const id = `th-${i}`;
      seedUnassigned.push({
        id,
        organizationId: "org-1",
        subject: `件名 ${i}`,
        status: "open",
        createdAt: "2026-05-01T00:00:00Z",
        updatedAt: "2026-05-01T00:00:00Z"
      });
      seedMessages[id] = [
        {
          id: `m-${i}`,
          threadId: id,
          direction: "inbound",
          body: `本文 ${i}`,
          senderEmail: `s${i}@example.com`,
          recipientEmails: ["cs@neoa.jp"],
          sentAt: "2026-05-01T00:00:00Z",
          createdAt: "2026-05-01T00:00:00Z"
        }
      ];
    }

    const { dispatchUnassignedAiSuggestions } = await import(
      "./unassigned-ai-suggest"
    );
    const r = await dispatchUnassignedAiSuggestions({ maxPerRun: 2 });

    expect(listUnassignedMock).toHaveBeenCalledWith({ limit: 2 });
    expect(r.scanned).toBe(2);
    expect(r.suggested).toBe(2);
    expect(suggestMock).toHaveBeenCalledTimes(2);
  });

  it("メッセージが空のスレッドは skip され、1 件失敗しても他は継続する", async () => {
    seedUnassigned.push(
      {
        id: "th-empty",
        organizationId: "org-1",
        subject: "空",
        status: "open",
        createdAt: "x",
        updatedAt: "x"
      },
      {
        id: "th-fail",
        organizationId: "org-1",
        subject: "失敗",
        status: "open",
        createdAt: "x",
        updatedAt: "x"
      },
      {
        id: "th-ok",
        organizationId: "org-1",
        subject: "成功",
        status: "open",
        createdAt: "x",
        updatedAt: "x"
      }
    );
    seedMessages["th-fail"] = [
      {
        id: "m-f",
        threadId: "th-fail",
        direction: "inbound",
        body: "本文",
        senderEmail: "x@example.com",
        recipientEmails: [],
        sentAt: "2026-05-01T00:00:00Z",
        createdAt: "2026-05-01T00:00:00Z"
      }
    ];
    seedMessages["th-ok"] = [
      {
        id: "m-o",
        threadId: "th-ok",
        direction: "inbound",
        body: "本文",
        senderEmail: "y@example.com",
        recipientEmails: [],
        sentAt: "2026-05-01T00:00:00Z",
        createdAt: "2026-05-01T00:00:00Z"
      }
    ];

    suggestMock.mockImplementationOnce(async () => {
      throw new Error("AI 障害");
    });

    const { dispatchUnassignedAiSuggestions } = await import(
      "./unassigned-ai-suggest"
    );
    const r = await dispatchUnassignedAiSuggestions();
    expect(r.scanned).toBe(3);
    expect(r.skipped).toBe(1); // th-empty
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain("th-fail");
    expect(r.suggested).toBe(1); // th-ok のみ成功
  });
});
