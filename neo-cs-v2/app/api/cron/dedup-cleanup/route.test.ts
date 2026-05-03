import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/notifications/dedup", () => ({
  cleanupExpiredDedup: vi.fn(async () => 5)
}));

const ORIG = process.env.CRON_SECRET;
beforeEach(() => {
  process.env.CRON_SECRET = "test-secret";
});
afterEach(() => {
  if (ORIG == null) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIG;
  vi.clearAllMocks();
});

async function call(headers: Record<string, string> = {}) {
  const { GET } = await import("./route");
  const req = new Request("http://localhost/api/cron/dedup-cleanup", { headers });
  return GET(req as unknown as Parameters<typeof GET>[0]);
}

describe("/api/cron/dedup-cleanup", () => {
  it("無トークン → 401", async () => {
    expect((await call()).status).toBe(401);
  });

  it("CRON_SECRET 未設定 → 503", async () => {
    delete process.env.CRON_SECRET;
    expect((await call({ authorization: "Bearer x" })).status).toBe(503);
  });

  it("正規 token → 200 + deleted 数を返す", async () => {
    const r = await call({ authorization: "Bearer test-secret" });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.status).toBe("ok");
    expect(body.deleted).toBe(5);
    expect(body.request_id).toBeDefined();
  });

  it("cleanup 例外時 → 500 + 内部詳細マスキング", async () => {
    const dedup = await import("@/lib/notifications/dedup");
    vi.mocked(dedup.cleanupExpiredDedup).mockRejectedValueOnce(new Error("internal-secret"));
    const r = await call({ authorization: "Bearer test-secret" });
    expect(r.status).toBe(500);
    const body = await r.json();
    expect(body.error).toBe("cleanup_failed");
    expect(JSON.stringify(body)).not.toContain("internal-secret");
  });
});
