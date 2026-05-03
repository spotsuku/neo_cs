import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  acquireDedup,
  releaseDedup,
  cleanupExpiredDedup,
  memoryDedup,
  resetMemoryDedupForTesting
} from "./dedup";

beforeEach(() => {
  resetMemoryDedupForTesting();
  delete process.env.NOTIFICATION_DEDUP_DRIVER;
});

describe("memoryDedup", () => {
  it("初回 acquire は true、2回目は false", async () => {
    expect(await memoryDedup.acquire({ channel: "test", key: "k1" })).toBe(true);
    expect(await memoryDedup.acquire({ channel: "test", key: "k1" })).toBe(false);
  });

  it("release で同 key を再 acquire できる", async () => {
    await memoryDedup.acquire({ channel: "test", key: "k2" });
    await memoryDedup.release("test", "k2");
    expect(await memoryDedup.acquire({ channel: "test", key: "k2" })).toBe(true);
  });

  it("channel が違えば独立", async () => {
    expect(await memoryDedup.acquire({ channel: "a", key: "k" })).toBe(true);
    expect(await memoryDedup.acquire({ channel: "b", key: "k" })).toBe(true);
  });

  it("ttlSec を超えると再 acquire 可", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      expect(await memoryDedup.acquire({ channel: "t", key: "k", ttlSec: 60 })).toBe(true);
      vi.setSystemTime(new Date("2026-01-01T00:00:30Z"));
      expect(await memoryDedup.acquire({ channel: "t", key: "k", ttlSec: 60 })).toBe(false);
      vi.setSystemTime(new Date("2026-01-01T00:01:01Z"));
      expect(await memoryDedup.acquire({ channel: "t", key: "k", ttlSec: 60 })).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cleanup() は期限切れ件数を返す", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      await memoryDedup.acquire({ channel: "x", key: "1", ttlSec: 60 });
      await memoryDedup.acquire({ channel: "x", key: "2", ttlSec: 7200 });
      vi.setSystemTime(new Date("2026-01-01T00:30:00Z"));
      const n = await memoryDedup.cleanup();
      expect(n).toBe(1); // k1 だけが期限切れ
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("acquireDedup ファサード", () => {
  it("driver=memory (デフォルト) で memoryDedup を使う", async () => {
    expect(await acquireDedup({ channel: "f", key: "k1" })).toBe(true);
    expect(await acquireDedup({ channel: "f", key: "k1" })).toBe(false);
  });

  it("driver=supabase + Supabase 未配線 (env無し) なら fail-open", async () => {
    process.env.NOTIFICATION_DEDUP_DRIVER = "supabase";
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    // 未配線でも通知させる (fail-open)
    expect(await acquireDedup({ channel: "x", key: "y" })).toBe(true);
    expect(await acquireDedup({ channel: "x", key: "y" })).toBe(true); // 毎回 true (永続化されない)
  });
});

describe("cleanupExpiredDedup ファサード", () => {
  it("driver=memory なら memory cleanup を呼ぶ", async () => {
    process.env.NOTIFICATION_DEDUP_DRIVER = "memory";
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      await acquireDedup({ channel: "z", key: "1", ttlSec: 1 });
      vi.setSystemTime(new Date("2026-01-01T00:00:10Z"));
      const n = await cleanupExpiredDedup();
      expect(n).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
