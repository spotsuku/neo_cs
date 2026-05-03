import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// 注: Next.js の build/dev とは独立。tsconfig.json を継承する代わりに
// alias を明示する。テスト実行は `npm test`。
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": resolve(__dirname, ".") }
  },
  test: {
    environment: "node",
    globals: true,
    include: ["lib/**/*.test.{ts,tsx}", "app/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.next/**"],
    setupFiles: ["tests/setup.ts"],
    testTimeout: 10_000,
    coverage: {
      provider: "v8",
      include: ["lib/domain/**", "lib/security/**", "lib/notifications/**", "lib/repository/**"],
      exclude: ["**/*.d.ts", "**/*.test.ts", "lib/repository/supabase/**"]
    }
  }
});
