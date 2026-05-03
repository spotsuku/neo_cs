import { describe, it, expect } from "vitest";
import { consume } from "./rate-limit";

describe("consume — Token Bucket", () => {
  it("capacity分は連続消費可", () => {
    const cfg = { capacity: 3, refillPerSec: 1 };
    const key = `test-${Math.random()}`;
    expect(consume(key, cfg).allowed).toBe(true);
    expect(consume(key, cfg).allowed).toBe(true);
    expect(consume(key, cfg).allowed).toBe(true);
    const r = consume(key, cfg);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterSec).toBeGreaterThan(0);
  });

  it("キー別にバケット独立", () => {
    const cfg = { capacity: 1, refillPerSec: 0.1 };
    expect(consume(`a-${Math.random()}`, cfg).allowed).toBe(true);
    expect(consume(`b-${Math.random()}`, cfg).allowed).toBe(true);
  });

  it("拒否時の remaining は 0", () => {
    const cfg = { capacity: 1, refillPerSec: 0.01 };
    const k = `c-${Math.random()}`;
    consume(k, cfg);
    const r = consume(k, cfg);
    expect(r.remaining).toBe(0);
  });
});
