# 解約予兆 Slack 通知 — 運用 / 検証 / dedup 進化計画

**対象**: `lib/notifications/slack.ts:notifyChurnSignal` + `lib/notifications/churn.ts:dispatchPendingChurnNotifications` + `app/api/cron/churn-notify/route.ts` + `vercel.json` の cron。
**ステータス**: F項稼働中 (in-memory dedup フェーズ)

---

## 1. 通知パイプライン全体像

```
┌─────────────────────┐
│ 02 D項: 検知バッチ   │  → churn_signals テーブル に severity 付き INSERT
│  (lib/domain/churn) │
└──────────┬──────────┘
           │
┌──────────▼─────────────────────────────────────────────┐
│ Vercel Cron (4時間毎) または 手動 GET                    │
│   /api/cron/churn-notify (Bearer ${CRON_SECRET})        │
└──────────┬─────────────────────────────────────────────┘
           │ in-flight ロック → dispatchPendingChurnNotifications()
           │
┌──────────▼─────────────────────────────────────────────┐
│ lib/notifications/churn.ts:notifyAndMarkChurnSignal     │
│   - severity=high のみ通過                              │
│   - notified_at 立っていればスキップ                     │
│   - buildPayload (company / health / ownerName 解決)    │
└──────────┬─────────────────────────────────────────────┘
           │
┌──────────▼─────────────────────────────────────────────┐
│ lib/notifications/slack.ts:notifyChurnSignal            │
│   - in-memory dedup (24h, key=churn:<signalId>)         │
│   - notifySlack('CHURN_ALERTS', payload, dedup)         │
│     - fetchHard timeout 5s + retry 2回                  │
│     - Webhook URL 未設定で no-op + stderr               │
└──────────┬─────────────────────────────────────────────┘
           │ 200 OK
┌──────────▼─────────────────────────────────────────────┐
│ churnSignalRepo.markNotified(id) → notified_at = now()  │
└────────────────────────────────────────────────────────┘
```

**多重防御**:
1. DB側: `notified_at` 更新で同一シグナル再送阻止 (永続)
2. アプリ側: `slack.ts` の dedupMemo (24h, in-memory)
3. ルート側: `inFlight` フラグで同時バッチ起動を一次防止

---

## 2. 起動スケジューリング

### 2-1. Vercel Cron

`neo-cs-v2/vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/churn-notify", "schedule": "0 */4 * * *" }
  ]
}
```

- 4時間毎 (00:00 / 04:00 / 08:00 / 12:00 / 16:00 / 20:00 UTC)
- 解約予兆は変化が緩やかなため毎時不要。逆に遅すぎても初動遅延のリスク
- Vercel は cron 実行時に `Authorization: Bearer ${CRON_SECRET}` を自動付与
- 環境: 本番のみ有効。Preview デプロイでは cron 走らない (Vercel 仕様)

### 2-2. なぜ instrumentation.ts を使わないか

`instrumentation.register()` は **サーバー起動時に1回**しか呼ばれない (Next.js仕様)。サーバーレス関数の cold/warm 切替えで挙動が読めず、4時間毎の定期実行には不適。Cron は外部から URL を叩く構成が標準。

### 2-3. 開発環境での手動キック

```sh
# .env.local に CRON_SECRET=dev-secret 設定後
curl -i http://localhost:3000/api/cron/churn-notify \
  -H "Authorization: Bearer dev-secret"
# → 200 { "status": "ok", "attempted": 3, "notified": 3, "skipped": 0, "failed": 0 }
```

成功時の応答に `attempted/notified/skipped/failed` が含まれるので、回帰テストの assertion に使える。

### 2-4. オペレータ緊急キック

```sh
curl -i https://cs.neoacademia.jp/api/cron/churn-notify \
  -H "Authorization: Bearer ${CRON_SECRET_PROD}"
```

- 「直近の検知が反映されていない」とき
- 通知漏れの再送 (新規シグナルにのみ作用、既通知は notified_at で阻まれるので安全)

---

## 3. 通知フロー動作確認手順 (初回 + 月次回帰)

### 3-1. 前提準備

- [ ] Slack Workspace で **#cs-churn-test** チャンネルを作成 (本番チャンネルで検証しない)
- [ ] そのチャンネル用の incoming webhook を発行
- [ ] `.env.local` に `SLACK_WEBHOOK_URL_CHURN_ALERTS=<test webhook>` を設定
- [ ] `CRON_SECRET=dev-secret` も設定
- [ ] `npm run dev` で起動

### 3-2. シナリオA: mock の起動時 seed 検知 → 通知

```sh
# 1) 検知 (02 D項のバッチを呼ぶ Server Action なり Route なり)
#    現状は churnSignalRepo (mock) が起動時 seed で red 契約から severity=high を生成済
# 2) 通知バッチを叩く
curl -s http://localhost:3000/api/cron/churn-notify \
  -H "Authorization: Bearer dev-secret" | jq .
# 期待: status=ok, notified > 0
# 3) Slack #cs-churn-test に Block Kit メッセージが届くこと
#    - header に severity emoji (🔴) と企業名
#    - reason 1行
#    - context (担当 / 健全度 / JST時刻)
#    - 根拠の箇条書き
#    - actions (Dashboard / 24hスヌーズ / 対応中)
```

### 3-3. シナリオB: 重複防止確認

```sh
# 同じバッチを連続2回叩く
curl -s http://localhost:3000/api/cron/churn-notify -H "Authorization: Bearer dev-secret"
curl -s http://localhost:3000/api/cron/churn-notify -H "Authorization: Bearer dev-secret"
# 期待: 1回目 notified=N、2回目 notified=0, skipped=N (notified_at で弾かれる)
# Slack 側にも2通目は来ない
```

### 3-4. シナリオC: Slack 障害シミュレーション

```sh
# webhook URL を不正値にする
SLACK_WEBHOOK_URL_CHURN_ALERTS=https://hooks.slack.com/services/INVALID npm run dev
curl -s http://localhost:3000/api/cron/churn-notify -H "Authorization: Bearer dev-secret"
# 期待: failed > 0、notified_at は立たない (再送可能)
# 次回 cron で再送される
```

### 3-5. シナリオD: 認証

```sh
# 無トークン
curl -i http://localhost:3000/api/cron/churn-notify
# 期待: 401 unauthorized

# 不正トークン
curl -i http://localhost:3000/api/cron/churn-notify -H "Authorization: Bearer wrong"
# 期待: 401 unauthorized

# CRON_SECRET 未設定
unset CRON_SECRET; npm run dev
curl -i http://localhost:3000/api/cron/churn-notify -H "Authorization: Bearer anything"
# 期待: 503 misconfigured
```

### 3-6. シナリオE: 同時実行ロック

```sh
# 並列で2リクエスト (バッチ実処理は数秒以上かかる前提で再現確認)
curl -s http://localhost:3000/api/cron/churn-notify -H "Authorization: Bearer dev-secret" &
curl -s http://localhost:3000/api/cron/churn-notify -H "Authorization: Bearer dev-secret" &
wait
# 期待: 1リクエストは status=skipped, reason=concurrent_run
```

### 3-7. 月次回帰

毎月1日に上記シナリオA/B/Eを staging で実施し、通知件数と Slack 受信を確認。
記録: `docs/runbook/notification-tests/YYYY-MM.md` (未整備、初回実施時に作成)

---

## 4. dedup の本番進化計画

### 4-1. 現状 (in-memory dedup) の限界

| 項目 | 内容 |
|---|---|
| **格納先** | `slack.ts` の `dedupMemo: Map<string, number>` |
| **TTL** | 24時間 |
| **永続性** | プロセス再起動で消失 |
| **マルチインスタンス整合性** | なし — Vercel の region/instance が分かれた瞬間に同時通知の可能性 |

→ 短期は **DB 側の `churn_signals.notified_at`** が確定的な多重防御として効くため運用可。Vercel Cron の同時実行は通常起きないが、手動キック + Cron 同時の場合に in-memory が無力化する瞬間がある。

### 4-2. 中期: Supabase 永続 dedup (推奨ファーストステップ)

別テーブル `notification_dedup` を 0003 マイグレーションで追加。

```sql
create table notification_dedup (
  channel    text not null,                          -- 'CHURN_ALERTS' 等
  dedup_key  text not null,                          -- 'churn:<signalId>'
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (channel, dedup_key)
);
create index notification_dedup_expires_idx
  on notification_dedup(expires_at);

-- 期限切れの掃除 (cron で日次)
-- delete from notification_dedup where expires_at < now();
```

`slack.ts` の `notifySlack()` を:
1. INSERT を試行 → 主キー衝突なら "already notified" として 0件返却
2. 衝突なしなら通知続行
3. 通知失敗時は INSERT した行を DELETE (再送可能化)

→ アプリ全インスタンスで一貫した dedup。落差: DB ラウンドトリップ +1。

### 4-3. 長期: Upstash Redis (高頻度通知の場合)

エクスパンション通知/インシデント通知が増えて毎分大量 → Supabase に書く負荷が嫌になったら Upstash Redis (Vercel 連携簡単) に移行。

```ts
// 案: SETNX <channel>:<key> 1 EX 86400 で原子的に dedup
const ok = await redis.set(`${channel}:${key}`, "1", { nx: true, ex: 86400 });
if (!ok) return false; // already notified
```

`lib/notifications/dedup.ts` という抽象を切り、driver を `memory|supabase|redis` で切替えれば段階移行が容易。

### 4-4. 切替判断の閾値

| 指標 | 中期 (Supabase) へ移行 | 長期 (Redis) へ移行 |
|---|---|---|
| 通知件数 | 1日 5件超 | 1分 5件超 |
| サービスインスタンス数 | 2以上 (Vercel multi-region) | 同左 |
| 二重通知の苦情 | 1件でも発生したら | — |
| dedupMemo のメモリ | (常時 1MB 未満なら維持OK) | 100KB 超で要検討 |

→ **現状は中期 (Supabase) への準備を始めるのが妥当**。02のリポジトリ層が Supabase 実装に切り替わる際に同時投入推奨。

---

## 5. 障害対応

### 5-1. 「Slack に通知が来ない」

1. `vercel logs --filter="api/cron/churn-notify"` で cron 起動を確認
2. ログに `slack_fallback` が出ていれば webhook URL 未設定 → Vercel env を確認
3. ログに `slack_post_failed` が出ていれば webhook URL が無効 → Slack App 側で再発行
4. 認証エラー (401) が連続 → Vercel が `CRON_SECRET` を更新できていない → 環境変数再設定 + redeploy

### 5-2. 「同じ通知が複数回来る」

1. `select notified_at, count(*) from churn_signals where notified_at is not null group by notified_at having count(*) > 1` で多重 INSERT を確認
2. in-memory dedup の限界に当たっている可能性 → §4-2 の Supabase 永続 dedup に移行
3. 02 側の検知バッチが二重起動していないか (同 signalId が複数件生成) を確認

### 5-3. 「通知が遅い (検知 → 通知に4時間以上)」

1. cron 頻度の見直し (4時間毎 → 1時間毎)。ただしコストとノイズ増のトレードオフ
2. severity=critical のみ即時通知 (検知バッチ完了直後に直接 dispatchPendingChurnNotifications を呼ぶ Server Action) に切り替え

---

## 6. 関連

- [00_index.md](00_index.md)
- [03_incident_response.md](03_incident_response.md)
- [04_user_offboarding.md](04_user_offboarding.md)
- [06_n_plus_1_audit.md](06_n_plus_1_audit.md)
- `roadmap/04_運用セキュリティ_完了報告.md` §11
