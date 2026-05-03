# エクスパンション機会 Slack 通知 — 運用 / 検証

**対象**: `lib/notifications/expansion.ts:dispatchPendingExpansionNotifications` + `lib/notifications/slack.ts:notifyExpansionOpportunity` + `app/api/cron/expansion-notify/route.ts` + `vercel.json` の cron。
**ステータス**: 配線完了 (2026-05-03)。本番でも稼働中 (Slack webhook URL 設定済の場合)。
**位置づけ**: [07_churn_notification.md](07_churn_notification.md) の対称構造。本Runbookは差分のみ詳述。

---

## 1. パイプライン全体像

```
┌─────────────────────────────────────────────┐
│ 02 F項: エクスパンション検知 (週次バッチ)      │
│   (lib/domain/expansion + repo)             │  → expansion_opportunities テーブルに INSERT
└──────────┬──────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────┐
│ Vercel Cron (週次・月曜 09:00 JST) または 手動 GET         │
│   /api/cron/expansion-notify                             │
│   Authorization: Bearer ${CRON_SECRET}                   │
└──────────┬──────────────────────────────────────────────┘
           │ inFlight ロック → dispatchPendingExpansionNotifications()
           │
┌──────────▼──────────────────────────────────────────────┐
│ lib/notifications/expansion.ts:notifyAndMarkExpansionOpportunity │
│   - openOnly + unNotifiedOnly + score ≥ THRESHOLD のみ通過  │
│   - notifiedAt 立っていればスキップ                          │
│   - closedAt 立っていればスキップ                            │
│   - buildPayload (company / health / ownerName 解決)       │
└──────────┬──────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────┐
│ lib/notifications/slack.ts:notifyExpansionOpportunity     │
│   - dedup (acquireDedup channel='slack:EXPANSION', key)   │
│   - notifySlack('EXPANSION', payload, dedupKey)           │
└──────────┬──────────────────────────────────────────────┘
           │ 200 OK
┌──────────▼──────────────────────────────────────────────┐
│ expansionOpportunityRepo.markNotified(id)                │
└──────────────────────────────────────────────────────────┘
```

---

## 2. cron スケジュール

```json
{ "path": "/api/cron/expansion-notify", "schedule": "0 0 * * 1" }
```

- **UTC 月曜 0:00 = JST 月曜 09:00** (週次)
- 解約予兆 (4時間毎) と違い、エクスパンションは時系列性が低く週次で十分
- 営業日の朝に出ることで、その週の打ち合わせ準備に活用しやすい
- Vercel Cron が `Authorization: Bearer ${CRON_SECRET}` を自動付与

### なぜ週次か

| 観点 | 解約予兆 | エクスパンション |
|---|---|---|
| 緊急性 | 高 (放置すれば顧客喪失) | 中 (機会は数週間〜数か月窓) |
| 通知頻度 | 4時間毎 (即応必要) | 週次 (営業準備サイクルに同期) |
| 想定件数 | 1日数件 | 週数件 〜 月数件 |
| 受信疲れリスク | 高 (severity threshold で抑制) | 低 (件数自体が少ない) |

---

## 3. 多層防御

`notifyAndMarkExpansionOpportunity` 1回の呼び出しで以下が直列に効く:

1. `closedAt` チェック — 既に商談クローズ済の機会は通知しない
2. `notifiedAt` チェック — 永続的な「通知済」マーク
3. `score >= EXPANSION_NOTIFY_THRESHOLD` — 02側の閾値で低スコア除外
4. **dedup** (channel=`slack:EXPANSION`, key=`opportunityId`) — driver=memory|supabase
5. `inFlight` フラグ (route 側) — 同プロセス内同時起動防止
6. **post 失敗時は dedup release** — TTL 内でも次回再送可能化 (slack.ts §post 失敗ハンドリング)

→ 結果: **二重通知の発生確率は実質ゼロ**、かつ通知失敗時の取りこぼしも回避。

---

## 4. 動作確認手順

### 4-1. 前提準備

- [ ] Slack Workspace で **#cs-expansion-test** チャンネル作成
- [ ] そのチャンネル用 incoming webhook 発行
- [ ] `.env.local` に設定:
  ```
  SLACK_WEBHOOK_URL_EXPANSION=<test webhook>
  CRON_SECRET=dev-secret
  ```
- [ ] `npm run dev` で起動

### 4-2. シナリオA: mock seed → cron キック → Slack 受信

```sh
# 02 D項 + F項 の expansionOpportunityRepo (mock) には起動時 seed あり想定
curl -s http://localhost:3000/api/cron/expansion-notify \
  -H "Authorization: Bearer dev-secret" | jq .
# 期待: { status: "ok", attempted: N, notified: N, skipped: 0, failed: 0 }
```

Slack 受信メッセージ確認:
- header: `🚀 エクスパンション機会: <企業名>`
- 1行 reason
- context: 担当 mention / 健全度 / 想定アップセル / 検知時刻 JST
- 根拠箇条書き (最大5件)
- actions: `🔍 ダッシュボードを開く` (primary) / `✋ 営業に連携`

### 4-3. シナリオB: 重複防止 (永続)

```sh
# 1回目 → notified=N
curl -s http://localhost:3000/api/cron/expansion-notify -H "Authorization: Bearer dev-secret"
# 2回目 → 全件 skipped (notified_at で阻止 + dedup でも阻止の二重防御)
curl -s http://localhost:3000/api/cron/expansion-notify -H "Authorization: Bearer dev-secret"
```

### 4-4. シナリオC: post 失敗 → 再送可能

```sh
# webhook URL を不正値に
SLACK_WEBHOOK_URL_EXPANSION=https://hooks.slack.com/services/INVALID npm run dev
curl -s http://localhost:3000/api/cron/expansion-notify -H "Authorization: Bearer dev-secret"
# 期待: failed > 0、notified_at は立たない、dedup も release されている
# webhook URL を正しい値に戻して再キック → notified が増える
```

### 4-5. シナリオD: 認証 / 同時実行

[07_churn_notification.md §3-4〜3-6](07_churn_notification.md) と同パターン (route 構造が同じため省略)。

---

## 5. オペレータ緊急キック

```sh
curl -i https://cs.neoacademia.jp/api/cron/expansion-notify \
  -H "Authorization: Bearer ${CRON_SECRET_PROD}"
```

ユースケース:
- 「来週の営業会議までに今週分が必要」
- 02 D項側の検知バッチを手動再実行した直後の即時通知

新規シグナルにのみ作用 (`notifiedAt` で阻まれる) ので**安全に何度でも叩ける**。

---

## 6. 障害対応

[07_churn_notification.md §5](07_churn_notification.md) の3パターン (通知来ない / 多重送 / 遅延) と完全対称。差分は以下のみ:

| 症状 | expansion 特有の確認点 |
|---|---|
| 通知が遅い (1週間以上) | cron 頻度を `0 0 * * 1,4` (月木) に増やす検討。コスト増・受信疲れトレードオフ |
| 件数が常に 0 | `EXPANSION_NOTIFY_THRESHOLD` (02 F項) を下げる検討。02担当に確認 |

---

## 7. 関連

- [00_index.md](00_index.md)
- [07_churn_notification.md](07_churn_notification.md) — 解約予兆通知 (同パターンの兄弟)
- [08_rollback.md](08_rollback.md)
- ストリーム02 F項実装 — `lib/notifications/expansion.ts` / `lib/domain/expansion.ts` (本Runbookの上流)
