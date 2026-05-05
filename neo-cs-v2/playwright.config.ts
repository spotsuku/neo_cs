// Playwright E2E 設定
//
// 実行前に: `npx playwright install chromium`（初回のみ）
// 実行: `npm run test:e2e` または `npx playwright test`
//
// dev サーバー (`npm run dev`) を別ターミナルで起動しておくこと。
// CI では webServer 起動を有効化する想定。

import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    locale: "ja-JP"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
  // CI 用: webServer: { command: "npm run dev", url: BASE_URL, reuseExistingServer: !process.env.CI }
});
