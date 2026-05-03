import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/notifications/voc", () => ({
  dispatchPendingVocNotifications: vi.fn(async () => ({
    attempted: 6,
    notified: 4,
    skipped: 2,
    failed: 0
  }))
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
  const req = new Request("http://localhost/api/cron/voc-notify", { headers });
  return GET(req as unknown as Parameters<typeof GET>[0]);
}

describe("/api/cron/voc-notify", () => {
  it("無トークン → 401", async () => {
    expect((await call()).status).toBe(401);
  });

  it("不正 token → 401", async () => {
    expect((await call({ authorization: "Bearer wrong" })).status).toBe(401);
  });

  it("CRON_SECRET 未設定 → 503", async () => {
    delete process.env.CRON_SECRET;
    expect((await call({ authorization: "Bearer any" })).status).toBe(503);
  });

  it("正規 token → 200 + dispatch 結果を返す", async () => {
    const r = await call({ authorization: "Bearer test-secret" });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.status).toBe("ok");
    expect(body.attempted).toBe(6);
    expect(body.notified).toBe(4);
    expect(body.skipped).toBe(2);
    expect(body.failed).toBe(0);
    expect(body.request_id).toBeDefined();
    expect(typeof body.latencyMs).toBe("number");
  });

  it("dispatch 例外時 → 500 + 内部詳細マスキング", async () => {
    const voc = await import("@/lib/notifications/voc");
    vi.mocked(voc.dispatchPendingVocNotifications).mockRejectedValueOnce(
      new Error("voc-internal-secret-leak")
    );
    const r = await call({ authorization: "Bearer test-secret" });
    expect(r.status).toBe(500);
    const body = await r.json();
    expect(body.error).toBe("dispatch_failed");
    expect(JSON.stringify(body)).not.toContain("voc-internal-secret-leak");
  });
});
