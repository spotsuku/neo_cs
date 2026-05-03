import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { notifySlack, notifyChurnSignal, notifyVocItem } from "./slack";

const origFetch = global.fetch;
afterEach(() => {
  global.fetch = origFetch;
  delete process.env.SLACK_WEBHOOK_URL_CS_ALERTS;
  delete process.env.SLACK_WEBHOOK_URL_CHURN_ALERTS;
  delete process.env.SLACK_WEBHOOK_URL_VOC;
});

describe("notifySlack", () => {
  it("URL 未設定なら no-op で false (stderr フォールバック)", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const ok = await notifySlack("CS_ALERTS", { text: "hi" });
    expect(ok).toBe(false);
  });

  it("URL 設定済みなら fetch 実行 → true", async () => {
    process.env.SLACK_WEBHOOK_URL_CS_ALERTS = "https://hooks.slack.test/xxx";
    global.fetch = vi.fn(async () => new Response("ok", { status: 200 })) as typeof fetch;
    const ok = await notifySlack("CS_ALERTS", { text: "hi" });
    expect(ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it("dedupKey で 24h 重複ブロック", async () => {
    process.env.SLACK_WEBHOOK_URL_CS_ALERTS = "https://hooks.slack.test/xxx";
    global.fetch = vi.fn(async () => new Response("ok", { status: 200 })) as typeof fetch;
    const key = `dedup-${Math.random()}`;

    const a = await notifySlack("CS_ALERTS", { text: "1st" }, { dedupKey: key });
    const b = await notifySlack("CS_ALERTS", { text: "2nd" }, { dedupKey: key });
    expect(a).toBe(true);
    expect(b).toBe(false); // dedup でブロック → fetch も呼ばれない
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it("チャンネルが違えば dedupKey が同じでも別判定", async () => {
    process.env.SLACK_WEBHOOK_URL_CS_ALERTS = "https://hooks.slack.test/a";
    process.env.SLACK_WEBHOOK_URL_CHURN_ALERTS = "https://hooks.slack.test/b";
    global.fetch = vi.fn(async () => new Response("ok", { status: 200 })) as typeof fetch;
    const key = `dedup-x-${Math.random()}`;

    await notifySlack("CS_ALERTS", { text: "1" }, { dedupKey: key });
    await notifySlack("CHURN_ALERTS", { text: "2" }, { dedupKey: key });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("fetch 失敗時は false (例外を呼び元に投げない)", async () => {
    process.env.SLACK_WEBHOOK_URL_CS_ALERTS = "https://hooks.slack.test/xxx";
    global.fetch = vi.fn(async () => {
      throw new Error("network");
    }) as typeof fetch;
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const ok = await notifySlack("CS_ALERTS", { text: "fail" });
    expect(ok).toBe(false);
  });
});

describe("notifyChurnSignal — ペイロード仕様", () => {
  it("Block Kit の header に severity emoji + 企業名", async () => {
    process.env.SLACK_WEBHOOK_URL_CHURN_ALERTS = "https://hooks.slack.test/churn";
    let captured: string | null = null;
    global.fetch = vi.fn(async (_u, init) => {
      captured = init?.body as string;
      return new Response("ok", { status: 200 });
    }) as typeof fetch;

    await notifyChurnSignal({
      signalId: `sid-${Math.random()}`,
      contractId: "c-1",
      companyName: "アクメ社",
      severity: "critical",
      reason: "面談2週空白 + 出席率45%",
      evidence: ["evidence-A", "evidence-B"],
      healthScore: 42,
      detectedAt: "2026-05-03T05:00:00Z",
      dashboardUrl: "https://cs.neoacademia.jp/companies/c-1",
      ownerName: "古野"
    });

    const body = JSON.parse(captured!);
    expect(body.text).toContain("解約予兆");
    expect(body.text).toContain("アクメ社");
    expect(body.blocks[0].text.text).toContain("🔴");
    expect(body.blocks[0].text.text).toContain("Critical");
    // dashboard ボタンがある
    const actions = body.blocks.find((b: { type: string }) => b.type === "actions");
    const urls = actions.elements.map((e: { url?: string }) => e.url).filter(Boolean);
    expect(urls).toContain("https://cs.neoacademia.jp/companies/c-1");
  });

  it("ownerSlackUserId があれば <@...> mention", async () => {
    process.env.SLACK_WEBHOOK_URL_CHURN_ALERTS = "https://hooks.slack.test/churn";
    let captured: string | null = null;
    global.fetch = vi.fn(async (_u, init) => {
      captured = init?.body as string;
      return new Response("ok", { status: 200 });
    }) as typeof fetch;

    await notifyChurnSignal({
      signalId: `sid2-${Math.random()}`,
      contractId: "c-2",
      companyName: "B社",
      severity: "high",
      reason: "x",
      evidence: [],
      healthScore: 50,
      detectedAt: "2026-05-03T05:00:00Z",
      dashboardUrl: "https://cs.neoacademia.jp/companies/c-2",
      ownerSlackUserId: "U12345"
    });

    const body = JSON.parse(captured!);
    const ctx = body.blocks.find((b: { type: string }) => b.type === "context");
    const mentionEl = ctx.elements.find((e: { text: string }) => e.text.includes("担当"));
    expect(mentionEl.text).toContain("<@U12345>");
  });
});

describe("notifyVocItem — ペイロード仕様", () => {
  it("Block Kit に header / 抜粋 / context / actions が揃う", async () => {
    process.env.SLACK_WEBHOOK_URL_VOC = "https://hooks.slack.test/voc";
    let captured: string | null = null;
    global.fetch = vi.fn(async (_u, init) => {
      captured = init?.body as string;
      return new Response("ok", { status: 200 });
    }) as typeof fetch;

    await notifyVocItem({
      vocItemId: `voc-${Math.random()}`,
      contractId: "c-1",
      companyName: "アクメ社",
      excerpt: "管理画面の表示が遅い",
      tags: ["UX", "パフォーマンス"],
      priority: "high",
      sourceType: "survey_response",
      detectedAt: "2026-05-03T05:00:00Z",
      dashboardUrl: "https://cs.neoacademia.jp/voc#voc-1",
      companyDashboardUrl: "https://cs.neoacademia.jp/companies/c-1",
      assignedToName: "三木",
      suggestedAction: "ダッシュボードのN+1走査を依頼"
    });

    const body = JSON.parse(captured!);
    expect(body.text).toContain("VOC");
    expect(body.text).toContain("アクメ社");
    expect(body.blocks[0].text.text).toContain("🔥");
    expect(body.blocks[0].text.text).toContain("High");
    // 抜粋が引用形式で入る
    expect(JSON.stringify(body.blocks)).toContain("管理画面の表示が遅い");
    // 担当 + ソース + タグが context に入る
    const ctx = body.blocks.find((b: { type: string }) => b.type === "context");
    const elementsText = ctx.elements.map((e: { text: string }) => e.text).join(" ");
    expect(elementsText).toContain("三木");
    expect(elementsText).toContain("アンケート");
    expect(elementsText).toContain("UX");
    // 提案セクション
    expect(JSON.stringify(body.blocks)).toContain("N+1");
    // VOCを開くボタン + 企業カルテボタン
    const actions = body.blocks.find((b: { type: string }) => b.type === "actions");
    const urls = actions.elements.map((e: { url?: string }) => e.url).filter(Boolean);
    expect(urls).toContain("https://cs.neoacademia.jp/voc#voc-1");
    expect(urls).toContain("https://cs.neoacademia.jp/companies/c-1");
  });

  it("companyDashboardUrl が無いときは VOC ボタンのみ", async () => {
    process.env.SLACK_WEBHOOK_URL_VOC = "https://hooks.slack.test/voc";
    let captured: string | null = null;
    global.fetch = vi.fn(async (_u, init) => {
      captured = init?.body as string;
      return new Response("ok", { status: 200 });
    }) as typeof fetch;

    await notifyVocItem({
      vocItemId: `voc-no-co-${Math.random()}`,
      companyName: "—",
      excerpt: "x",
      tags: [],
      priority: "med",
      sourceType: "weekly_review",
      detectedAt: "2026-05-03T05:00:00Z",
      dashboardUrl: "https://cs.neoacademia.jp/voc#x"
    });

    const body = JSON.parse(captured!);
    const actions = body.blocks.find((b: { type: string }) => b.type === "actions");
    expect(actions.elements).toHaveLength(1);
    expect(actions.elements[0].text.text).toContain("VOC を開く");
  });
});
