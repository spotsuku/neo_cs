// ESLint flat config (Next.js 16 / ESLint 9)
//
// 方針:
// - eslint-config-next の core-web-vitals + jsx-a11y を導入
// - 既存違反は warn にして段階対応 (build を止めない)
// - raw hex (#xxxxxx) と text-[10|11px] を warn で検出 (P1で撲滅)
//
import next from "eslint-config-next";

export default [
  ...next,
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"]
  },
  {
    // クライアントコンポーネント (app/, components/) で `@/lib/mock/*` から
    // **値** (オブジェクト・配列・関数) を import するのを禁止する。
    // 型 import (`import type {...}`) は OK。
    //
    // 背景: 本番 (REPO_DRIVER=supabase) でも mock データが画面に表示される
    // 不具合の再発を防止する。データは Server Component で repo から fetch して
    // props 経由で渡すこと。
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    ignores: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["@/lib/mock/*"],
              importNames: [
                "companies", "onboardingTasks", "activeContracts", "allContracts",
                "contractOnboardingItems", "seedCompanyJourneys", "seedBusinessJourneys",
                "weeklyReviews", "emailThreads", "emailMessages",
                "surveys", "surveyInsights", "surveySchedules", "surveyResponses",
                "participants", "sessions", "attendanceRecords",
                "churnRecords", "vocItems",
                "mockHealthSnapshots", "mockChurnSignals", "mockExpansionOpportunities"
              ],
              message: "クライアント側で @/lib/mock/* のデータ values を import しないでください。Server Component で `@/lib/repository/server` から fetch して props で渡すこと。"
            }
          ]
        }
      ]
    }
  },
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    rules: {
      // a11y は段階対応のため warn に統一
      "jsx-a11y/label-has-associated-control": "warn",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/no-noninteractive-element-interactions": "warn",
      "jsx-a11y/anchor-is-valid": "warn",

      // raw hex と過小フォントの段階撲滅
      "no-restricted-syntax": [
        "warn",
        {
          // className に hex を直書き: text-[#abc] / bg-[#abc] / border-[#abc] など
          selector: "JSXAttribute[name.name='className'] Literal[value=/\\[#[0-9a-fA-F]{3,8}\\]/]",
          message: "raw hex を className に直書きしないこと。tailwind.config.ts の semantic token (success/warning/danger/info/neutral/brand/product) を使う。"
        },
        {
          selector: "JSXAttribute[name.name='className'] TemplateElement[value.raw=/\\[#[0-9a-fA-F]{3,8}\\]/]",
          message: "raw hex を className に直書きしないこと。semantic token を使う。"
        },
        {
          // text-[10px] / text-[11px] / text-[9px] / text-[12px]
          selector: "JSXAttribute[name.name='className'] Literal[value=/text-\\[(9|1[012])px\\]/]",
          message: "11px以下のフォントサイズは禁止。最小は text-caption (12px)、本文は text-body (14px) を使う。"
        },
        {
          selector: "JSXAttribute[name.name='className'] TemplateElement[value.raw=/text-\\[(9|1[012])px\\]/]",
          message: "11px以下のフォントサイズは禁止。text-caption / text-body を使う。"
        }
      ]
    }
  }
];
