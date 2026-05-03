import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // ブランドカラー（ロゴのグラデーションから抽出、ポイント使用のみ）
        brand: {
          pink: "#FF3D8A",
          orange: "#FF9838",
          yellow: "#FFD93D",
          green: "#4CD97B",
          blue: "#3D9EFF",
          purple: "#8B5CF6"
        },
        // 研修ごとのアクセント（抑えめ）
        product: {
          academia: "#3D9EFF",
          hyogikai: "#8B5CF6",
          aiken: "#4CD97B",
          commu: "#FF9838"
        },
        ink: {
          900: "#0E0F12",
          700: "#2B2D33",
          500: "#6B7079",
          300: "#C4C7CD",
          100: "#EEF0F3",
          50: "#F7F8FA"
        },
        // semantic tokens（新規・推奨）
        // 新規コードはこちらを使う。brand/product/ink はブランド表現/研修色/ベース文字色専用に縮退。
        success: { 50: "#ECFDF5", 100: "#D1FAE5", 500: "#10B981", 600: "#059669", 700: "#047857" },
        warning: { 50: "#FFFBEB", 100: "#FEF3C7", 500: "#F59E0B", 600: "#D97706", 700: "#B45309" },
        danger:  { 50: "#FEF2F2", 100: "#FEE2E2", 500: "#EF4444", 600: "#DC2626", 700: "#B91C1C" },
        info:    { 50: "#EFF6FF", 100: "#DBEAFE", 500: "#3B82F6", 600: "#2563EB", 700: "#1D4ED8" },
        neutral: {
          50: "#F7F8FA", 100: "#EEF0F3", 300: "#C4C7CD",
          500: "#6B7079", 700: "#2B2D33", 900: "#0E0F12"
        },
        surface: { DEFAULT: "#FFFFFF", muted: "#F7F8FA", inverse: "#0E0F12" },
        // border は Tailwind 標準 utility と衝突するので borderc に退避
        borderc: { DEFAULT: "#EEF0F3", strong: "#C4C7CD" },
        focusring: "#3D9EFF"
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Hiragino Sans"',
          '"Noto Sans JP"',
          "sans-serif"
        ]
      },
      fontSize: {
        // タイポグラフィ階層（最小12px）
        // 11px以下は段階的撲滅対象。新規コードでは下記のみ使用。
        caption: ["12px", { lineHeight: "1.5" }],
        body:    ["14px", { lineHeight: "1.6" }],
        bodyLg:  ["15px", { lineHeight: "1.6" }],
        h4:      ["16px", { lineHeight: "1.4", letterSpacing: "-0.005em" }],
        h3:      ["18px", { lineHeight: "1.4", letterSpacing: "-0.01em" }],
        h2:      ["20px", { lineHeight: "1.3", letterSpacing: "-0.01em" }],
        h1:      ["24px", { lineHeight: "1.25", letterSpacing: "-0.015em" }],
        metric:  ["28px", { lineHeight: "1.1", letterSpacing: "-0.02em" }]
      },
      borderRadius: {
        // 角丸の標準セット。新規は sm/md/lg/xl/surface/pill のみ使う。
        // 旧 liquid (1.25rem=20px) は surface に統合。互換のため liquid も残置。
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        surface: "20px",
        pill: "9999px",
        liquid: "1.25rem"
      },
      boxShadow: {
        // 新規: card/cardHover を推奨。liquid/liquid-lg は互換のため残置。
        card:      "0 1px 2px rgba(14,15,18,0.04), 0 8px 24px rgba(14,15,18,0.06)",
        cardHover: "0 2px 4px rgba(14,15,18,0.04), 0 16px 40px rgba(14,15,18,0.08)",
        liquid:    "0 1px 2px rgba(14,15,18,0.04), 0 8px 24px rgba(14,15,18,0.06)",
        "liquid-lg": "0 2px 4px rgba(14,15,18,0.04), 0 16px 40px rgba(14,15,18,0.08)"
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, #4CD97B 0%, #3D9EFF 25%, #8B5CF6 50%, #FF3D8A 75%, #FF9838 100%)"
      }
    }
  },
  plugins: []
};

export default config;
