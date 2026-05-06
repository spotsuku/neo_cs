# 本番 / デモ 環境分離ガイド

NEO CS v2 を **本番環境**と**デモ環境**で分離する手順。
コードは同一（同じ Git ブランチを共有）、データと環境変数だけが異なる。

```
GitHub: neo_cs / main
   ├─→ Vercel project: neo-cs-prod   (cs.neoacademia.jp)       REPO_DRIVER=supabase
   └─→ Vercel project: neo-cs-demo   (cs-demo.neoacademia.jp)  REPO_DRIVER=mock
```

## 想定運用

- 営業のデモはすべて **cs-demo.neoacademia.jp** で実施
- 本番データは **cs.neoacademia.jp** にしか入っていない
- コードに変更を main へ push すると、両プロジェクトが**同時に**自動デプロイされる
- 認証はそれぞれ独立（デモは社内専用ユーザーで運用、本番は Google OAuth + 顧客テナント）

---

## セットアップ手順

### 1. 本番用 Vercel プロジェクト

#### 1.1 Vercel ダッシュボードでプロジェクトを新規作成
- Project name: `neo-cs-prod`
- Repository: `spotsuku/neo_cs`
- Production branch: `main`
- Root directory: `neo-cs-v2`
- Framework Preset: Next.js

#### 1.2 環境変数 (Production)

| Key | Value |
|---|---|
| `REPO_DRIVER` | `supabase` |
| `NEXT_PUBLIC_SUPABASE_URL` | 本番 Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 本番 anon key |
| `SUPABASE_URL` | 同上 |
| `SUPABASE_SERVICE_ROLE_KEY` | 本番 service role key |
| `INITIAL_ADMIN_EMAIL` | 初回管理者メール |
| `ALLOWED_ORIGINS` | `https://cs.neoacademia.jp` |
| `ANTHROPIC_API_KEY` | 本番用 (別キーを推奨) |
| `GOOGLE_CLIENT_ID` | 本番 OAuth Client ID |
| `GOOGLE_HOSTED_DOMAIN` | `neoacademia.jp` |
| `SENTRY_DSN` | 本番 Sentry DSN |
| `LOG_LEVEL` | `info` |

#### 1.3 ドメイン設定
- Settings → Domains → `cs.neoacademia.jp` を追加
- DNS (Cloudflare 等) で CNAME を Vercel に向ける

---

### 2. デモ用 Vercel プロジェクト

#### 2.1 同じリポジトリを使ってもう1つプロジェクト作成
- Project name: `neo-cs-demo`
- Repository: `spotsuku/neo_cs` (同じ)
- Production branch: `main` (同じ)
- Root directory: `neo-cs-v2`

> 同一 GitHub リポジトリに複数 Vercel project を紐づけて問題なし。GitHub 側 webhook が両方に飛ぶ。

#### 2.2 環境変数 (Production)

| Key | Value |
|---|---|
| `REPO_DRIVER` | `mock` |
| `ALLOWED_ORIGINS` | `https://cs-demo.neoacademia.jp` |
| `ANTHROPIC_API_KEY` | デモ用 (使用量制限を別途設定) |
| `LOG_LEVEL` | `info` |
| `INITIAL_ADMIN_EMAIL` | デモ用管理者メール |
| (Supabase 系) | **設定不要**(`REPO_DRIVER=mock` ならアクセスしない) |
| (Sentry) | 任意(デモなのでなくてもよい) |

#### 2.3 ドメイン設定
- `cs-demo.neoacademia.jp` を追加

---

### 3. デプロイ確認

```bash
git push origin main
```

両プロジェクトの Deployments タブに同じコミットが流れることを確認。
失敗側だけが残った場合は環境変数の不足を疑う。

### 4. データ確認

- 本番 (`cs.neoacademia.jp`)
  - Server Component が描画するページ (例: `/`, `/companies`) は実 DB を読む
  - **モックデータが表示されないことを確認** ← 重要
- デモ (`cs-demo.neoacademia.jp`)
  - 全画面でモックデータが表示される
  - 書き込み操作は in-memory なのでセッション越しで揮発する

---

## 注意点

### A. クライアントコンポーネントは現状常にモックを返す

[lib/repository/index.ts](../lib/repository/index.ts) は設計上 mock のみ返すため、
`"use client"` ファイルから `@/lib/repository` を直接 import している画面は、
**本番でもモックデータが表示される**。

該当画面（`ProgramsView`, `MatrixView`, `OnboardingView`, `VocBoard`, `TasksBoard`,
`InboxView`, `ExecutiveDashboard`, `ChatView`, `CompanyWeeklyEditor` 他）は、
順次 Server Component / Server Action 経由のデータ取得にリファクタする必要がある。

→ これは **デモ分離とは別に進める必須タスク** (P0-①)

### B. Supabase repo が未実装の領域 (本日時点)

| 領域 | 状態 |
|---|---|
| programs (期内ToDo) | ✅ 実装済 (lib/repository/supabase/programRepo.ts) |
| journeyStageDefinitions | ❌ mock fallback |
| companyJourneys / businessJourneys | ❌ mock fallback |
| journeyCheckpoints | ❌ mock fallback |
| contractLifecycle | ❌ mock fallback |
| companyWeatherOverrides | ❌ mock fallback |
| companyVisions | ❌ mock fallback |

`REPO_DRIVER=supabase` でもこれらは mock 値を返す。本番投入前に塞ぐこと。
`lib/repository/supabase/index.ts` のコメントが現状の正本。

### C. ANTHROPIC_API_KEY の分離

デモで Claude API を叩く動線が残っているため、本番キーをデモ Vercel に流すと
顧客向けデモで本番予算を消費してしまう。**必ず別キー**を発行し、デモ側は
使用量上限を低めに設定する。

### D. Slack 通知のチャンネル分離

`/api/integrations/sales/handoff` 等は Slack に通知する。
デモ環境からの誤通知を防ぐため、デモ側の Slack webhook は `null` または
別チャンネル (`#cs-demo-test` 等) に向ける。

### E. cron / バッチ系

Vercel Cron は両プロジェクトで動く。デモ環境で本番 cron を有効にしない:
- `vercel.json` の cron 設定はそのまま反映されるため、デモ側で `REPO_DRIVER=mock`
  なら mock リポジトリを更新するだけで実害はない
- ただし `/api/cron/*` の中に外部 API を叩くものがあれば要確認

---

## 環境別チェックリスト (デプロイ前)

### 本番 cs.neoacademia.jp
- [ ] `REPO_DRIVER=supabase` 設定済
- [ ] Supabase migration が **0027 まで投入済**
- [ ] `is_demo=true` 企業がDBに**0件** (`/settings/demo-data` で確認)
- [ ] Google OAuth `hd` 制約が顧客ドメインに合うか確認
- [ ] Sentry DSN 設定済
- [ ] CSP (CORS / `ALLOWED_ORIGINS`) 設定済

### デモ cs-demo.neoacademia.jp
- [ ] `REPO_DRIVER=mock` 設定済
- [ ] Supabase 系環境変数は**未設定**または不要
- [ ] `ANTHROPIC_API_KEY` がデモ用キー
- [ ] Slack webhook がデモ用 / 無効
- [ ] ベーシック認証 or 限定 IP 制限 (営業同行者だけがアクセスできるように)
