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
        }
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
      borderRadius: {
        liquid: "1.25rem"
      },
      boxShadow: {
        liquid: "0 1px 2px rgba(14,15,18,0.04), 0 8px 24px rgba(14,15,18,0.06)",
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
