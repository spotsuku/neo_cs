import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// dispatchPendingChurnNotifications を spy できるようにモック
vi.mock("@/lib/notifications/churn", () => ({
  dispatchPendingChurnNotifications: vi.fn(async () => ({
    attempted: 3,
    notified: 2,
    skipped: 1,
    failed: 0
  }))
}));

const ORIG_SECRET = process.env.CRON_SECRET;

beforeEach(() => {
  process.env.CRON_SECRET = "test-secret";
});

afterEach(() => {
  if (ORIG_SECRET == null) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIG_SECRET;
  vi.clearAllMocks();
});

async function call(headers: Record<string, string> = {}) {
  // Note: Next.js の app route GET は NextRequest を期待するが、
  // 構造的に Request 互換なので Request で代用可
  const { GET } = await import("./route");
  const req = new Request("http://localhost/api/cron/churn-notify", { headers });
  return GET(req as unknown as Parameters<typeof GET>[0]);
}

describe("/api/cron/churn-notify", () => {
  it("Authorization 無し → 401", async () => {
    const r = await call();
    expect(r.status).toBe(401);
  });

  it("不正 token → 401", async () => {
    const r = await call({ authorization: "Bearer wrong" });
    expect(r.status).toBe(401);
  });

  it("CRON_SECRET 未設定 → 503 misconfigured", async () => {
    delete process.env.CRON_SECRET;
    const r = await call({ authorization: "Bearer any" });
    expect(r.status).toBe(503);
  });

  it("正規 token → 200 + dispatch 結果を JSON で返す", async () => {
    const r = await call({ authorization: "Bearer test-secret" });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.status).toBe("ok");
    expect(body.attempted).toBe(3);
    expect(body.notified).toBe(2);
    expect(body.skipped).toBe(1);
    expect(body.failed).toBe(0);
    expect(body.request_id).toBeDefined();
    expect(typeof body.latencyMs).toBe("number");
  });

  it("dispatch 例外時は 500 + エラー詳細はクライアント非開示", async () => {
    const churn = await import("@/lib/notifications/churn");
    vi.mocked(churn.dispatchPendingChurnNotifications).mockRejectedValueOnce(
      new Error("internal-detail-must-not-leak")
    );
    const r = await call({ authorization: "Bearer test-secret" });
    expect(r.status).toBe(500);
    const body = await r.json();
    expect(body.error).toBe("dispatch_failed");
    expect(JSON.stringify(body)).not.toContain("internal-detail-must-not-leak");
  });
});
