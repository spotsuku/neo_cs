# ARCHITECTURE — NEO CS ポータル

> 「**なぜこの構造なのか / どこで何が起きるのか**」を一枚で示す。新規参画者と並行作業中の別会話 (Claude) が最初に読むべきドキュメント。

---

## 1. 技術スタック

| 層 | 採用 | 理由 |
|---|---|---|
| FW | Next.js 16 (App Router, React 19) | Server Components + Server Actions で BFF 不要 |
| DB / Auth | Supabase (Postgres + RLS + Auth) | RLS によるマルチテナント、Google OAuth 同梱 |
| LLM | Anthropic Claude API | メール解析・AI 抽出 |
| 外部連携 | Gmail API (googleapis) | 受信同期・下書き/送信 |
| 通知 | Slack Incoming Webhook | TBD |
| Style | Tailwind 3 + shadcn-style components | デザイントークン正本は [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) |
| テスト | Vitest (unit) / Playwright (e2e) / `tests/rls` (RLS) | |
| デプロイ | Vercel | |

---

## 2. ディレクトリ構成 (実体)

```
neo_cs/
├── neo-cs-v2/              ← アプリ本体 (Next.js)
│   ├── app/                App Router (Route Groups で 8 機能ドメイン化 — URL 不変)
│   │   ├── (lifecycle)/      onboarding                       F1 内諾後フロー
│   │   ├── (cohort)/         programs / weekly / attendance   F2 期/回運営
│   │   ├── (communication)/  inbox / notifications / chat     F3 メール+AI
│   │   ├── (relationship)/   companies / voc                  F5/F6 関係性
│   │   ├── (analytics)/      dashboard / reports / surveys    F7+経営
│   │   ├── (self)/           me / tasks / profile             個人
│   │   ├── (admin)/          settings / manager / help        管理
│   │   ├── (system)/         auth / login / styleguide        認証/UI
│   │   └── api/              Route Handler
│   ├── components/         UI 部品 (12 ドメインサブフォルダ)
│   ├── lib/
│   │   ├── repository/     Domain 型 + Repository インターフェース + 2 実装
│   │   ├── domain/         純粋関数 (community / health / churn / kpi / email / voc / journey / ...)
│   │   ├── supabase/       Supabase クライアント (SSR / service_role)
│   │   ├── security/       認可・CSP・CORS・rate-limit
│   │   ├── observability/  pino logger / Sentry / repo hook
│   │   ├── notifications/  Slack
│   │   ├── integrations/   Gmail
│   │   ├── ai/             Claude API ラッパ
│   │   └── mock/           in-memory データ (Repository 非経由)
│   ├── tests/
│   ├── scripts/
│   └── supabase/migrations 以外の app 設定
├── supabase/migrations/    DB マイグレーション (番号順)
├── docs/                   このフォルダ (Phase 0 で整備中)
├── roadmap/                旧ロードマップ・完了報告 (履歴扱い)
└── reviews/                16 視点レビュー (実装の根拠ログ)

# 旧 v1 (_legacy/) は archive/v1-legacy ブランチに退避済 (tag: baseline-2026-05-14)
```

ルートの `package.json` は v2 への薄いラッパ。実体は `neo-cs-v2/`。

---

## 3. Repository 層 — 最重要な設計判断

### 3.1 二系統の実装

| 実装 | 場所 | 用途 |
|---|---|---|
| `mockRepository` | [lib/repository/mock/](../neo-cs-v2/lib/repository/mock/) | デモ / ローカル開発 / Client Component |
| `supabaseRepository` | [lib/repository/supabase/](../neo-cs-v2/lib/repository/supabase/) | 本番 Server-only |

型定義は [lib/repository/types.ts](../neo-cs-v2/lib/repository/types.ts) が**唯一の正本**。両実装はこの interface に従う。

### 3.2 二系統のファサード — ⚠️ ここがバグ多発源

| ファイル | 戻り値 | import 元 |
|---|---|---|
| [lib/repository/index.ts](../neo-cs-v2/lib/repository/index.ts) | **常に mock** | Client Component / 旧 Server コード |
| [lib/repository/server.ts](../neo-cs-v2/lib/repository/server.ts) | `REPO_DRIVER` で切替 (`server-only`) | Server Component / Server Action / Route Handler |

**なぜ index.ts は常に mock を返すのか**: `supabaseRepository` は `node:async_hooks` (`server-only`) に依存しクライアントバンドル不可。Client Component から repository を直 import している箇所が残っているため、Client 側は mock を見続ける設計になっている。

**帰結 (本番バグの構造的原因)**:
1. Client Component で `import { weeklyReviewRepo } from "@/lib/repository"` していると、本番でも mock データを描画する。
2. Server で `@/lib/repository` (server.ts ではない方) を import すると、これも mock を返す → 環境変数で切り替えても効かない。
3. `index.ts` と `server.ts` の export リストにズレがある (例: surveys/participants/attendance は server.ts のみ)。新しい Repository を index.ts に追加し忘れると Client 側がコンパイルエラーになる。

### 3.3 ルール (Phase 0 で確定)

- **Server から Repository を使う場合は必ず `@/lib/repository/server` から import**。`@/lib/repository` は Server から import しない。
- Client Component は Repository を直接呼ばない。Server Action か Route Handler 経由でデータを受け取る (Phase 1+ で順次移行)。
- 新しい Repository を追加する場合: types.ts に interface 追加 → mock 実装 → supabase 実装 → `server.ts` に export → (Client 用に必要なら) `index.ts` にも export。

### 3.4 Hook 機構

`instrumentation.ts` で `registerHook(auditHook)` / `registerHook(loggingHook)` を装着。write 系メソッド呼び出し時に `audit_logs` (Supabase) と pino ログへ自動記録される ([_base.ts](../neo-cs-v2/lib/repository/_base.ts))。

---

## 4. マルチテナント / RLS

- 全業務テーブルに `organization_id uuid`。
- RLS: `auth.uid()` → `app_users` → `assignments` で担当範囲を絞る。
- デフォルト org: `00000000-0000-0000-0000-000000000001` (slug=`neoacademia`)。
- 初回ログイン時の `app_users` 自動登録: [middleware.ts](../neo-cs-v2/middleware.ts)。

---

## 5. データの流れ (典型)

```
Browser → (React Server Component) → getRepo() → supabaseRepository → Supabase
                                  ↓ Hook
                              audit_logs / pino
```

Server Action や Route Handler でも同じ経路。Client Component が直接データ取得することは禁止 (Phase 0 ルール)。

---

## 6. 環境変数

| 変数 | 用途 | 必須? |
|---|---|---|
| `REPO_DRIVER` | `mock` (デフォルト) / `supabase` | 本番は `supabase` |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | SSR + Client 認証 | 本番必須 |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | service_role | 本番必須 |
| `INITIAL_ADMIN_EMAIL` | 初回 admin 自動昇格 | 任意 |
| `ANTHROPIC_API_KEY` | Claude API | AI 機能必須 |
| `NEXT_PUBLIC_APP_BASE_URL` | OAuth コールバック | Gmail 連携必須 |

完全リストは [.env.example](../neo-cs-v2/.env.example)。`prebuild` で本番必須変数を `scripts/assert-prod-env.mjs` が検証。

---

## 7. 観測性 / セキュリティ

- pino logger: [lib/observability/](../neo-cs-v2/lib/observability/)
- 認可: [lib/security/](../neo-cs-v2/lib/security/) (CSP / CORS / rate-limit)
- 監査ログ: `audit_logs` テーブル (改ざん不可)
- Slack 通知: [lib/notifications/](../neo-cs-v2/lib/notifications/)

---

## 8. 既知の構造的負債 (Phase 1 で対処)

1. **Client から `@/lib/repository` 経由で mock を引いている画面が残っている** — 本番に切り替えても直らない。具体箇所は [PARITY.md §2](PARITY.md) を参照 ([ContractChurnSignals](../neo-cs-v2/components/contract/ContractChurnSignals.tsx), [CompanyVocList](../neo-cs-v2/components/company/CompanyVocList.tsx))。
2. **mock / supabase 実装の戻り値ズレ** — Supabase 側の `Company` 実装は `contracts: []` / `mrr: 0` / `lastTouchDays: 0` 固定。型は通るが値が空。詳細は [PARITY.md §1](PARITY.md)。
3. **UI が mock 前提**: 必ず存在する関連オブジェクト前提のアクセス、固定長前提の幅。
4. ~~`_legacy/` がリポに残置~~ — `archive/v1-legacy` に退避済 (db48741)。
