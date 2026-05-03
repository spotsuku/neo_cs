import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fetchHard } from "./http";

const origFetch = global.fetch;
afterEach(() => {
  global.fetch = origFetch;
  vi.useRealTimers();
});

describe("fetchHard", () => {
  it("成功時は 1 attempt で response 返す", async () => {
    global.fetch = vi.fn(async () => new Response("ok", { status: 200 })) as typeof fetch;
    const r = await fetchHard("https://x.test/1");
    expect(r.attempts).toBe(1);
    expect(r.response.status).toBe(200);
  });

  it("5xx は idempotent (GET) でリトライ", async () => {
    let n = 0;
    global.fetch = vi.fn(async () => {
      n++;
      return new Response("x", { status: n < 2 ? 500 : 200 });
    }) as typeof fetch;
    const r = await fetchHard("https://x.test/2", { retries: 2 });
    expect(r.attempts).toBe(2);
    expect(r.response.status).toBe(200);
  });

  it("POST は既定でリトライしない (非idempotent)", async () => {
    let n = 0;
    global.fetch = vi.fn(async () => {
      n++;
      return new Response("x", { status: 500 });
    }) as typeof fetch;
    const r = await fetchHard("https://x.test/3", { method: "POST", retries: 2 });
    expect(r.attempts).toBe(1);
    expect(r.response.status).toBe(500);
  });

  it("retryNonIdempotent=true なら POST でもリトライ", async () => {
    let n = 0;
    global.fetch = vi.fn(async () => {
      n++;
      return new Response("x", { status: n < 2 ? 503 : 200 });
    }) as typeof fetch;
    const r = await fetchHard("https://x.test/4", {
      method: "POST",
      retries: 2,
      retryNonIdempotent: true
    });
    expect(r.attempts).toBe(2);
    expect(r.response.status).toBe(200);
  });

  it("timeoutMs を超えたら AbortError", async () => {
    global.fetch = vi.fn(
      (_u, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError"))
          );
        })
    ) as typeof fetch;
    await expect(fetchHard("https://x.test/5", { timeoutMs: 50, retries: 0 })).rejects.toThrow(
      /Aborted/
    );
  });

  it("外部 AbortSignal で即停止", async () => {
    const ac = new AbortController();
    global.fetch = vi.fn(
      (_u, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError"))
          );
        })
    ) as typeof fetch;
    setTimeout(() => ac.abort(), 20);
    await expect(fetchHard("https://x.test/6", { signal: ac.signal })).rejects.toThrow(/Aborted/);
  });

  it("4xx (例: 404) はリトライしない", async () => {
    let n = 0;
    global.fetch = vi.fn(async () => {
      n++;
      return new Response("x", { status: 404 });
    }) as typeof fetch;
    const r = await fetchHard("https://x.test/7", { retries: 3 });
    expect(r.attempts).toBe(1);
    expect(n).toBe(1);
  });
});
