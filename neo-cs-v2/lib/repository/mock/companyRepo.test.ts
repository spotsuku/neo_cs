import { describe, it, expect } from "vitest";
import { mockCompanyRepo } from "./companyRepo";

describe("mockCompanyRepo — round-trip", () => {
  it("list は seed を含む", async () => {
    const all = await mockCompanyRepo.list();
    expect(all.length).toBeGreaterThan(0);
  });

  it("getById で取得 → update → 反映", async () => {
    const all = await mockCompanyRepo.list();
    const first = all[0];
    const updated = await mockCompanyRepo.update(first.id, { name: first.name + " (改)" });
    expect(updated.name).toBe(first.name + " (改)");
    const reread = await mockCompanyRepo.getById(first.id);
    expect(reread?.name).toBe(first.name + " (改)");
    // 復元 (テスト分離)
    await mockCompanyRepo.update(first.id, { name: first.name });
  });

  it("filter.search は name / kana 部分一致", async () => {
    const all = await mockCompanyRepo.list();
    const target = all[0];
    const hits = await mockCompanyRepo.list({ search: target.name.slice(0, 2) });
    expect(hits.find((c) => c.id === target.id)).toBeDefined();
  });

  it("create で新規 → list に出現 → 削除", async () => {
    const before = await mockCompanyRepo.list();
    const created = await mockCompanyRepo.create({
      name: "テスト企業",
      kana: "テストキギョウ",
      industry: "test",
      address: "東京",
      ownerName: "test",
      contracts: [],
      mrr: 0,
      lastTouchDays: 0,
      memo: ""
    });
    const after = await mockCompanyRepo.list();
    expect(after.length).toBe(before.length + 1);
    expect(created.id).toBeDefined();
  });
});
