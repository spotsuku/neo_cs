-- ============================================================
-- 0008_notification_dedup.sql
-- ストリーム01 P1: notification_dedup テーブル (申し送り t)
--
-- ストリーム04 docs/runbook/07_churn_notification.md §4 中期計画で待たれて
-- いた dedup 用テーブル。Slack 通知などの重複防止 (channel × key で
-- 一定期間 TTL) を Postgres で永続化する。
--
-- 現行は in-memory dedup で水平スケール時に各インスタンスで多重通知が
-- 発生し得る。本テーブルに移行するとリージョン横断で唯一性を担保できる。
--
-- アクセスポリシー: write/read 共に service_role 専用 (RLS バイパス)。
-- アプリ側の通知ドライバ (lib/notifications/*) のみが service_role で書込み。
-- ============================================================

create table notification_dedup (
  channel     text not null,
  key         text not null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  primary key (channel, key)
);

-- 期限切れ削除バッチ (pg_cron / Vercel Cron / アプリ起動時掃除) 用
create index notification_dedup_expires_idx
  on notification_dedup(expires_at);

-- ============================================================
-- 期限切れエントリの削除関数
-- (pg_cron が使える環境では `select cron.schedule(...)` で定期実行する。
--  使えない場合は Vercel Cron から POST /api/cron/cleanup-dedup で叩く)
-- ============================================================
create or replace function notification_dedup_cleanup()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from notification_dedup where expires_at < now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- ============================================================
-- RLS: service_role 専用 (write/read 共)
-- ============================================================
alter table notification_dedup enable row level security;

-- authenticated には何もポリシーを付けない (= 拒否)。
-- service_role は RLS バイパスでアクセスする。
-- 念のため明示的に block ポリシーは作らない (拒否がデフォルト)。

-- ============================================================
-- END 0008
-- ============================================================
