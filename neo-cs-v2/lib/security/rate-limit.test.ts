import { describe, it, expect, beforeEach } from "vitest";
import { consume } from "./rate-limit";

// memory フォールバックで動かす (Supabase 接続なし)
beforeEach(() => {
  process.env.RATE_LIMIT_DRIVER = "memory";
});

describe("consume — Token Bucket (memory フォールバック)", () => {
  it("capacity分は連続消費可", async () => {
    const cfg = { capacity: 3, refillPerSec: 1 };
    const key = `test-${Math.random()}`;
    expect((await consume(key, cfg)).allowed).toBe(true);
    expect((await consume(key, cfg)).allowed).toBe(true);
    expect((await consume(key, cfg)).allowed).toBe(true);
    const r = await consume(key, cfg);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterSec).toBeGreaterThan(0);
  });

  it("キー別にバケット独立", async () => {
    const cfg = { capacity: 1, refillPerSec: 0.1 };
    expect((await consume(`a-${Math.random()}`, cfg)).allowed).toBe(true);
    expect((await consume(`b-${Math.random()}`, cfg)).allowed).toBe(true);
  });

  it("拒否時の remaining は 0", async () => {
    const cfg = { capacity: 1, refillPerSec: 0.01 };
    const k = `c-${Math.random()}`;
    await consume(k, cfg);
    const r = await consume(k, cfg);
    expect(r.remaining).toBe(0);
  });
});
