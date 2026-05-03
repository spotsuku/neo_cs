# 中間統合確認チェックリスト

**目的**: 全ストリーム (01 基盤 / 02 機能改修 / 03 デザインUX / 04 運用セキュリティ) の成果物が end-to-end で噛み合うかを **本番展開前に** 全件確認する。
**対象**: 中間統合フェーズ (02 H項完了後、本番ロールアウト前)。
**位置づけ**: 本ファイルが go/no-go 判断の **唯一の根拠**。チェックが落ちたら担当ストリームに差し戻し。

実施者: 04 担当 (調整) + 各ストリーム担当 (該当セクション署名)。
所要: 全件で約 4-6 時間。Stage ごとに分割実施推奨。

---

## A. mock モード動作確認 (Stage 1 前提)

ローカル `npm run dev` (REPO_DRIVER=mock) で実施。**01 の middleware.ts は mock モードで素通し**するため、認証回避済の状態で全画面が動くべき。

### A-1. 起動・ログイン回避

- [ ] `cd neo-cs-v2 && npm ci && npm run dev` が 5 秒以内に起動
- [ ] `http://localhost:3000/` にアクセスして mock 素通し → トップ表示 (リダイレクトループなし)
- [ ] DevTools Network タブに 4xx/5xx が一切ない (画像/フォントを除く)
- [ ] DevTools Console にエラー/CSP違反の出力 0 件

### A-2. ダッシュボード・基本ナビゲーション

- [ ] `/` トップが正常表示 (KPI カード + 健全度分布 + 解約予兆 + エクスパンション機会)
- [ ] TopNav の全リンク (companies / weekly / team / reports / settings / styleguide) が遷移
- [ ] パンくず (companies → 詳細 → タブ) が正しい

### A-3. /companies/[id] (N+1 修正済 ★)

- [ ] 任意の企業 (例: アクメ社) を開き、以下が**1度の SSR で全て表示**:
  - [ ] 概要タブ: 企業情報 + ヘルスバッジ + Stakeholder + Account Journey
  - [ ] 週次レビュータブ: 直近 5 件
  - [ ] 契約・更新タブ: active + 履歴 + 更新マイルストン T-120/90/60/30
  - [ ] 面談ログタブ: 50 件 (sort=date desc)
  - [ ] オンボタブ: contractIds 一括取得 (★A 解消確認)
  - [ ] 解約予兆: ContractChurnSignals
  - [ ] エクスパンション機会: ContractExpansionOpportunities
- [ ] DevTools Network で同企業の SSR が **2 ラウンドトリップ以内** (page.tsx の Promise.all 構造が効いていること)

### A-4. /weekly (in-memory 仕様)

- [ ] 任意セルを編集 → 自動保存 (toast「保存しました」)
- [ ] リロード → mock のため **編集分は消失** (期待通り、本番 supabase 切替で永続化)
- [ ] スクロール時に見出し行が sticky で固定 (commit `d6806ca`)

### A-5. /team

- [ ] メンバー全員 (mock seed 3名) 表示
- [ ] 担当社数・担当契約数・**健全度平均 (snapshots.latestAll() 基準)** が表示
- [ ] 詳細リンクで `/team/[userId]/one-on-one` 遷移 → 1on1 履歴表示

### A-6. /reports

- [ ] thisMonth / thisQuarter / thisFY / last30d / last90d / last365d 切替で window が変化
- [ ] **【REGRESSION】 thisQuarter ≠ thisFY** (Q1 でも別範囲)
- [ ] 12 ヶ月 MRR トレンドグラフ表示
- [ ] CSV/JSON エクスポートボタンでダウンロード成功

### A-7. /settings/users/[userId] (G項)

- [ ] mock current user = u-furuno (admin) で表示確認
- [ ] 別ユーザー (u-miki) の詳細を開く
- [ ] 「無効化する」→ ConfirmDialog → 「無効化する」確定
- [ ] 状態バッジが「無効」に変化 + トースト「ユーザーを無効化しました」
- [ ] 再有効化 → 「有効」に戻る
- [ ] **自分自身 (u-furuno) を開くと「無効化する」ボタンが disabled + 警告表示**
- [ ] 操作後 stderr に `audit_fallback` (action=disable_user/enable_user) が出力 (mock では Supabase 未接続のため fallback)

### A-8. /settings/consents

- [ ] 4 項目表示 (利用規約 / プライバシー / Anthropic越境 / AI評価)
- [ ] Anthropic項に「越境移転 / US」ラベル
- [ ] 同意/撤回ボタン押下 → トースト + state 更新
- [ ] policy_version (2026-05-03) がヘッダ表示

### A-9. /styleguide

- [ ] 全カラートークン (brand/ink/success/warning/danger) 表示
- [ ] フォントサイズスケール (caption/body/h4/h3/h2/h1/metric)
- [ ] コンポーネント見本 (Button / Badge / Card / ConfirmDialog / KpiCard)

---

## B. supabase モード動作確認 (Stage 2 前提)

ローカル Supabase + `REPO_DRIVER=supabase` で実施。01 の middleware が本番経路で起動。

### B-1. 環境準備

- [ ] Supabase プロジェクト作成 (staging)
- [ ] 0001〜0008 マイグレーションを **順序通り** 適用 (`supabase db push` 等)
  - 0001 init / 0002 audit_logs / 0003 one_on_one_rls / 0004 churn_signals / 0005 kpi_snapshots / 0006 rls_policies / 0007 admin_seed / 0008 notification_dedup
  - 0009 以降 (02 H項) があれば追加適用
- [ ] `.env.local` に staging 値設定:
  ```
  REPO_DRIVER=supabase
  NEXT_PUBLIC_SUPABASE_URL=...
  NEXT_PUBLIC_SUPABASE_ANON_KEY=...
  SUPABASE_SERVICE_ROLE_KEY=...
  GOOGLE_CLIENT_ID=...
  GOOGLE_HOSTED_DOMAIN=neoacademia.jp
  INITIAL_ADMIN_EMAIL=k_furuno@neoacademia.jp
  ALLOWED_ORIGINS=http://localhost:3000
  CRON_SECRET=staging-secret
  NOTIFICATION_DEDUP_DRIVER=supabase
  ```

### B-2. Google OAuth

- [ ] `/login` → Google 認証 → callback → `/` リダイレクト
- [ ] `app_users` テーブルに actor 行が追加されている (初回ログイン時)
- [ ] `INITIAL_ADMIN_EMAIL` のユーザーは `role=admin` で seed されている (0007)
- [ ] `aud` (Supabase project) と `hd=neoacademia.jp` が JWT 検証で強制 (社外締め出し)

### B-3. middleware ロールガード

- [ ] admin: `/settings/users` `/settings/consents` `/api/admin/*` 全部アクセス可
- [ ] manager: `/team` `/reports` 可、`/settings/users` 禁止 → `/?forbidden=1` リダイレクト
- [ ] member: `/companies` `/weekly` `/onboarding` `/renewal` `/attendance` `/inbox` `/surveys` 可、`/team` 禁止
- [ ] viewer: 個人画面 (me/profile/notifications) のみ可、業務画面禁止
- [ ] 30分無操作後アクセス → `/login?reason=idle_timeout`
- [ ] 8時間連続セッション → `/login?reason=absolute_timeout`
- [ ] `app_users.is_active=false` のユーザーでアクセス → `/login?reason=user_disabled`

### B-4. 監査ログ (audit_logs)

- [ ] 任意の write (週次レビュー保存、企業作成、ユーザー無効化) を実行
- [ ] `select * from audit_logs order by created_at desc limit 10;` で記録確認
  - actor_user_id, actor_email, action, target_table, target_id が正しい
  - before_data / after_data jsonb に変更前後が入っている
  - request_id / ip / user_agent / source='app' が入っている
- [ ] `update audit_logs set action='x' where id=...;` を試行 → **改ざん不可トリガで拒否** (RAISE EXCEPTION)
- [ ] `delete from audit_logs where id=...;` も同様に拒否

### B-5. /api/health (拡張済)

- [ ] `curl /api/health` → 200 `{ status: "ok", checks: { process: "ok", supabase: "ok", anthropic: "skip" } }`
- [ ] `curl /api/health?deep=1` → 200 `{ ..., checks.anthropic: "ok" }` (Anthropic 疎通含む)
- [ ] Supabase を一時停止して `/api/health` → 503 `{ status: "degraded", checks.supabase: "fail" }`

---

## C. cron 動作確認

5 本のうち 04 管轄 4 本は手動キック必須。`health-snapshots` / `kpi-snapshots` は 01 担当範囲だが疎通だけ確認。

### C-1. 認証検証 (全 6 本に対し)

各 cron 経路に対し:

- [ ] `Authorization` 無し → 401 `{error:"unauthorized"}`
- [ ] `Bearer wrong` → 401
- [ ] `CRON_SECRET` 未設定環境 → 503 `{error:"misconfigured"}`
- [ ] 正規 `Bearer ${CRON_SECRET}` → 200 `{status:"ok", ...}`

### C-2. 動作 (各 cron)

| 経路 | 期待結果 |
|---|---|
| `/api/cron/churn-notify` | severity=high & unNotified の churn_signals に対し Slack 通知 → notified_at 更新 |
| `/api/cron/expansion-notify` | open + score≥THRESHOLD + unNotified の機会に対し Slack 通知 → notified_at 更新 |
| `/api/cron/dedup-cleanup` | `notification_dedup_cleanup()` RPC 実行、deleted 件数返却 |
| `/api/cron/health-snapshots` (01) | 全契約に対し health_score_snapshots へ upsert |
| `/api/cron/kpi-snapshots` (01) | KPI 集計を kpi_snapshots へ upsert |
| `/api/cron/voc-notify` | priority=high & unNotified の voc_items に対し Slack 通知 → notifiedAt 更新 |

### C-3. dedup driver=supabase 動作

- [ ] `NOTIFICATION_DEDUP_DRIVER=supabase` で起動
- [ ] churn-notify を 2 回連続キック
- [ ] `select * from notification_dedup where channel='slack:CHURN_ALERTS';` で行が存在
- [ ] 2 回目は notified=0, skipped=N (主キー衝突でブロック)
- [ ] dedup-cleanup を expires_at 経過後に実行 → deleted > 0

### C-4. inFlight 同時実行ロック

- [ ] 同一 cron に対し並列 2 リクエスト → 1 件は `{status:"skipped", reason:"concurrent_run"}`

---

## D. セキュリティ確認

### D-1. CORS ホワイトリスト

- [ ] 許可オリジン (`http://localhost:3000`) からの POST → 200 + `Access-Control-Allow-Origin` エコー
- [ ] 不許可オリジン (`https://evil.example.com`) → 403 + ヘッダなし
- [ ] preflight OPTIONS で許可オリジン → 204、不許可 → 403

### D-2. /api/claude

- [ ] Bearer 無し → 401 unauthorized
- [ ] 正規 Bearer + ボディ正常 → 200 + Anthropic レスポンス
- [ ] 32KB 超ボディ → 413 body_too_large
- [ ] 同 user で 60 req / 5min 超過 → 429 + Retry-After
- [ ] `DEGRADED_ANTHROPIC=true` → 503 service_degraded
- [ ] エラー時のレスポンスに `request_id` のみ、内部エラー詳細が**含まれない**

### D-3. CSP / セキュリティヘッダ

- [ ] DevTools → Network → 任意リクエストの Response Headers:
  - [ ] `Content-Security-Policy-Report-Only` ヘッダ存在
  - [ ] `X-Content-Type-Options: nosniff`
  - [ ] `X-Frame-Options: DENY`
  - [ ] `Referrer-Policy: strict-origin-when-cross-origin`
  - [ ] 本番のみ: `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- [ ] DevTools Console に CSP 違反レポートが**意図した依存のみ** (Sentry, Supabase, Anthropic, fonts)

### D-4. RLS

- [ ] anon キーで `select * from companies` → 0 件 (RLS 拒否)
- [ ] anon キーで `select * from audit_logs` → 0 件
- [ ] authenticated (member) で自社の companies のみ取得可、他社は 0 件
- [ ] authenticated (admin) で全件取得可
- [ ] service_role で `insert into audit_logs` 成功 / authenticated で同 insert → RLS 拒否

### D-5. v1 凍結

- [ ] 旧 `index.html` (`_legacy/index.html` に退避済) はブラウザから到達不可
- [ ] `node server.js` 起動 → どの URL も **410 Gone** + 移行案内 HTML
- [ ] `/api/db` (旧Vercel Function) は v1全廃PRで削除されているか、残存する場合は 410 ガード設置済

---

## E. テスト / CI / ビルド

### E-1. ローカル

- [ ] `npm test` — 全 pass (現時点 119/119)
- [ ] `npm run typecheck` — 0 エラー
- [ ] `npm run lint` — errors=0 (warnings は許容)
- [ ] `npm run build` — 成功、26+ routes 生成、middleware ƒ Proxy + cron route 5 本登録
- [ ] `npm test:coverage` — domain 純関数 + security/notifications/repository に集中、>70%

### E-2. CI

- [ ] PR 作成 → `.github/workflows/ci.yml` が Node 20 + 22 matrix で実行
- [ ] typecheck / test / build が全 green
- [ ] `.github/workflows/security-audit.yml` が週次 + PR で `npm audit` 実行
- [ ] preview deploy (Vercel App or `.github/workflows/preview.yml`) で PR にプレビューURL 投稿

---

## F. ユーザー側オペ (本番ロールアウトに必須)

**04 / 02 / 01 の全実装で対応不可、ユーザー側で実施が必要な作業。本番切替前に全完了必須**。

| # | 内容 | 担当 | 完了確認方法 |
|---|---|---|---|
| F-1 | `ANTHROPIC_API_KEY` ローテ ([01_anthropic_key_rotation.md](01_anthropic_key_rotation.md)) | 情シス | 旧キー失効 + 新キーで `/api/health?deep=1` 200 |
| F-2 | Vercel env 設定 (本番) | 情シス | `vercel env ls production` で全項目埋まり |
| F-3 | Sentry プロジェクト発行 + DSN 設定 + `npm i @sentry/nextjs` ([05_csp_enforcement.md §4-α](05_csp_enforcement.md)) | 情シス | Sentry に test event が届く |
| F-4 | Supabase 本番 Project (Pro 以上 = PITR有効) 作成 + マイグレーション適用 | DBA | `select count(*) from app_users` で seed 確認 |
| F-5 | Google OAuth 本番 Client 発行 + Hosted Domain neoacademia.jp 強制 | 情シス | 社外 Gmail でログイン拒否確認 |
| F-6 | `INITIAL_ADMIN_EMAIL` を本番 admin 1 名に設定 | CS責任者 | `app_users` の `role='admin'` レコード確認 |
| F-7 | Slack incoming webhook 発行 (CS_ALERTS / CS_INCIDENT / CHURN_ALERTS / EXPANSION) | CS責任者 | 各 cron を手動キックして Slack 受信確認 |
| F-8 | `CRON_SECRET` 32 文字以上ランダム値発行 + Vercel env 設定 | 情シス | 手動キックで認証通過 |
| F-9 | `ALLOWED_ORIGINS=https://cs.neoacademia.jp` (カンマ区切り) | 情シス | 本番ドメイン以外から CORS 拒否 |
| F-10 | `NOTIFICATION_DEDUP_DRIVER=supabase` 切替 (本番) | 情シス | notification_dedup テーブルにエントリ蓄積 |
| F-11 | CSP enforce 昇格 (Sentry 受信開始 + 14 日収集後) ([05_csp_enforcement.md](05_csp_enforcement.md)) | 情シス | `Content-Security-Policy` ヘッダに変化 |
| F-12 | バックアップ Runbook の月次 PITR リハ実施 ([02_supabase_backup_restore.md](02_supabase_backup_restore.md)) | DBA | `restore-tests/2026-MM.md` 残し |

---

## G. 02 H項 (VOC) 統合チェック (確定 — 2026-05-03)

02 H項 = VOC (Voice of Customer) エンジン完了 + 04 側通知配線完了済。実施項目:

### G-1. VOC 画面 (02 H項担当範囲)

- [ ] `/voc` 一覧ページが表示 (mock seed が出る)
- [ ] フィルタ動作: status (new/triaged/backlog/shipped/wontfix) / priority (low/med/high) / tag
- [ ] `/voc/[id]` 詳細でトリアージ操作 (status 変更 / priority 変更 / 担当割当 / コメント追加 / linkedPrUrl)
- [ ] 開発エクスポート動線 (Notion / Linear / Markdown) が存在する場合は動作確認

### G-2. RLS / 権限

- [ ] anon キーで `select * from voc_items` → 0 件
- [ ] member ロールで自組織の voc_items のみ取得可、他組織 0 件
- [ ] admin ロールで全件取得可
- [ ] `voc_comments` も同パターンで RLS 効く

### G-3. voc-notify cron (04 担当・配線完了)

- [ ] `curl /api/cron/voc-notify` 認証なし → 401
- [ ] `Bearer ${CRON_SECRET}` で 200 + `{attempted, notified, skipped, failed, latencyMs}` 返却
- [ ] mock seed の priority='high' のみ Slack に流れる (priority='med'/'low' はスキップ)
- [ ] 連続 2 回キック → 2 回目は notifiedAt + dedup の二重防御で 0 件追加通知
- [ ] post 失敗時は `notifiedAt` が立たない (再送可能)

### G-4. Slack 連携

- [ ] `SLACK_WEBHOOK_URL_VOC` が `.env.example` / `slack.ts:SlackChannel` 両方に存在
- [ ] `notifyVocItem` ペイロード (header/抜粋/context/actions) が Slack に正しく届く
- [ ] dedup driver=supabase で `notification_dedup` に `channel='slack:VOC'` の行が蓄積

### G-5. 監査ログ

- [ ] VOC のトリアージ・priority変更・コメント追加が `audit_logs` に記録される
- [ ] action enum に `voc_export` 等が必要なら 02 H項側で追加要望
- [ ] `customerNotifiedAt` (顧客への返答完了マーク) も audit に残る

### G-6. ドキュメント

- [ ] [11_voc_notification.md](11_voc_notification.md) 通りに動作する
- [ ] 障害対応のための SQL クエリが本番でも有効

---

## X. ロールアウト順序 (Stage 1〜3)

**重要**: stage 間は **最低 1 週間 並走**。stage skip は禁止。

### Stage 1: mock モード本番デプロイ (staging URL)

**期間**: 3 営業日
**目的**: フロントの全画面が production build で正常動作するか確認 (DB は使わない)

**Go 基準**:
- §A 全項目 pass
- §E 全項目 pass
- §D-1 (CORS), §D-3 (CSPヘッダ存在) pass

**No-go 条件**:
- 任意の Server Component が SSR 中にエラー
- DevTools Console に CSP 違反 + アプリ依存
- ブラウザバック / リロードで state 不整合

### Stage 2: supabase モード staging (1 週間並走)

**期間**: 7 日間以上
**目的**: 本番相当データで RLS / 認証 / cron / 監査が正しく動くか

**Go 基準**:
- §B 全項目 pass
- §C 全項目 pass (4本 cron 認証 + 動作)
- §D-4 RLS 全 anon 拒否 + role 別アクセス制御
- §D-5 v1 凍結確認
- 7 日間で重大インシデント 0 件
- audit_logs に 100 件以上の正当な write 記録 (使用された証拠)

**No-go 条件**:
- 二重通知が 1 件でも発生
- audit_logs に actor null の write が混入
- middleware が無限リダイレクトループ
- 任意の RLS 抜け穴 (anon で機微データ取得可)
- /api/health が 1h 以上 degraded

### Stage 3: 本番切替 (Beta 組織 1社 → 全社展開)

**期間**: Beta 1 週間 + 全社展開
**目的**: 本番顧客データに対し段階的にロールアウト

**Stage 3-A (Beta)**:
- 1 組織のみ `organization_id` を本番に投入
- 7 日間並走、CS 担当 1 名のみ操作
- 完了基準: 通常業務 1 サイクル (週次レビュー + 面談ログ + 健全度監視) が完走

**Stage 3-B (全社)**:
- 残り全組織を本番投入
- 翌日 9:00 に CS 全員にアナウンス
- 初日は 04 担当が **常駐監視** (Sentry / Slack / audit_logs)
- 完了基準: 7 日間で P0/P1 インシデント 0 件

**Go 基準 (3-A → 3-B)**:
- §F 全項目 完了
- §B / §C / §D 再実施で全 pass
- Beta 組織からのフィードバックで blocker 0 件

**No-go 条件**:
- §F の F-1 / F-3 / F-4 / F-7 / F-8 / F-10 のいずれか未完
- Beta 組織から「データが消えた」「権限が見えるべきデータが見えない」苦情
- audit_logs / Sentry に未対応の重大エラー

---

## Y. 関連 Runbook

- [00_index.md](00_index.md)
- [01_anthropic_key_rotation.md](01_anthropic_key_rotation.md) (F-1)
- [02_supabase_backup_restore.md](02_supabase_backup_restore.md) (F-12)
- [03_incident_response.md](03_incident_response.md) (Stage 3 常駐監視)
- [04_user_offboarding.md](04_user_offboarding.md) (G項チェック背景)
- [05_csp_enforcement.md](05_csp_enforcement.md) (F-11)
- [06_n_plus_1_audit.md](06_n_plus_1_audit.md) (A-3 N+1 確認背景)
- [07_churn_notification.md](07_churn_notification.md) (C / D)
- [08_rollback.md](08_rollback.md) (Stage 3 失敗時)
- [09_expansion_notification.md](09_expansion_notification.md) (C / D)

---

## Z. 完了サインオフ

各 Stage 完了時に以下を残す:

```
Stage X 完了 — YYYY-MM-DD HH:MM JST
実施者: <氏名>
チェック結果: §A/§B/§C/§D/§E/§F の pass 件数
判定: GO / NO-GO
備考: <該当事項>
```

→ `incidents/integration-stage-N-<日付>.md` に保存。
