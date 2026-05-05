// E2E: ロール別の TopNav 表示検証
//
// 仕掛け: cookie `mock_user_email` に切替えたい mock 社内ユーザーのメールを
// 入れることで、`userRepo.getCurrent()` がそのユーザーを返すようにしている
// （lib/repository/mock/userRepo.ts、NODE_ENV !== production のみ有効）。
//
// 検証内容:
//   - admin: マネージャー / 横断ナビ全て表示。Manager/Member トグルが見える
//   - manager: マネージャーリンクが表示される
//   - member: マネージャーリンクは表示されない
//   - external: マネージャー / 受信箱 / 事業ToDo 等の横断ナビが非表示
//
// 走らせる前に: `npx playwright install chromium` と `npm run dev` が必要。

import { test, expect, Page } from "@playwright/test";

async function loginAs(page: Page, email: string) {
  await page.context().addCookies([
    {
      name: "mock_user_email",
      value: email,
      url: page.url() || (await page.context().pages()[0]?.url()) || "http://localhost:3000"
    }
  ]);
}

async function gotoWithUser(page: Page, email: string, path: string) {
  // cookie 設定のため一度任意の同オリジンに行ってから cookie を当てる
  await page.goto("about:blank");
  await page.context().addCookies([
    {
      name: "mock_user_email",
      value: email,
      url: "http://localhost:3000"
    }
  ]);
  await page.goto(path);
}

test.describe("ロール別 TopNav", () => {
  test("admin はマネージャーリンクと表示モードトグルが見える", async ({ page }) => {
    await gotoWithUser(page, "k_furuno@neoacademia.jp", "/");
    await expect(page.getByRole("link", { name: "マネージャー" })).toBeVisible();
    // 表示モードトグルは aria-label="表示モード" のグループ
    await expect(page.getByRole("group", { name: "表示モード" })).toBeVisible();
  });

  test("manager はマネージャーリンクが見える / トグルは見えない", async ({ page }) => {
    await gotoWithUser(page, "miki@neoacademia.jp", "/");
    await expect(page.getByRole("link", { name: "マネージャー" })).toBeVisible();
    await expect(page.getByRole("group", { name: "表示モード" })).toHaveCount(0);
  });

  test("member はマネージャーリンクが非表示", async ({ page }) => {
    await gotoWithUser(page, "matsuda@neoacademia.jp", "/");
    await expect(page.getByRole("link", { name: "マネージャー" })).toHaveCount(0);
  });

  test("external は横断ナビ（受信箱・事業ToDo・チーム等）が非表示", async ({ page }) => {
    await gotoWithUser(page, "external-demo@example.com", "/");
    await expect(page.getByRole("link", { name: "受信箱" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "事業ToDo" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "チーム" })).toHaveCount(0);
    // ダッシュボード / 企業 / マイページ等は見える
    await expect(page.getByRole("link", { name: "企業" })).toBeVisible();
  });
});

test.describe("ページガード", () => {
  test("member は /manager にアクセスすると / へリダイレクト", async ({ page }) => {
    await gotoWithUser(page, "matsuda@neoacademia.jp", "/manager");
    await expect(page).toHaveURL(/\/$/);
  });

  test("非 admin は /settings/users にアクセスすると /settings へリダイレクト", async ({ page }) => {
    await gotoWithUser(page, "matsuda@neoacademia.jp", "/settings/users");
    await expect(page).toHaveURL(/\/settings$/);
  });
});
