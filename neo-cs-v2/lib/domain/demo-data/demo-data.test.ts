import { describe, it, expect } from "vitest";
import {
  filterDemoByRange,
  canExecuteWipe,
  pickDemoCompanies,
  formatDemoCountsForDisplay,
  DEMO_WIPE_CONFIRM_TOKEN,
  ZERO_DEMO_COUNTS
} from "./demo-data";
import type { Company } from "@/lib/repository/types";

const NOW = new Date("2026-05-03T12:00:00Z");

describe("filterDemoByRange", () => {
  const sample = [
    { id: "a", createdAt: "2026-05-03T11:00:00Z" }, // 1h前
    { id: "b", createdAt: "2026-05-02T12:00:00Z" }, // 24h前
    { id: "c", createdAt: "2026-04-29T12:00:00Z" }, // 4日前
    { id: "d", createdAt: "2026-04-01T12:00:00Z" }, // 1ヶ月前
    { id: "e", createdAt: undefined }
  ];

  it("24h で直近24h以内のみ返す", () => {
    const out = filterDemoByRange(sample, "24h", NOW);
    expect(out.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("7d で直近7日以内のみ返す", () => {
    const out = filterDemoByRange(sample, "7d", NOW);
    expect(out.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("all で createdAt 不明含めて全部返す", () => {
    const out = filterDemoByRange(sample, "all", NOW);
    expect(out).toHaveLength(5);
  });
});

describe("canExecuteWipe", () => {
  it("確認トークン不一致で reject", () => {
    const r = canExecuteWipe({ confirmInput: "wrong", selectedCount: 5 });
    expect(r.ok).toBe(false);
  });

  it("0件で reject", () => {
    const r = canExecuteWipe({ confirmInput: DEMO_WIPE_CONFIRM_TOKEN, selectedCount: 0 });
    expect(r.ok).toBe(false);
  });

  it("hardLimit 超過で reject", () => {
    const r = canExecuteWipe({
      confirmInput: DEMO_WIPE_CONFIRM_TOKEN,
      selectedCount: 999,
      hardLimit: 100
    });
    expect(r.ok).toBe(false);
  });

  it("正常系で ok", () => {
    const r = canExecuteWipe({ confirmInput: DEMO_WIPE_CONFIRM_TOKEN, selectedCount: 18 });
    expect(r.ok).toBe(true);
  });

  it("前後空白を許容する", () => {
    const r = canExecuteWipe({
      confirmInput: "  DELETE-DEMO  ",
      selectedCount: 1
    });
    expect(r.ok).toBe(true);
  });
});

describe("pickDemoCompanies", () => {
  const c = (id: string, isDemo: boolean | undefined): Company => ({
    id,
    organizationId: "o1",
    name: id,
    kana: "",
    industry: "",
    address: "",
    ownerName: "",
    contracts: [],
    mrr: 0,
    lastTouchDays: 0,
    isDemo
  });

  it("isDemo=true のみ返す", () => {
    const out = pickDemoCompanies([c("a", true), c("b", false), c("c", undefined), c("d", true)]);
    expect(out.map((x) => x.id)).toEqual(["a", "d"]);
  });
});

describe("formatDemoCountsForDisplay", () => {
  it("8カテゴリ全部含む", () => {
    const arr = formatDemoCountsForDisplay({ ...ZERO_DEMO_COUNTS, companies: 18, contracts: 30 });
    expect(arr).toHaveLength(8);
    expect(arr[0]).toEqual({ label: "企業", value: 18 });
    expect(arr[1]).toEqual({ label: "契約", value: 30 });
  });
});
