import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "test-token",
            expires_at: Math.floor(Date.now() / 1000) + 600,
          },
        },
        error: null,
      })),
    },
  })),
}));

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  vi.resetModules();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("callClaude", () => {
  it("purpose と Bearer を載せて /api/claude を叩く", async () => {
    const captured: { url?: string; init?: RequestInit } = {};
    global.fetch = vi.fn(async (url: unknown, init?: unknown) => {
      captured.url = String(url);
      captured.init = init as RequestInit;
      return new Response(
        JSON.stringify({ content: [{ type: "text", text: "ok" }], usage: {} }),
        { status: 200, headers: { "X-Request-Id": "req-1" } },
      );
    }) as typeof fetch;

    const { callClaudeText } = await import("./callClaude");
    const text = await callClaudeText({
      purpose: "survey_insight",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(text).toBe("ok");
    expect(captured.url).toBe("/api/claude");
    expect(captured.init?.headers).toMatchObject({
      authorization: "Bearer test-token",
    });
    const body = JSON.parse(captured.init?.body as string);
    expect(body.purpose).toBe("survey_insight");
  });

  it("非 2xx で ClaudeApiError を投げ retry_after を保持する", async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "rate_limited", retry_after_sec: 12 }), {
          status: 429,
          headers: { "X-Request-Id": "req-2" },
        }),
    ) as typeof fetch;

    const { callClaude, ClaudeApiError } = await import("./callClaude");
    await expect(
      callClaude({ purpose: "mail_reply", messages: [{ role: "user", content: "x" }] }),
    ).rejects.toMatchObject({
      name: "ClaudeApiError",
      status: 429,
      code: "rate_limited",
      retryAfterSec: 12,
    });
    // 型が export されている
    expect(ClaudeApiError).toBeDefined();
  });
});
