# Supabase バックアップ / リストア手順

**目的**: 全顧客データの復旧 RPO ≤ 24時間 / RTO ≤ 4時間 を担保する。
**実行者**: 情シス + DBA。リストアは必ず**営業時間内**かつ二者立ち会い。

---

## 1. バックアップの構成

| 種別 | 提供元 | 頻度 | 保持期間 | 用途 |
|---|---|---|---|---|
| **Point-in-Time Recovery (PITR)** | Supabase Pro 以上 | 連続 (WAL) | 7日 | 直近障害の細粒度復旧 |
| **日次論理ダンプ** | 自前バッチ (`pg_dump`) | 毎日 03:00 JST | 30日 (S3) | スキーマ変更前後の差分・長期保管 |
| **週次完全スナップショット** | Supabase + 自前 | 毎週日曜 04:00 JST | 90日 | 最終防衛線 |
| **audit_logs エクスポート** | アプリ Cron | 月次 | **7年** | 法務・電子帳簿保存法対応 |

> Supabase 無料/Standard プランでは PITR が無効。Pro 以上 (現契約状況の確認が前提) であることを月次で確認する。

---

## 2. 日次 pg_dump バッチ

```sh
# /opt/neocs/bin/backup.sh
set -euo pipefail
TS=$(date -u +%Y%m%dT%H%M%SZ)
DUMP="/tmp/neocs-${TS}.sql.gz"

PGSSLMODE=require \
pg_dump \
  --format=custom \
  --no-owner --no-privileges \
  --exclude-schema=auth --exclude-schema=storage --exclude-schema=realtime \
  "${DATABASE_URL}" \
  | gzip -9 > "${DUMP}"

aws s3 cp "${DUMP}" "s3://neocs-backups/daily/neocs-${TS}.sql.gz" \
  --sse AES256 --storage-class STANDARD_IA

# 整合性チェック (簡易): pg_restore --list が読めるか
gunzip -c "${DUMP}" | pg_restore --list > /dev/null

rm -f "${DUMP}"
echo "{\"kind\":\"backup_ok\",\"ts\":\"${TS}\"}"
```

- `auth/storage/realtime` スキーマは Supabase 管理領域なので除外。
- バッチ実行ホストは Vercel Cron か GitHub Actions (cron) を推奨。
- 失敗時は Slack `#cs-alerts` に通知 (ストリーム04 F項で実装予定)。

---

## 3. リストア手順

### A. PITR (直近の障害)

1. **Supabase Dashboard** → Database → Backups → "Restore to point in time"
2. **新規 Project** にリストア (本番上書き禁止)
3. 復旧先 Project の `DATABASE_URL` を取得
4. 必要データを **論理コピー** (下記 §C) で本番に書き戻す
5. 完了後、新規 Project は7日以内に削除 (コスト)

### B. pg_dump からのリストア (長期・スキーマ事故時)

```sh
gunzip -c /path/to/neocs-YYYYmmddTHHMMSSZ.sql.gz | \
  pg_restore --no-owner --no-privileges --clean --if-exists \
             --dbname="${TARGET_DATABASE_URL}"
```

- 本番への直接 `--clean` は禁止。必ず staging Project で実施し、確認後に論理コピー。

### C. 論理コピー (本番への書き戻し)

```sql
-- 例: companies テーブルだけ復元
truncate table companies cascade;  -- 必要なテーブル単位で慎重に
insert into companies select * from dblink('host=...staging...', 'select * from companies')
  as t(/* 列定義 */);
```

または `\copy` で CSV 中継。**必ず audit_logs に手動レコードを残す** (`source='migration'`, `reason='restore_<incident_id>'`)。

---

## 4. 復旧テスト (必須)

- **月次**: PITR を staging に復元して `select count(*)` 主要10テーブルを検証。
- **四半期**: 上記 + アプリケーションを staging に向けて 30 分の煙テスト (主要画面操作)。
- 結果は `docs/runbook/restore-tests/YYYY-Q?.md` に記録。テスト未実施が3ヶ月続いたらインシデント扱い。

---

## 5. 失敗時のエスカレーション

1. 一次対応 (情シス) が30分で復旧できない場合は CS責任者・経営に第一報 (Slack `#cs-incident`)
2. データ消失が確定的になったら、復旧不能範囲を `incidents/YYYY-MM-DD-<slug>.md` に時系列で記録
3. 顧客通知が必要な範囲については法務レビューを必ず通す (個情法26条)

---

## 6. 関連ファイル

- [00_index.md](00_index.md)
- [01_anthropic_key_rotation.md](01_anthropic_key_rotation.md)
- 03_incident_response.md (stub)
- 04_user_offboarding.md (stub)
