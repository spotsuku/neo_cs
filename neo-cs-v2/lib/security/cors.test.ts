import { describe, it, expect, beforeEach } from "vitest";
import { corsHeaders, isOriginAllowed, preflightResponse } from "./cors";

// 注: ALLOWED_ORIGINS は tests/setup.ts で固定:
//   "http://localhost:3000,https://cs.neoacademia.jp"

describe("corsHeaders", () => {
  it("許可オリジンには Access-Control-Allow-Origin がエコー", () => {
    const h = corsHeaders("http://localhost:3000") as Record<string, string>;
    expect(h["Access-Control-Allow-Origin"]).toBe("http://localhost:3000");
    expect(h["Vary"]).toBe("Origin");
  });

  it("不許可オリジンには Vary のみ (Allow-Origin は出さない)", () => {
    const h = corsHeaders("https://evil.example.com") as Record<string, string>;
    expect(h["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(h["Vary"]).toBe("Origin");
  });

  it("origin なし (same-origin) も Vary のみ", () => {
    const h = corsHeaders(null) as Record<string, string>;
    expect(h["Access-Control-Allow-Origin"]).toBeUndefined();
  });
});

describe("isOriginAllowed", () => {
  function req(origin: string | null): Request {
    return new Request("http://localhost/x", { headers: origin ? { origin } : {} });
  }

  it("許可リスト内 → true", () => {
    expect(isOriginAllowed(req("https://cs.neoacademia.jp"))).toBe(true);
  });

  it("Origin ヘッダなし (same-origin) → true", () => {
    expect(isOriginAllowed(req(null))).toBe(true);
  });

  it("許可リスト外 → false", () => {
    expect(isOriginAllowed(req("https://evil.example.com"))).toBe(false);
  });
});

describe("preflightResponse", () => {
  it("許可オリジンは 204", async () => {
    const r = preflightResponse(
      new Request("http://localhost/x", { headers: { origin: "http://localhost:3000" } })
    );
    expect(r.status).toBe(204);
  });

  it("不許可オリジンは 403", async () => {
    const r = preflightResponse(
      new Request("http://localhost/x", { headers: { origin: "https://evil.com" } })
    );
    expect(r.status).toBe(403);
  });
});
