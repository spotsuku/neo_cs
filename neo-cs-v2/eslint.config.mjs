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
    // app / components 配下から `@/lib/mock/*` への import を全面禁止 (error)。
    // 型 import (`import type {...}`) は許可。
    //
    // 背景:
    //   - 本番 (REPO_DRIVER=supabase) で lib/mock/ は参照されないため、ここを
    //     編集しても何も達成しない。並行会話での誤編集事故を構造的に防ぐ。
    //   - マスタ系・utility は lib/master/ に分離済 (commit 6e05a15)
    //   - 実データは @/lib/repository/server 経由
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    ignores: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/mock/*", "@/lib/mock"],
              allowTypeImports: true,
              message:
                "@/lib/mock/* からの値 import は禁止です。マスタは @/lib/master/* から、実データは @/lib/repository/server から取得してください。"
            }
          ]
        }
      ]
    }
  },
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    rules: {
      // React Compiler の bailout 系は段階対応のため warn (本来は fix すべき)
      //   - set-state-in-effect: useEffect 内の同期 setState
      //   - purity: render 中の不純関数呼び出し
      //   - set-state-in-render: render 中の setState
      // これらは将来的に React Compiler の自動最適化を阻害する。
      // 既存 ExecutiveDashboard.tsx / CompanyDetail.tsx / MatrixView.tsx に集中。
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/set-state-in-render": "warn",
      "react-hooks/purity": "warn",

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
