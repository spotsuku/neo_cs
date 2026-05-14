import { describe, it, expect } from "vitest";
import {
  computeResponseRecords,
  summarizeMetrics,
  humanizeMinutes,
  type EmailEventForMetrics
} from "./email-metrics";

describe("computeResponseRecords", () => {
  it("inbound → outbound のペアを 1:1 で紐付ける", () => {
    const events: EmailEventForMetrics[] = [
      { id: "m1", threadId: "t1", direction: "inbound", sentAt: "2026-04-01T10:00:00Z" },
      { id: "m2", threadId: "t1", direction: "outbound", sentAt: "2026-04-01T11:30:00Z" }
    ];
    const records = computeResponseRecords(events);
    expect(records).toHaveLength(1);
    expect(records[0].responseMinutes).toBe(90);
    expect(records[0].outboundId).toBe("m2");
  });

  it("未応答 inbound は responseMinutes=null", () => {
    const events: EmailEventForMetrics[] = [
      { id: "m1", threadId: "t1", direction: "inbound", sentAt: "2026-04-01T10:00:00Z" }
    ];
    const records = computeResponseRecords(events);
    expect(records[0].responseMinutes).toBeNull();
    expect(records[0].outboundId).toBeNull();
  });

  it("複数の inbound に対し、それぞれ次の outbound を紐付ける", () => {
    const events: EmailEventForMetrics[] = [
      { id: "i1", threadId: "t1", direction: "inbound", sentAt: "2026-04-01T10:00:00Z" },
      { id: "o1", threadId: "t1", direction: "outbound", sentAt: "2026-04-01T10:30:00Z" },
      { id: "i2", threadId: "t1", direction: "inbound", sentAt: "2026-04-02T09:00:00Z" },
      { id: "o2", threadId: "t1", direction: "outbound", sentAt: "2026-04-02T09:15:00Z" }
    ];
    const records = computeResponseRecords(events);
    expect(records.map((r) => r.responseMinutes)).toEqual([30, 15]);
  });

  it("スレッドを跨いで紐付けない", () => {
    const events: EmailEventForMetrics[] = [
      { id: "a", threadId: "t1", direction: "inbound", sentAt: "2026-04-01T10:00:00Z" },
      { id: "b", threadId: "t2", direction: "outbound", sentAt: "2026-04-01T11:00:00Z" }
    ];
    const records = computeResponseRecords(events);
    expect(records).toHaveLength(1);
    expect(records[0].responseMinutes).toBeNull();
  });
});

describe("summarizeMetrics", () => {
  it("空の records は all null", () => {
    expect(summarizeMetrics([])).toEqual({
      totalInbound: 0,
      responded: 0,
      unresponded: 0,
      medianMinutes: null,
      p95Minutes: null,
      within24hRate: null
    });
  });

  it("中央値 / within24h を計算する", () => {
    const events: EmailEventForMetrics[] = [
      // 30 分
      { id: "i1", threadId: "t1", direction: "inbound", sentAt: "2026-04-01T10:00:00Z" },
      { id: "o1", threadId: "t1", direction: "outbound", sentAt: "2026-04-01T10:30:00Z" },
      // 60 分
      { id: "i2", threadId: "t2", direction: "inbound", sentAt: "2026-04-02T10:00:00Z" },
      { id: "o2", threadId: "t2", direction: "outbound", sentAt: "2026-04-02T11:00:00Z" },
      // 25h (=1500m, 24h 超)
      { id: "i3", threadId: "t3", direction: "inbound", sentAt: "2026-04-03T10:00:00Z" },
      { id: "o3", threadId: "t3", direction: "outbound", sentAt: "2026-04-04T11:00:00Z" }
    ];
    const records = computeResponseRecords(events);
    const s = summarizeMetrics(records);
    expect(s.totalInbound).toBe(3);
    expect(s.responded).toBe(3);
    expect(s.unresponded).toBe(0);
    // 中央値は 60 分
    expect(s.medianMinutes).toBe(60);
    // 24h 以内: 2 / 3
    expect(s.within24hRate).toBeCloseTo(2 / 3, 5);
  });
});

describe("humanizeMinutes", () => {
  it("null は '—'", () => expect(humanizeMinutes(null)).toBe("—"));
  it("分のみ", () => expect(humanizeMinutes(45)).toBe("45分"));
  it("時間+分", () => expect(humanizeMinutes(125)).toBe("2時間5分"));
  it("時間のみ (分=0)", () => expect(humanizeMinutes(180)).toBe("3時間"));
  it("日+時間", () => expect(humanizeMinutes(1500)).toBe("1日1時間"));
});
