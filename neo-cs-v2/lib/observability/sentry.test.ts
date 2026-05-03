import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ORIG_DSN = process.env.SENTRY_DSN;

beforeEach(() => {
  delete process.env.SENTRY_DSN;
  vi.resetModules(); // sentry.ts は initialized フラグを持つため毎回再 import
});

afterEach(() => {
  if (ORIG_DSN == null) delete process.env.SENTRY_DSN;
  else process.env.SENTRY_DSN = ORIG_DSN;
});

describe("sentry no-op フォールバック", () => {
  it("SENTRY_DSN 未設定なら captureException は stderr フォールバック", async () => {
    let captured: string | null = null;
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      const s = (chunk as Buffer | string).toString();
      if (s.includes("sentry_fallback_exception")) captured = s;
      return true;
    });

    const { captureException } = await import("./sentry");
    captureException(new Error("test-error-msg"), { tags: { route: "x" } });

    // void Promise を解決させる
    await new Promise((r) => setTimeout(r, 10));
    expect(captured).not.toBeNull();
    const parsed = JSON.parse(captured!);
    expect(parsed.kind).toBe("sentry_fallback_exception");
    expect(parsed.message).toBe("test-error-msg");
    expect(parsed.tags).toEqual({ route: "x" });
  });

  it("captureMessage も stderr フォールバック", async () => {
    let captured: string | null = null;
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      const s = (chunk as Buffer | string).toString();
      if (s.includes("sentry_fallback_message")) captured = s;
      return true;
    });

    const { captureMessage } = await import("./sentry");
    captureMessage("hello", { level: "warning" });
    await new Promise((r) => setTimeout(r, 10));
    expect(captured).not.toBeNull();
    const parsed = JSON.parse(captured!);
    expect(parsed.msg).toBe("hello");
    expect(parsed.level).toBe("warning");
  });

  it("setSentryUser は no-op で例外を投げない (DSN 未設定)", async () => {
    const { setSentryUser } = await import("./sentry");
    expect(() => setSentryUser({ id: "u1" })).not.toThrow();
    expect(() => setSentryUser(null)).not.toThrow();
  });
});
