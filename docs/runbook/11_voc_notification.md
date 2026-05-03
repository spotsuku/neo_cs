# VOC (Voice of Customer) Slack 通知 — 運用 / 検証

**対象**: `lib/notifications/voc.ts:dispatchPendingVocNotifications` + `lib/notifications/slack.ts:notifyVocItem` + `app/api/cron/voc-notify/route.ts` + `vercel.json` の cron。
**ステータス**: 配線完了 (2026-05-03)。
**位置づけ**: [09_expansion_notification.md](09_expansion_notification.md) と対称構造。本Runbookは差分のみ詳述。

---

## 1. パイプライン全体像

```
┌─────────────────────────────────────────────┐
│ 02 H項: VOC 抽出 (Gmail/面談/サーベイから手動or自動)│
│   (lib/domain/voc + vocItemRepo)             │  → voc_items テーブルに INSERT
└──────────┬──────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────┐
│ Vercel Cron (週次・水曜 09:00 JST) または 手動 GET          │
│   /api/cron/voc-notify                                   │
│   Authorization: Bearer ${CRON_SECRET}                   │
└──────────┬──────────────────────────────────────────────┘
           │ inFlight ロック → dispatchPendingVocNotifications()
           │
┌──────────▼──────────────────────────────────────────────┐
│ lib/notifications/voc.ts:notifyAndMarkVocItem            │
│   - notifiedAt 立っていればスキップ                          │
│   - priority='high' のみ通過                              │
│   - buildPayload (company / assigned / tags 解決)         │
└──────────┬──────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────┐
│ lib/notifications/slack.ts:notifyVocItem (typed)          │
│   - dedup (channel='slack:VOC', key=vocItemId)           │
│   - notifySlack('VOC', payload, dedupKey)                │
└──────────┬──────────────────────────────────────────────┘
           │ 200 OK
┌──────────▼──────────────────────────────────────────────┐
│ vocItemRepo.markNotified(id)                             │
└──────────────────────────────────────────────────────────┘
```

---

## 2. cron スケジュール

```json
{ "path": "/api/cron/voc-notify", "schedule": "0 0 * * 3" }
```

- **UTC 水曜 0:00 = JST 水曜 09:00** (週次)
- **意図的に他の通知 cron と曜日を分散**:
  - 月曜 09:00 → expansion-notify (週はじめに営業準備)
  - 水曜 09:00 → voc-notify (週中盤に開発バックログ反映)
  - 4時間毎 → churn-notify (即応必要)
- 受信側 (CS / 開発) の通知疲れを軽減

---

## 3. 多層防御

`notifyAndMarkVocItem` 1回で直列に効くガード:

1. `notifiedAt` チェック — 永続的「通知済」マーク (DB 側)
2. `priority === 'high'` 絞込
3. **dedup** (`channel='slack:VOC'`, `key=vocItemId`、driver=memory|supabase)
4. route 側 `inFlight` フラグ (同プロセス内同時起動防止)
5. **post 失敗時は dedup release** (TTL 内でも次回再送可能化)
6. **`markNotified` は post 成功時のみ実行** — 失敗時は再送可能

---

## 4. 動作確認手順

### 4-1. 前提準備

- [ ] Slack Workspace で `#cs-voc-test` チャンネル作成
- [ ] そのチャンネル用 incoming webhook 発行
- [ ] `.env.local` に設定:
  ```
  SLACK_WEBHOOK_URL_VOC=<test webhook>
  CRON_SECRET=dev-secret
  ```

### 4-2. シナリオA: mock seed → cron キック → Slack 受信

```sh
# 02 H項 vocItemRepo (mock) には起動時 seed あり想定
curl -s http://localhost:3000/api/cron/voc-notify \
  -H "Authorization: Bearer dev-secret" | jq .
# 期待: { status: "ok", attempted: N, notified: N, skipped: 0, failed: 0 }
```

Slack 受信メッセージ確認:
- header: `🔥 VOC: <企業名> (High)`
- 抜粋 (引用形式 `> ...`)
- context: ソース (アンケート/面談ログ/週次レビュー) / 担当 / タグ / 検出日時 JST
- (任意) 提案セクション
- actions: `📋 VOC を開く` (primary) / `🏢 企業カルテ` (companyId があれば)

### 4-3. シナリオB: 重複防止 (永続)

```sh
# 1回目 → notified=N
curl -s http://localhost:3000/api/cron/voc-notify -H "Authorization: Bearer dev-secret"
# 2回目 → 全件 skipped (notifiedAt + dedup の二重防御)
curl -s http://localhost:3000/api/cron/voc-notify -H "Authorization: Bearer dev-secret"
```

### 4-4. シナリオC: priority=med は通知されない

mock seed に `priority='med'` の VOC が含まれることを確認した上で cron 実行:
- `attempted` の総数 ≦ priority=high の件数
- `low_priority` でスキップされたものは次回も通知されない (priority を high に上げない限り)

### 4-5. シナリオD: 認証 / 同時実行

[07_churn_notification.md §3-4〜3-6](07_churn_notification.md) と同パターン。

---

## 5. オペレータ緊急キック

```sh
curl -i https://cs.neoacademia.jp/api/cron/voc-notify \
  -H "Authorization: Bearer ${CRON_SECRET_PROD}"
```

ユースケース:
- 「来週の開発スプリント計画前に新規 high VOC を確認したい」
- 02 H項側で priority を `med → high` に昇格した直後の即時通知
- Notion/Linear 等開発バックログとの同期確認

`notifiedAt` で阻まれるので **何度叩いても安全**。

---

## 6. 障害対応

[07_churn_notification.md §5](07_churn_notification.md) のテンプレ流用。VOC 特有の差分:

| 症状 | 確認点 |
|---|---|
| 通知が来ない | `select count(*) from voc_items where priority='high' and notified_at is null;` でキューを確認 |
| 件数 0 のまま | 02 H項側の `priority` 自動判定ロジック確認、しきい値見直し |
| 重複通知 | `notification_dedup` テーブルに `channel='slack:VOC'` の行が残っているか確認 |

---

## 7. 02 H項側との連携 (改修確認)

本Runbook策定時 (2026-05-03) で確認済み:

- `vocItemRepo.list({ priority: 'high', unNotifiedOnly: true })` が正しく high のみ返す
- `vocItemRepo.markNotified(id)` で `notified_at = now()` がセットされる
- `VocItemRecord` の必須フィールド (`id, sourceType, excerpt, tags, priority, companyId?, contractId?, assignedTo?, createdAt, notifiedAt?`) を `notifyVocItem(payload)` 経由で全て参照
- 旧 `notifySlack('CS_OPPORTUNITY', ...)` 経路は廃止 → typed `notifyVocItem` 経由に統一

---

## 8. 関連

- [00_index.md](00_index.md)
- [07_churn_notification.md](07_churn_notification.md) — 解約予兆 (通知時間軸: 即応 4h)
- [09_expansion_notification.md](09_expansion_notification.md) — エクスパンション (週次月曜)
- [10_integration_checklist.md](10_integration_checklist.md) §C-2 / §G — VOC 統合確認項目
