import { describe, it, expect } from "vitest";
import { mockCompanyRepo } from "./companyRepo";

// /companies フィルタ動作 (mock driver) のテスト。
// CompanyFilter.isDemo の通過 / 反転を確認する。
describe("mockCompanyRepo: isDemo フィルタ", () => {
  it("isDemo=true で seed (=全部 demo) を返す", async () => {
    const onlyDemo = await mockCompanyRepo.list({ isDemo: true });
    const all = await mockCompanyRepo.list();
    expect(onlyDemo.length).toBe(all.length);
    expect(onlyDemo.every((c) => (c.isDemo ?? true) === true)).toBe(true);
  });

  it("isDemo=false で 0件 (seedは全てdemo扱い)", async () => {
    const list = await mockCompanyRepo.list({ isDemo: false });
    expect(list).toHaveLength(0);
  });

  it("countDemo は list と一致する", async () => {
    const c = await mockCompanyRepo.countDemo();
    const l = await mockCompanyRepo.listDemo({ range: "all" });
    expect(c).toBe(l.length);
  });

  it("create で isDemo=false を指定した企業はフィルタで除外される", async () => {
    const created = await mockCompanyRepo.create({
      name: "テスト本番企業",
      kana: "てすとほんばん",
      industry: "IT",
      address: "",
      ownerName: "古野",
      contracts: [],
      mrr: 0,
      lastTouchDays: 0,
      isDemo: false
    });
    try {
      const onlyProd = await mockCompanyRepo.list({ isDemo: false });
      expect(onlyProd.some((c) => c.id === created.id)).toBe(true);
      const onlyDemo = await mockCompanyRepo.list({ isDemo: true });
      expect(onlyDemo.some((c) => c.id === created.id)).toBe(false);
    } finally {
      await mockCompanyRepo.delete(created.id);
    }
  });

  it("wipeDemoData は demo 件数を 0 に近づけ、deletedIds を返す", async () => {
    // 安全のため一時企業のみ delete をテスト (seed は他テストが依存)
    const created = await mockCompanyRepo.create({
      name: "wipe-target",
      kana: "",
      industry: "",
      address: "",
      ownerName: "",
      contracts: [],
      mrr: 0,
      lastTouchDays: 0,
      isDemo: true
    });
    const before = await mockCompanyRepo.countDemo();
    expect(before).toBeGreaterThan(0);
    // range=24h で直近作成のみ削除
    const result = await mockCompanyRepo.wipeDemoData({ range: "24h" });
    expect(result.deletedCompanies).toBeGreaterThan(0);
    expect(result.deletedIds).toContain(created.id);
  });
});
