// RLS テスト: external ユーザーのアクセス制限
//
// 前提:
//   - ローカル supabase が起動中（http://localhost:54321）
//   - 0001 〜 0024 のマイグレーションが適用済
//   - 以下のシードがある:
//       admin@example.com (admin)
//       manager@example.com (manager)
//       external1@example.com (external) — 企業 c-1 にのみアクセス可
//   - 環境変数 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY
//
// シード未投入時はテストをスキップする。CI でのみ実行する想定。

import { describe, it, expect, beforeAll } from "vitest";
import { asUser } from "./simulator";

const RLS_ENABLED =
  !!process.env.SUPABASE_URL &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
  !!process.env.SUPABASE_ANON_KEY;

const skipIfNoEnv = RLS_ENABLED ? describe : describe.skip;

skipIfNoEnv("RLS: external ユーザー", () => {
  let externalSb: Awaited<ReturnType<typeof asUser>>;

  beforeAll(async () => {
    externalSb = await asUser("external1@example.com");
  });

  it("companies は user_company_access の企業のみ見える", async () => {
    const { data, error } = await externalSb.from("companies").select("id");
    expect(error).toBeNull();
    // c-1 のみ見える前提
    expect(data?.map((r) => r.id)).toContain("c-1");
    expect(data?.length).toBe(1);
  });

  it("audit_logs は 0 行（external_lockdown により拒否）", async () => {
    const { data, error } = await externalSb.from("audit_logs").select("id");
    // RLS で 0 行返る（error にはならない）
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("kpi_snapshots は 0 行", async () => {
    const { data } = await externalSb.from("kpi_snapshots").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("program_terms は 0 行", async () => {
    const { data } = await externalSb.from("program_terms").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("company_tasks: アクセス可能企業の行は見える", async () => {
    const { data } = await externalSb
      .from("company_tasks")
      .select("id, company_id");
    expect(data?.every((r) => r.company_id === "c-1")).toBe(true);
  });

  it("weekly_reviews: 自分のアクセス可能企業のみ update 可", async () => {
    // c-1 の既存レビューを update（成功するはず）
    const { error: errOk } = await externalSb
      .from("weekly_reviews")
      .update({ summary: "external 更新テスト" })
      .eq("company_id", "c-1")
      .limit(1);
    expect(errOk).toBeNull();

    // c-2（アクセス無し）への update は 0 行（影響なし）
    const { data, error: errNg } = await externalSb
      .from("weekly_reviews")
      .update({ summary: "should not pass" })
      .eq("company_id", "c-2")
      .select();
    expect(errNg).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("user_company_access の書込みは admin のみ（external は拒否）", async () => {
    const { error } = await externalSb
      .from("user_company_access")
      .insert({ user_id: "x", company_id: "c-2", organization_id: "x" });
    // RLS で拒否
    expect(error).not.toBeNull();
  });
});
