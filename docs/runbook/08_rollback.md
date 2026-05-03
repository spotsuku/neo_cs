# ロールバック手順

**目的**: デプロイ・マイグレーション・シークレット変更で本番が壊れた際、最短時間で「直前の動いていた状態」に戻す。
**判断者**: IC (インシデントコマンダ、[03_incident_response.md](03_incident_response.md))。
**SLA**: 検知から **15分以内** にロールバック完了 (P0)。

---

## 0. 何をロールバックするのか

リリースは複数のレイヤから成り、それぞれ独立に戻せる。**まず壊れたレイヤを特定**してから対応する:

| レイヤ | 戻し方 | 影響 |
|---|---|---|
| **Vercel デプロイ (Next.js v2)** | `vercel rollback` | 全UI/Route Handler が直前バージョンに戻る |
| **DB マイグレーション (Supabase)** | down マイグレーション or PITR | スキーマ・データ両方戻る可能性あり |
| **環境変数 / シークレット** | Vercel env を直前値に戻し再デプロイ | 即時 |
| **Vercel Cron** | `vercel.json` の crons を空にして再デプロイ | 定期処理停止 |
| **Slack / GitHub App 連携** | App 側の trigger を OFF | 通知のみ停止、本番は無傷 |

---

## 1. Vercel デプロイ ロールバック

### 1-1. CLI

```sh
# 1) 現在の本番デプロイ ID を控える
vercel ls --prod --scope <team>

# 2) 直前の安定版 URL を選んでロールバック
vercel rollback https://neo-cs-v2-<prev-hash>.vercel.app --token=$VERCEL_TOKEN
```

### 1-2. ダッシュボード

1. Vercel Dashboard → Project → Deployments
2. 直前の安定版 (緑チェックがある古いコミット) を選択
3. `...` → "Promote to Production"

**所要時間**: ダッシュボード操作で 30 秒、CDN 反映まで 1-2 分。

### 1-3. 検証

```sh
curl -sI https://cs.neoacademia.jp/api/health | grep -i x-vercel-id
# x-vercel-id ヘッダのデプロイ ID が想定の旧 ID であることを確認

curl -s https://cs.neoacademia.jp/api/health?deep=1 | jq .
# checks.* が all "ok" であること
```

---

## 2. DB マイグレーション ロールバック

### 2-1. 単純な ADD COLUMN / ADD INDEX のロールバック

```sql
-- 例: 0003_xxx.sql で追加した列を戻す
alter table companies drop column if exists experimental_flag;
drop index if exists companies_experimental_idx;
```

各マイグレーション PR には **対応する down SQL** を `supabase/migrations/<n>_<name>_down.sql` で同梱する規約 (P1運用ルール)。

### 2-2. データを伴う変更のロールバック (PITR)

データ変更を含むマイグレーションが本番で問題を起こした場合、down SQL では戻せない。**PITR で問題発生直前に時刻指定リストア**:

→ [02_supabase_backup_restore.md §3-A](02_supabase_backup_restore.md) を参照。リストア先は staging Project に作り、必要レコードを論理コピー。

### 2-3. ロールバック禁止のマイグレーション

以下は不可逆 (= ロールバックではなく前進修正で対応):

- `audit_logs` への INSERT (改ざん不可制約)
- 顧客通知済みのデータ削除
- 公開済みの新エンドポイント URL 変更 (互換維持で対応)

---

## 3. 環境変数 / シークレット ロールバック

### 3-1. Vercel env 復元

```sh
# 1) 既存値を確認
vercel env ls production --token=$VERCEL_TOKEN

# 2) 上書き (新値)
echo "<old-value>" | vercel env add SOME_KEY production --token=$VERCEL_TOKEN --force

# 3) 再デプロイ (env 変更は再デプロイで反映)
vercel --prod --token=$VERCEL_TOKEN
```

### 3-2. 漏洩キーの緊急失効 + ロールバックの順序

**順序を間違えると新キーで失敗 → 旧キーも無効、で全断**になる。必ず以下の順:

1. **新キー発行** (Anthropic Console / Supabase Dashboard 等)
2. **Vercel env を新キーに置換**
3. **再デプロイ + 疎通確認** (`/api/health?deep=1`)
4. **旧キー失効** (←最後)

参考: [01_anthropic_key_rotation.md](01_anthropic_key_rotation.md) の手順 5 の Revoke タイミング。

---

## 4. Vercel Cron 緊急停止

[vercel.json](../../neo-cs-v2/vercel.json) の crons 配列を空にして再デプロイ:

```json
{ "crons": [] }
```

→ `vercel --prod` で 1〜2 分以内に cron 停止。手動キックは継続可能 (Authorization Bearer)。

---

## 5. ロールバック判断のチェックリスト

ロールバック前に **5 分以内に以下を確認**:

- [ ] エラー再現可能か (curl / ブラウザで)
- [ ] 影響範囲 (全顧客 / 特定顧客 / 特定機能)
- [ ] 直前の安定版が **本当に動いていたか** (deploy ログと metrics 両方確認)
- [ ] DB マイグレーションを含む場合、ロールバックでデータ整合性が崩れないか
- [ ] 顧客通知が必要か (P0 でデータ影響あれば必要)

判断に迷ったら **戻す方を優先**。前進修正は時間が読めない。

---

## 6. ロールバック後の必須アクション

1. Slack `#cs-incident` に「ロールバック完了」を投稿 (時刻 + 戻したデプロイ ID)
2. `incidents/<日付>-<slug>.md` に時系列を追記
3. **24時間以内** に再発防止策 PR を上げる (`vercel rollback` した状態のまま放置しない)
4. 影響顧客への通知 (法務確認後)
5. ポストモーテム実施 ([03_incident_response.md §6](03_incident_response.md))

---

## 7. 関連

- [00_index.md](00_index.md)
- [01_anthropic_key_rotation.md](01_anthropic_key_rotation.md)
- [02_supabase_backup_restore.md](02_supabase_backup_restore.md)
- [03_incident_response.md](03_incident_response.md)
