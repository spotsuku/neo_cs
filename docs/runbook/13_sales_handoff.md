# 営業 → CS 引継ぎ webhook — 運用 / 検証 / トラブルシュート

**対象**:
- `app/api/integrations/sales/handoff/route.ts` (受信エンドポイント)
- `lib/integrations/sales-handoff.ts` (純関数: validate + map)
- `lib/notifications/sales-handoff.ts` (Slack 通知)
- `supabase/migrations/0017_sales_handoffs.sql` (受信履歴テーブル)
- `app/sales-handoff/*` (UI)

**ステータス**: Phase4-#6 初期投入 (2026-05-03)。Drive 自動作成は Phase4-#5 で連結。

---

## 1. 全体像

```
neo-sales (Deal status='accepted' = 内諾)
   │  POST /api/integrations/sales/handoff
   │  Authorization: Bearer ${SALES_HANDOFF_SECRET}
   │  Idempotency-Key: <deal_id>
   ▼
neo-cs Webhook ハンドラ
   ├── 1. 認証 / Idempotency-Key in-memory チェック
   ├── 2. validatePayload (lib/integrations/sales-handoff.ts)
   ├── 3. sales_handoffs.sales_deal_id 既存チェック → duplicate なら 200 で skip
   ├── 4. companies / company_contacts / contracts INSERT
   ├── 5. assignments (sales_owner.email を app_users から逆引き → secondary)
   ├── 6. sales_handoffs に status='processed' で記録
   └── 7. Slack #cs-handoff に通知 (失敗しても 200)
```

**多重防御**:
1. アプリ側: Idempotency-Key + inFlight ロック (24h memory)
2. DB側: `sales_handoffs.sales_deal_id` UNIQUE
3. 通知側: Slack dedupKey=`handoff:<dealId>` (24h)

---

## 2. 環境変数

| 変数 | 用途 | 例 |
|---|---|---|
| `SALES_HANDOFF_SECRET` | webhook Bearer トークン | 32文字以上のランダム |
| `SLACK_WEBHOOK_URL_HANDOFF` | 通知先 (#cs-handoff) | `https://hooks.slack.com/services/...` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | DB アクセス | (既存) |
| `NEXT_PUBLIC_APP_BASE_URL` | dashboardUrl 構築 | `https://cs.neoacademia.jp` |

`.env.example` に追記済。Vercel 本番には別途設定。

---

## 3. ローカル疎通確認 (curl)

### 3-1. 起動

```sh
cd neo-cs-v2
echo "SALES_HANDOFF_SECRET=dev-handoff-secret" >> .env.local
# 任意: Slack 検証用の test webhook
echo "SLACK_WEBHOOK_URL_HANDOFF=https://hooks.slack.com/services/T.../B.../xxx" >> .env.local
npm run dev
```

### 3-2. 正常系 POST

```sh
curl -i http://localhost:3000/api/integrations/sales/handoff \
  -H "Authorization: Bearer dev-handoff-secret" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: deal_demo_001" \
  -d '{
    "salesDealId": "deal_demo_001",
    "company": { "name": "デモ商事", "industry": "製造業", "size": "300-1000", "website": "https://demo.example" },
    "primaryContact": { "name": "山田太郎", "email": "yamada@demo.example", "role": "経営企画部 部長", "phone": "092-000-0000" },
    "contract": { "productCode": "academia", "courseCode": "pjt", "startDate": "2026-06-01", "termMonths": 12, "amountJpy": 1200000 },
    "salesOwner": { "email": "k_furuno@sportsnation.jp" },
    "notes": "決裁者は経営企画担当役員。月次定例で進捗共有を希望。",
    "occurredAt": "2026-05-04T03:00:00Z"
  }'
# 期待: 200 { "status": "ok", "companyId": "co_...", "contractId": "ctr_...", "handoffId": "...", ... }
```

### 3-3. 重複確認

```sh
# 同じ salesDealId で再送 → DB UNIQUE で弾かれて duplicate
curl -s http://localhost:3000/api/integrations/sales/handoff \
  -H "Authorization: Bearer dev-handoff-secret" \
  -H "Content-Type: application/json" \
  -d '{ ... 同じ salesDealId="deal_demo_001" ... }'
# 期待: 200 { "status": "duplicate", "handoffId": "...", "companyId": "..." }

# Idempotency-Key だけ同値で本文も同じ → 200 duplicate (idempotency_key)
curl -s ... -H "Idempotency-Key: deal_demo_001" -d '...'
```

### 3-4. 認証エラー

```sh
curl -i http://localhost:3000/api/integrations/sales/handoff
# 期待: 401 { "error": "unauthorized" }

curl -i http://localhost:3000/api/integrations/sales/handoff -H "Authorization: Bearer wrong"
# 期待: 401

unset SALES_HANDOFF_SECRET; npm run dev
curl -i ... -H "Authorization: Bearer anything"
# 期待: 503 { "error": "misconfigured" }
```

### 3-5. validation エラー

```sh
curl -i ... -d '{ "salesDealId": "" }'
# 期待: 400 { "error": "validation_failed", "details": [...] }
```

---

## 4. UI 確認

`/sales-handoff` を admin/manager で開く:
- 受信履歴がテーブル表示
- status フィルタ (received / processed / failed / duplicate)
- 詳細 → `/sales-handoff/[id]` で payload と作成リソースを表示

---

## 5. 障害対応

### 5-1. 「webhook が 401 で弾かれる」
- Vercel env の `SALES_HANDOFF_SECRET` と neo-sales の `NEO_CS_HANDOFF_SECRET` が一致しているか
- ローテ手順: 両側に新値投入 → 旧値廃止 (短時間の二重受付期間を許容)

### 5-2. 「companies INSERT で失敗 (status='failed')」
- `error_detail` 欄に Postgres エラー文字列が入る
- 多くは industry / memo の制約違反 or organization_id の不整合
- 手動再投入: `/sales-handoff` で該当行を確認 → neo-sales 側で再送 (同 salesDealId は UNIQUE で弾かれるため、failed 行を先に DELETE 必要)

### 5-3. 「Slack 通知が来ない」
- `vercel logs --filter="api/integrations/sales/handoff"` → `slack_notify_failed` を確認
- webhook URL 未設定なら `slack_fallback` ログのみ。本処理 (DB INSERT) は完了しているので業務影響なし

### 5-4. 「Drive フォルダが作成されない」
- Phase4-#5 未実装のため現状は **expected**。`drive_folder_url` は NULL のまま、UI で「自動作成 待ち」を表示
- Phase4-#5 完了後、cron か Server Action で `drive_folder_url` を埋める

---

## 6. neo-sales 側の連携状況

詳細: [`docs/sales-handoff-integration.md`](../sales-handoff-integration.md)

要点:
- neo-sales は `CompanyProgramDeal.status` を持つが「内諾」を表す ENUM 値が未確定
- 提案: `status='accepted'` または `agreedAmount=true && agreedTiming=true` の遷移を hook
- `lib/integrations/cs-handoff.ts` を新設し fetch する設計案を docs に記載

---

## 7. 関連
- [10_integration_checklist.md](10_integration_checklist.md)
- [12_initial_production_setup.md](12_initial_production_setup.md)
- `roadmap/02_機能改修_完了報告.md` Phase4-#6
