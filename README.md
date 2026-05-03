# NEO CSポータル v2

NEO ACADEMIA の Customer Success ポータル。Next.js 16 + Supabase ベース。

旧 v1 (`index.html` + `server.js` + `api/*.js`) は [`_legacy/`](_legacy/) に凍結退避済。

---

## クイックスタート (mock 駆動)

Supabase なしで起動できます。UI と画面遷移の確認はこれで十分です。

```bash
git clone https://github.com/spotsuku/neo_cs.git
cd neo_cs
npm install --prefix neo-cs-v2

# 環境変数を初期化 (mock のみで動かすので追加設定不要)
cp neo-cs-v2/.env.example neo-cs-v2/.env.local

npm run dev
# → http://localhost:3000
```

`REPO_DRIVER=mock` (デフォルト) では in-memory mock が読み込まれ、Supabase / Anthropic / Slack が未設定でも全画面が表示できます。

---

## 本番セットアップ (Supabase + 認証)

### 1. Supabase プロジェクト作成

[supabase.com](https://supabase.com) で新規プロジェクトを作成。リージョンは Tokyo (ap-northeast-1) を推奨。

### 2. マイグレーション適用

`supabase/migrations/` 配下を **番号順に** 実行する。

```bash
# 推奨: Supabase CLI
supabase db push

# 手動: SQL Editor から各ファイルを順に貼り付け
#   0001_init.sql               基底スキーマ + organizations + テナント seed
#   0002_audit_logs.sql         監査ログ強化 (改ざん不可・追加列)
#   0003_one_on_one_logs_rls.sql 1on1 RLS
#   0004_churn_signals.sql      解約予兆テーブル
#   0005_kpi_snapshots.sql      KPI スナップショット
#   0006_rls_policies.sql       全テーブル RLS ポリシー
#   0007_admin_seed.sql         初回ログイン時の admin 自動昇格 (任意)
```

### 3. 環境変数

`neo-cs-v2/.env.local` を [.env.example](neo-cs-v2/.env.example) を元に編集:

```env
REPO_DRIVER=supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
INITIAL_ADMIN_EMAIL=your.admin@example.com
ANTHROPIC_API_KEY=sk-ant-...
```

詳細は `.env.example` のコメントを参照。

### 4. Google OAuth (任意)

Supabase Dashboard → Authentication → Providers → Google を有効化。`hd` (hosted domain) を社内 Google Workspace のドメインに固定すると社外締め出しになる。

### 5. 起動

```bash
npm run build
npm start
```

Vercel デプロイ時はこれらの環境変数を Project Settings → Environment Variables に登録する。

---

## アーキテクチャ

```
neo-cs-v2/                  Next.js 16 アプリ本体
  app/                      App Router (Server Components + Server Actions)
  components/               UI コンポーネント
  lib/
    domain/                 純粋ドメイン関数 (kpi / health / churn / expansion)
    repository/
      types.ts              Domain型 + Repository インターフェース
      index.ts              Client/Server 両対応 (常に mock 実装を返す)
      server.ts             Server-only ファサード (REPO_DRIVER で切替)
      _base.ts              MutationHook registry (auditHook + loggingHook)
      mock/*                in-memory 実装
      supabase/*            Supabase 実装
    supabase/server.ts      service_role / SSR auth クライアント
    security/               認証・認可・CSP・CORS・rate-limit (ストリーム04)
    observability/          pino logger / Sentry / repo フック (ストリーム04)
    notifications/          Slack 通知 (ストリーム04)
  instrumentation.ts        サーバー起動フック (registerHook で監査+ログを装着)

supabase/
  migrations/               0001..0006 の SQL マイグレーション
roadmap/                    各ストリームの設計と完了報告
reviews/                    16視点レビュー (実装の根拠)
docs/runbook/               運用ランブック (シークレットローテ・バックアップ等)
_legacy/                    v1 凍結退避 (index.html / server.js / api/*.js)
```

### Repository 層

画面・Server Action・Route Handler は **`@/lib/repository` 経由でのみ** データアクセスする。`lib/mock/*` を直接 import しない。

```ts
// Client / Server 共通 (常に mock を返す)
import { weeklyReviewRepo } from "@/lib/repository";

// Server-only (REPO_DRIVER で mock|supabase 切替)
import { getRepo } from "@/lib/repository/server";
const repo = getRepo();
```

write 系メソッドは `instrumentation.ts` の `registerHook(auditHook)` / `registerHook(loggingHook)` により自動的に `audit_logs` (Supabase) と pino ログに記録される。

### マルチテナント

全業務テーブルに `organization_id uuid` を持ち、RLS は `auth.uid()` → `app_users` → `assignments` の経路で担当範囲を絞る。デフォルト org は `00000000-0000-0000-0000-000000000001` (slug=`neoacademia`)。

---

## スクリプト

| コマンド | 動作 |
| --- | --- |
| `npm run dev` | Next.js 開発サーバー (mock デフォルト) |
| `npm run build` | プロダクションビルド + 型チェック |
| `npm start` | プロダクションサーバー起動 |

ルートと `neo-cs-v2/` のどちらでも同じ動作。

---

## ドキュメント

- [roadmap/00_index.md](roadmap/00_index.md) — 4 ストリームの分担
- [roadmap/01_基盤_完了報告.md](roadmap/01_基盤_完了報告.md) — DB / リポジトリ層 / 認証
- [roadmap/02_機能改修_完了報告.md](roadmap/02_機能改修_完了報告.md) — 機能仕様
- [roadmap/03_デザインUX_完了報告.md](roadmap/03_デザインUX_完了報告.md) — デザインシステム
- [roadmap/04_運用セキュリティ_完了報告.md](roadmap/04_運用セキュリティ_完了報告.md) — RLS / 監査 / 観測性
- [docs/runbook/](docs/runbook/) — 運用ランブック (シークレットローテ・バックアップ・インシデント対応・退職処理 等)
- [reviews/](reviews/) — 16 視点のレビュー (実装の根拠)
