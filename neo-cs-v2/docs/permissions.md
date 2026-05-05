# 権限モデル

NEO CS の権限は **2 層構造** で表現する。

| 層 | 値 | 適用範囲 |
|---|---|---|
| グローバルロール | `admin` / `manager` / `member` / `viewer` / `external` | NEO 全体 |
| 事業スコープロール | `viewer` / `editor` / `template_editor` | 事業（productCode）単位 |

実体は以下のテーブル（`supabase/migrations/0022_user_program_roles.sql`）。

- `app_users.role` — グローバルロール
- `user_program_roles (user_id, product_code, scope_role)` — 事業スコープロール
- `user_company_access (user_id, company_id)` — `external` 専用の企業アクセスリスト

## グローバルロール

| ロール | 主な権限 | 使う画面 |
|---|---|---|
| `admin` | NEO 全体の編集、ユーザー追加削除、全社共通マスタ変更、Manager/Member 表示切替 | 全画面 + `/settings/users` |
| `manager` | 担当事業の全体把握・横断分析。マネージャー専用画面 `/manager` が見える | 全画面（担当事業内） |
| `member` | 担当事業内の実務担当 | 担当事業の業務画面 |
| `viewer` | 閲覧のみ（旧ロール、後方互換） | 各画面 read-only |
| `external` | 契約中企業のみ閲覧/進捗編集。横断画面は非表示 | 自身がアクセス可能な企業のみ |

`admin` は表示モード切替（TopNav トグル）で `manager` / `member` の見え方を確認できる。
内部的には `viewModeOverride` で `effectiveRole(ctx)` を切り替える。

## 事業スコープロール

`user_program_roles` で「ユーザー × 事業（productCode）」ごとに 1 件登録される。
admin は暗黙的に全事業 `template_editor` 相当のためレコード不要。

| スコープ | できること |
|---|---|
| `viewer` | 担当事業の進捗系画面を閲覧 |
| `editor` | + 進捗更新、週次入力など項目編集 |
| `template_editor` | + 列名・テンプレート編集 |

## NEO 全体に関わる設定（admin のみ変更可）

- ユーザー追加・削除・ロール変更
- 事業（program）の作成・削除
- 全社共通マスタ（ジャーニーステージのデフォルト定義、課題タグ、KPI 定義など事業横断の項目）
- 監査ログ・通知設定

→ `canEditGlobalSettings(ctx)` / `canManageUsers(ctx)` でガード。

事業ごとの `template_editor` が変更可能なのは「その事業内のテンプレート」のみ。

## 外部ユーザー (`external`)

- ログイン: メール + パスワード（Supabase Auth `inviteUserByEmail` 経由でパスワード自己設定）
- アクセス可能企業は `user_company_access` に登録された範囲のみ
- 横断画面（`/programs`, `/team`, `/voc`, `/renewal` 等）は TopNav 上で非表示
- 進捗編集は `weekly_reviews` / `company_tasks` のみ可（RLS 0023 / 0024）

招待方法（`/settings/users` の「+ 外部ユーザー招待」）は 2 系統:

1. **企業別**: 個別の `company_id` を直接複数指定
2. **事業別**: `productCode` を指定 → 該当事業の active 契約を持つ企業を自動付与

API: `POST /api/admin/invite-external` で `companyIds` または `productCodes` を渡す。

## 権限判定のコード境界

| 層 | モジュール | 役割 |
|---|---|---|
| 純関数 | [lib/auth/permissions.ts](../lib/auth/permissions.ts) | `can*` 群、`effectiveRole`, `programScopeRole` |
| サーバ context 解決 | [lib/auth/server.ts](../lib/auth/server.ts) | `getPermissionContext()`（cookie + repos） |
| Server Action | [lib/auth/actions.ts](../lib/auth/actions.ts) | 表示モード切替 |
| クライアントキャッシュ | [lib/auth/me-client.ts](../lib/auth/me-client.ts) | `/api/me` レスポンスの memoize |
| エンドポイント | [app/api/me/route.ts](../app/api/me/route.ts) | 現在ユーザーと表示モードを返す |

判定は **3 段ガード** を貫く:

1. **クライアント UI**: `TopNav` / 各 View で `effectiveRole` / `assignedProductCodes` に応じて表示制御（UX）
2. **サーバ**: `Server Action` / `Route Handler` 入口で `canManageUsers` 等を呼んで `403`（一次防衛）
3. **DB**: Supabase RLS が `auth.uid()` ベースで最終ガード（真のセキュリティ境界）

> UI のガードは UX のためで、セキュリティではない。書込みは必ずサーバ＋RLS で止める。

## RLS の構成

- `0001_init.sql`: `app_users.role` / 既存 RLS の土台
- `0006_rls_policies.sql`: `is_admin()` / `is_manager_or_above()` / `has_company_access()` ヘルパ
- `0022_user_program_roles.sql`: `external` 追加、`user_program_roles` / `user_company_access` テーブル + ヘルパ `auth_external_can_view_company()`
- `0023_external_rls.sql`: `companies` / `contracts` / `weekly_reviews` / `company_tasks` の SELECT/UPDATE で external 対応
- `0024_external_lockdown.sql`: 横断テーブル（`audit_logs` / `kpi_snapshots` / `program_*` / `voc_items` / `churn_signals` / `renewal_milestones` / `expansion_opportunities` / `assignments` / `drafts` / `one_on_one_logs`）で `external` を明示拒否

## テスト

| 種別 | ファイル | 概要 |
|---|---|---|
| 単体（純関数） | [lib/auth/permissions.test.ts](../lib/auth/permissions.test.ts) | `can*` / `effectiveRole` の 28 ケース |
| 単体（通知） | [lib/notifications/role-filter.test.ts](../lib/notifications/role-filter.test.ts) | 通知種別ごとの受信可否 10 ケース |
| E2E | [tests/e2e/role-nav.e2e.ts](../tests/e2e/role-nav.e2e.ts) | ロール別 TopNav 可視性 + ページガード |
| RLS | （別途 supabase ローカルで実施） | DB 側のアクセス制限 |

```bash
npm test                              # vitest（単体）
npx playwright install chromium       # 初回のみ
npm run test:e2e                      # Playwright（dev サーバー起動が前提）
npm run test:rls                      # RLS テスト（ローカル supabase 起動が前提）
```

E2E は cookie `mock_user_email` で actor を切替できる仕組みを使う（`lib/repository/mock/userRepo.ts`、NODE_ENV !== production のみ有効）。

### RLS テスト実行手順

`tests/rls/**` は通常実行から除外されている（`vitest.config.ts`）。実行には **ローカル supabase** と シードデータが必要:

```bash
# 1. ローカル supabase を起動
supabase start

# 2. マイグレーション適用（0001 〜 0024）
supabase db reset       # または supabase migration up

# 3. テスト用シードを投入
#    必要シード:
#      - admin@example.com   role=admin
#      - manager@example.com role=manager
#      - external1@example.com role=external + user_company_access(c-1)
#    （seed.sql に追記する想定）

# 4. 環境変数を設定
export SUPABASE_URL=http://localhost:54321
export SUPABASE_SERVICE_ROLE_KEY=<service role key>
export SUPABASE_ANON_KEY=<anon key>

# 5. 実行
npm run test:rls
```

`tests/rls/simulator.ts` の `asUser(email)` が auth.users の magic link → JWT を anon クライアントに setSession して返すため、各テストでは「特定の app_users になりすました状態」での RLS 挙動を直接検証できる。

## インパーソン（admin の代理確認）

admin が任意ユーザーになりすまして UI を確認する機能。

| 項目 | 内容 |
|---|---|
| 起動 | `/settings/users` の各行「視点で表示」ボタン |
| 制約 | external へのインパーソンは禁止（情報漏洩リスク） |
| 期間 | cookie に保存、**8 時間で自動失効** |
| 表示 | 全ページ上部に黄色バナー「⚠ インパーソン中: real → effective」 |
| 解除 | バナーの「解除」ボタン or 8 時間放置 |
| 監査 | `audit_logs` に `impersonate_start` / `impersonate_stop` を記録（actor=実 admin、target=対象 user） |

**重要**: インパーソン中の書込みは **service_role 経由のため、実 admin が書いた扱い** になる（auth.uid() は admin のまま）。RLS は実 admin の権限で評価されるため、インパーソン対象が見えない情報も誤って書いてしまうリスクがある。あくまで **UI 確認専用** として使い、書込み操作は元のユーザーに直接行ってもらうこと。

運用ルール:
1. インパーソンは UI バグ調査・新ロール追加時の動作確認のみに使用
2. 解除し忘れに注意（8h で自動失効するが目視確認）
3. `audit_logs` の `impersonate_*` は月次でレビューする

## 通知のロール連動

[lib/notifications/role-filter.ts](../lib/notifications/role-filter.ts) で通知種別ごとに受信可否を判定する。

| 種別 | 用途 | external 受信可否 |
|---|---|---|
| `internal_ops` | 内部運営向け（KPI 異常、未提出、チーム稼働） | × |
| `cross_business` | 横断アラート / レポート | × |
| `assigned_company` | 担当企業の業務連絡 | ◯（`user_company_access` 内のみ） |
| `personal` | 自分宛タスク・メンション | ◯ |

`filterRecipientsByRole(users, kind)` を必ず通してから配信すること。直接 `notifySlack` 等を呼び出す場所は webhook なので個別配信は発生しないが、将来のメール / in-app 通知のときに本フィルタが一次防衛になる。

## Supabase Auth セキュリティ施策（external 向け）

| 項目 | 実装場所 |
|---|---|
| パスワード強度（12文字以上、英大小+数字+記号） | Supabase Dashboard `Auth > Policies` |
| ログイン試行レート制限 | Supabase 標準 |
| CAPTCHA（hCaptcha / Turnstile） | Supabase Auth settings + ログイン画面 |
| MFA（TOTP）— 推奨 | Supabase MFA |
| セッション短縮（external のみ JWT 1h / refresh 24h） | Supabase Auth config |
| 監査ログ（external のアクション全件） | repo 層 `runAfterWrite` で audit_logs |
| メールアドレス変更不可（admin のみ） | アプリ側ガード |
| ログイン画面分離（`/login` / `/external/login`） | Next.js ルーティング |

## 図: 権限判定フロー

```
User Request
  ↓
Middleware (cookie → x-app-user-* headers)
  ↓
getPermissionContext()  ← actor + programs + companyAccess + viewModeOverride
  ↓
─ UI: canSeeManagerView / 表示制御
─ Server Action: canManageUsers / canEditProgress 等で 403
─ DB: RLS (auth.uid() ベース)  ← 真のガード
```
