# 初回本番セットアップ手順 (案C)

> このRunbookは「F項12点を集めて本番フル機能deployする」案C専用の手順書。
> 統合チェックリスト (10_integration_checklist.md §F) のステップbyステップ実行版。

---

## 0. 前提

- ブランチ: `feature/v3-production-ready` (push済)
- Vercel project: `neo-cs` (link済)
- Supabase project: 未発行 → このrunbook内で発行
- 想定作業時間: あなたの手作業 90分 + agent自動化 30分

---

## 1. 必要な情報の収集 (あなたの手作業 90分)

下記をすべて取得し、安全な場所 (1Password等) に保管。

### 1-A. Supabase プロジェクト発行
1. https://supabase.com/dashboard で **New Project** クリック
2. Project name: `neo-cs-portal-production`
3. Database password: 強パスワード生成 (1Password)
4. Region: **Northeast Asia (Tokyo)** を強く推奨
5. Pricing plan: **Pro 推奨** (PITRバックアップに必須)
6. 作成後、以下を取得:
   - `NEXT_PUBLIC_SUPABASE_URL` (https://xxxx.supabase.co)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (eyJh...)
   - `SUPABASE_SERVICE_ROLE_KEY` (eyJh... ※絶対公開しない)
   - `SUPABASE_PROJECT_REF` (xxxx の部分)

### 1-B. Anthropic API Key 発行
1. https://console.anthropic.com → 組織Workspace選択
2. Settings → API Keys → Create Key
3. Name: `neo-cs-portal-production`
4. 表示された `sk-ant-api03-...` を控える
5. ついでに Workspace settings → **Spend limit** を月次予算で設定 (例: $200/月)

### 1-C. Google OAuth Client 発行
1. https://console.cloud.google.com → 既存 or 新規プロジェクト
2. APIs & Services → Credentials → **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `neo-cs-portal-production`
5. Authorized JavaScript origins: 本番ドメイン (例: `https://neo-cs-alpha.vercel.app` or `https://cs.neoacademia.jp`)
6. Authorized redirect URIs: `https://<本番ドメイン>/auth/callback` + Supabase URLの `/auth/v1/callback`
7. 取得: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
8. **OAuth同意画面** で `Authorized domains` に `neoacademia.jp` を追加 (hd制限の前提)

### 1-D. Slack Webhook 発行 (4本)
Slack workspace → Apps → **Incoming Webhooks** → 新規追加 (4回繰り返し)
- `#cs-churn-alerts` チャンネル → `SLACK_WEBHOOK_URL_CHURN_ALERTS`
- `#cs-expansion` チャンネル → `SLACK_WEBHOOK_URL_EXPANSION`
- `#cs-voc` チャンネル → `SLACK_WEBHOOK_URL_VOC`
- `#cs-incidents` チャンネル → `SLACK_WEBHOOK_URL_INCIDENTS` (任意)

### 1-E. Sentry プロジェクト発行
1. https://sentry.io → New Project → Next.js
2. Project name: `neo-cs-portal`
3. 取得: `SENTRY_DSN` (https://xxx@sentry.io/yyy)

### 1-F. その他
- `INITIAL_ADMIN_EMAIL`: 初期管理者メール
- `NEO_CS_V2_URL`: 本番URL (例: `https://cs.neoacademia.jp`)
- `NEXT_PUBLIC_APP_BASE_URL`: 同上
- `ALLOWED_ORIGINS`: 同上 (カンマ区切りで複数可)

---

## 2. Supabase Database セットアップ (15分)

### 2-A. CLI link
```bash
cd /Users/furuken/dev/neo_cs
supabase link --project-ref <SUPABASE_PROJECT_REF>
# Supabase Dashboard で発行した DB password を入力
```

### 2-B. マイグレーション適用 (12本)
```bash
supabase db push
# 0001_init.sql 〜 0012_voc_items.sql が順次適用される
# RLS全展開 + admin seed + audit_logs hook 等が有効化
```

### 2-C. デモseed投入
```bash
psql "<SUPABASE_CONNECTION_STRING>" -f supabase/seed.sql
# または Supabase Dashboard → SQL Editor で seed.sql の内容を貼り付け実行
# 1,834行 / 39 INSERT文 / 架空15社のデモデータが入る
```

### 2-D. 初期 admin 設定
0007_admin_seed.sql でtriggerが配置済。INITIAL_ADMIN_EMAIL の人が初回ログインすると
自動的に admin role が付与される (一度きり、レース不可)。

### 2-E. Google OAuth provider 設定 (Supabase側)
Supabase Dashboard → Authentication → Providers → Google を有効化:
- Client ID / Secret を貼り付け
- Authorized Client IDs に追加
- (任意) Skip nonce check OFF

---

## 3. Vercel 環境変数設定 (10分)

`docs/runbook/_vercel_env_apply.sh` (このrunbookと同時に生成) を編集して実行:

```bash
bash docs/runbook/_vercel_env_apply.sh
```

または Vercel Dashboard → Settings → Environment Variables で **Production** スコープに手動入力。
.env.example の全項目を参照すること。

---

## 4. 本番Deploy (5分)

```bash
cd neo-cs-v2
vercel --prod
# 完了URL確認
# vercel cron list で 6本 cron 登録確認
```

---

## 5. 動作確認 (15分) — Stage 1チェックリスト準拠

`docs/runbook/10_integration_checklist.md` §A から順次:

- [ ] 本番URL → /login → Google OAuth → admin として入れる
- [ ] /companies で15社表示される
- [ ] /companies/[id] でHealth/Churn/Expansion/Renewal/VOC全表示
- [ ] /team でメンバー一覧
- [ ] /reports でKPI 12ヶ月推移
- [ ] /settings/users で自分が admin role
- [ ] /settings/consents で4項目同意
- [ ] /styleguide でトークン見本
- [ ] /api/health?deep=1 が green
- [ ] cron手動キック → Slack に通知が来る
- [ ] audit_logs テーブルに自分のアクセスログ

---

## 6. Stage 2 移行 (動作OK後 7日間並走)

- 既存 mock URL (Preview) と新本番を **両方公開** し、
  CSメンバー数名にBeta触ってもらう
- 不具合・要望は GitHub Issues に「stage2-feedback」ラベルで起票
- 7日後 Stage 3-A (Beta 1組織本番運用) へ

---

## トラブルシュート

### Supabase migration がエラー
- supabase db reset → supabase db push でやり直し (デモなので破棄OK)
- 0007 admin seed の trigger conflict が出たら drop trigger → 再create

### Google OAuth で「redirect_uri_mismatch」
- Supabase Dashboard の Auth Provider Google 設定の Callback URL と
  Google Cloud Console の Authorized redirect URIs を一致させる

### cron が動かない
- vercel cron list で登録確認
- /api/cron/* に curl で `Authorization: Bearer <CRON_SECRET>` テスト

### Anthropic API 503
- Console で API Key が有効か / Workspace の Spend limit 内か確認

---

## ロールバック
`docs/runbook/08_rollback.md` 参照。Vercel Dashboard から旧deploy promote が最速。
