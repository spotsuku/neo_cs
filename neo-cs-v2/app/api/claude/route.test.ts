import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/security/auth", () => ({
  verifyBearer: vi.fn(),
  getClientIp: vi.fn(() => "10.0.0.1")
}));

vi.mock("@/lib/repository/audit", () => ({
  recordAudit: vi.fn()
}));

const ORIG_KEY = process.env.ANTHROPIC_API_KEY;

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.ALLOWED_ORIGINS = "http://localhost:3000";
});

afterEach(() => {
  if (ORIG_KEY == null) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = ORIG_KEY;
  vi.clearAllMocks();
});

async function call(opts: { auth?: string; body?: unknown; origin?: string } = {}) {
  const { POST } = await import("./route");
  const req = new Request("http://localhost/api/claude", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(opts.auth ? { authorization: opts.auth } : {}),
      ...(opts.origin ? { origin: opts.origin } : {})
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  return POST(req as unknown as Parameters<typeof POST>[0]);
}

describe("/api/claude — 認証/入力検証", () => {
  it("origin 不許可 → 403", async () => {
    const r = await call({ origin: "https://evil.test", body: { messages: [{ role: "user", content: "x" }] } });
    expect(r.status).toBe(403);
  });

  it("Authorization 無し → 401", async () => {
    const auth = await import("@/lib/security/auth");
    vi.mocked(auth.verifyBearer).mockResolvedValueOnce(null);
    const r = await call({ body: { messages: [{ role: "user", content: "x" }] } });
    expect(r.status).toBe(401);
  });

  it("messages 無しの body → 400 messages_required", async () => {
    const auth = await import("@/lib/security/auth");
    vi.mocked(auth.verifyBearer).mockResolvedValueOnce({
      userId: "u1",
      email: "u@x",
      role: "member",
      organizationId: "org1"
    });
    const r = await call({ auth: "Bearer x", body: {} });
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body.error).toBe("messages_required");
  });

  it("認証OK + 正常 → Anthropic に Bearer 経由で投げる (mock)", async () => {
    const auth = await import("@/lib/security/auth");
    vi.mocked(auth.verifyBearer).mockResolvedValueOnce({
      userId: "u1",
      email: "u@x",
      role: "member",
      organizationId: "org1"
    });
    const origFetch = global.fetch;
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ content: [{ text: "ok" }], usage: { input_tokens: 10, output_tokens: 5 } }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    ) as typeof fetch;

    const r = await call({
      auth: "Bearer x",
      body: { messages: [{ role: "user", content: "ping" }] }
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.content[0].text).toBe("ok");

    global.fetch = origFetch;
  });
});

describe("/api/claude — 用途別モデル振り分け", () => {
  it.each([
    ["survey_insight", "claude-opus-4-7"],
    ["weekly_review", "claude-opus-4-7"],
    ["voc_extraction", "claude-opus-4-7"],
    ["mail_extraction", "claude-sonnet-4-6"],
    ["mail_reply", "claude-sonnet-4-6"],
    ["mail_summary", "claude-haiku-4-5"],
    [undefined, "claude-sonnet-4-6"],
  ])("purpose=%s → model=%s", async (purpose, expectedModel) => {
    const auth = await import("@/lib/security/auth");
    vi.mocked(auth.verifyBearer).mockResolvedValueOnce({
      userId: "u1",
      email: "u@x",
      role: "member",
      organizationId: "org1"
    });
    const captured: { body?: Record<string, unknown> } = {};
    const origFetch = global.fetch;
    global.fetch = vi.fn(async (_url, init) => {
      captured.body = JSON.parse((init as RequestInit).body as string);
      return new Response(
        JSON.stringify({ content: [{ text: "ok" }], usage: { input_tokens: 1, output_tokens: 1 } }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }) as typeof fetch;

    const r = await call({
      auth: "Bearer x",
      body: {
        messages: [{ role: "user", content: "ping" }],
        ...(purpose ? { purpose } : {})
      }
    });
    expect(r.status).toBe(200);
    expect(captured.body?.model).toBe(expectedModel);

    global.fetch = origFetch;
  });
});

describe("/api/claude — 縮退モード", () => {
  it("DEGRADED_ANTHROPIC=true → 503 service_degraded", async () => {
    process.env.DEGRADED_ANTHROPIC = "true";
    try {
      const r = await call({ origin: "http://localhost:3000", body: { messages: [{ role: "user", content: "x" }] } });
      expect(r.status).toBe(503);
      const body = await r.json();
      expect(body.error).toBe("service_degraded");
    } finally {
      delete process.env.DEGRADED_ANTHROPIC;
    }
  });
});
