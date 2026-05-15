# 本番運用開始 チェックリスト

> 「コード側はゼロ状態 (2026-05-15)」を前提に、本番運用を開始するために**ユーザー側で実施が必要**な作業をまとめる。
>
> 各項目に ✅ チェックを入れながら進める。Claude が代わりに実行できないもののみ列挙 (DB 直接アクセス・Vercel 認証・Slack 等の外部サービス設定)。

---

## 🔴 必須 (これ無しに動かない)

### [ ] 1. Supabase DB に migration を適用

新規 3 本を順番に実行する。

```
0045_drive_send_logs.sql               (F4 送付履歴テーブル)
0046_ai_extraction_company_suggestion.sql  (AI 企業候補の extraction_type 追加)
0047_drive_send_logs_unique.sql        (送付履歴の dedup UNIQUE 制約)
```

**実行方法**:
- Supabase CLI: `supabase db push` (推奨)
- または Dashboard → SQL Editor で `supabase/migrations/0045_*.sql` 〜 `0047_*.sql` の中身を順次貼り付け実行

確認: `select count(*) from drive_send_logs;` が 0 で返れば OK

### [ ] 2. Vercel 環境変数の確認・追加

Vercel Dashboard → Project (neo-cs) → Settings → Environment Variables

**Production / Preview / Development 各環境に設定**:

| 変数 | 値 | 必須? |
|---|---|---|
| `REPO_DRIVER` | `supabase` | 必須 (本番) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL | 必須 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | 必須 |
| `SUPABASE_URL` | 上と同じ | 必須 |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | 必須 |
| `SUPABASE_PROJECT_REF` | project ref ID | 必須 |
| `INITIAL_ADMIN_EMAIL` | 初回ログインで admin 昇格させる Gmail | 推奨 |
| `ANTHROPIC_API_KEY` | Claude API key | 必須 (AI 機能) |
| `CRON_SECRET` | 32+ 文字のランダム値 | 必須 (cron 認証) |
| `ALLOWED_ORIGINS` | `https://cs.neoacademia.jp` 等 | 必須 |
| `NEXT_PUBLIC_APP_BASE_URL` | 本番 URL | 必須 |
| `NEO_CS_V2_URL` | 同上 | 必須 |
| `GOOGLE_CLIENT_ID` / `_SECRET` | OAuth provider (Supabase Auth) | OAuth login 必須 |
| `GOOGLE_HOSTED_DOMAIN` | `neoacademia.jp` (社外締め出し) | 推奨 |
| `NEXT_PUBLIC_GOOGLE_HOSTED_DOMAIN` | 同上 (client UI 用) | 推奨 |

**Drive 連携 (F4) を使う場合のみ追加**:
- `GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` (1 行で JSON 全体)
- `GOOGLE_DRIVE_SHARED_DRIVE_ID`
- `GOOGLE_DRIVE_TEMPLATE_FOLDER_ID`
- `GOOGLE_DRIVE_CUSTOMER_PARENT_FOLDER_ID`

**Slack 通知を使う場合のみ追加**:
- `SLACK_WEBHOOK_URL_CS_ALERTS` / `_CHURN_ALERTS` / `_EXPANSION` / `_VOC` / `_HANDOFF` 等

**観測性 (Sentry) を使う場合のみ追加**:
- `SENTRY_DSN`
- `SENTRY_TRACES_SAMPLE_RATE` (デフォルト 0.1)

完全な変数リストは [neo-cs-v2/.env.example](../../neo-cs-v2/.env.example) を参照。

### [ ] 3. 本番 deploy 確認

```bash
# 最新 main commit が deploy 済か確認
vercel ls

# 必要なら手動 deploy
vercel deploy --prod
```

または GitHub push で自動 deploy されているかを Vercel Dashboard で確認。

---

## 🟡 機能ごと有効化 (使う機能だけ)

### [ ] 4. Vercel Cron の有効化確認

Vercel Dashboard → Cron Jobs で以下 11 件が登録されているか:

| Path | Schedule (UTC) | 用途 |
|---|---|---|
| `/api/cron/gmail-sync` | `*/30 * * * *` | Gmail 受信同期 (30 分毎) |
| `/api/cron/churn-notify` | `0 */4 * * *` | 解約予兆通知 (4 時間毎) |
| `/api/cron/health-snapshots` | `30 17 * * *` | ヘルススコア算出 (日次 02:30 JST) |
| `/api/cron/kpi-snapshots` | `0 18 * * *` | KPI snapshot (日次 03:00 JST) |
| `/api/cron/expansion-notify` | `0 0 * * 1` | エクスパンション通知 (週次) |
| `/api/cron/voc-notify` | `0 0 * * 3` | VoC 通知 (週次) |
| `/api/cron/drive-backfill` | `0 1 * * 1` | Drive folder 補完 (週次) |
| `/api/cron/notifications-dispatch` | `0 23 * * *` | inbox 通知配信 (日次) |
| `/api/cron/dedup-cleanup` | `30 3 * * *` | dedup 履歴掃除 |
| `/api/cron/onboarding-overdue-notify` | `0 1 * * *` | オンボ期限超過通知 (日次 10:00 JST) |
| `/api/cron/unassigned-ai-suggest` | `15 */4 * * *` | 未割当 AI 候補 (4 時間毎) |

Vercel の Hobby plan では cron が 2 件まで制限されるので、本番は **Pro plan 以上** が必須。

### [ ] 5. health_score_snapshots / kpi_snapshots の初回投入

cron は次回自動実行時刻まで動かないので、初回は手動 GET:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://cs.neoacademia.jp/api/cron/health-snapshots

curl -H "Authorization: Bearer $CRON_SECRET" \
  https://cs.neoacademia.jp/api/cron/kpi-snapshots
```

ヘルススコアや経営ダッシュボードのデータが揃う。

### [ ] 6. Gmail OAuth 接続 (ユーザーごと)

各 CS スタッフがログイン後、`/settings/gmail` から自分の Gmail を接続する。
接続後、`/api/cron/gmail-sync` の次回実行で受信箱が同期される。

### [ ] 7. 初期 admin 昇格

`INITIAL_ADMIN_EMAIL` を設定した状態で、そのメールアドレスで初回ログイン → 自動で admin に昇格。

---

## 🟢 運用しながら整える

### [ ] 8. デモデータ行のクリーンアップ

`/settings/demo-data` 画面の **「デモデータ削除」ボタン** で `is_demo=true` の行を一括削除。

mock 駆動 (REPO_DRIVER=mock) で開発時に投入されたデモが DB に紛れているかをここで掃除する。

### [ ] 9. 実データの投入

- 企業 (`/companies/new` から登録)
- 契約 (各企業詳細 → 契約 CRUD)
- 期 (`/programs` → 期作成)
- アンケート (`/surveys/import` で CSV 取込)
- 等

### [ ] 10. Slack 通知の動作確認

Slack webhook が設定されていれば、最初の解約予兆 / VoC / expansion / handoff が通知されるか確認。

---

## 🆘 巻き戻し

問題が起きた時の安全網:

- 直近の安全点 tag: `pre-demo-cleanup-2026-05-15`
- アーカイブブランチ: `archive/demo-dataset`
- 旧 v1 ブランチ: `archive/v1-legacy`

```bash
# 緊急 revert (例: Tailwind 4 で深刻な visual breakage)
git revert <commit-hash>
git push origin main
```

詳細: [08_rollback.md](08_rollback.md)
