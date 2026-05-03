// Vitest 共通セットアップ
// - server-only ガードを no-op 化 (Vitest は SSR 環境ではない)
// - 環境変数の最低デフォルト
// - process.stderr.write の抑制 (各テストで必要なら spyOn する)

import { vi } from "vitest";

vi.mock("server-only", () => ({}));

// NODE_ENV は @types/node 22+ で readonly のため index アクセスで回避
const env = process.env as Record<string, string | undefined>;
env.NODE_ENV ??= "test";
env.LOG_LEVEL ??= "fatal"; // テスト中は logger 出力を抑制
env.ALLOWED_ORIGINS ??= "http://localhost:3000,https://cs.neoacademia.jp";
