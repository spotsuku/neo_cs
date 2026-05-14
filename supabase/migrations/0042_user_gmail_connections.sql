-- ============================================================
-- 0042: ユーザ単位 Gmail OAuth 接続 (user_gmail_connections)
--   - 各 CS メンバーが「Gmail に接続」ボタンから自分のアカウントを連携
--   - refresh_token を保持して periodic sync で受信箱を取得
--   - 受信箱の新着 → user_notifications (category=mail) を生成
-- ============================================================

create table if not exists user_gmail_connections (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id),
  user_id           uuid not null references app_users(id) on delete cascade,
  email_address     text not null,
  refresh_token     text not null,
  access_token      text,
  access_token_expires_at timestamptz,
  granted_scopes    text not null,
  connected_at      timestamptz not null default now(),
  last_sync_at      timestamptz,
  last_sync_status  text check (last_sync_status in ('success','warning','error')),
  last_sync_note    text,
  -- 1 ユーザにつき 1 接続
  unique (user_id)
);

create index if not exists user_gmail_connections_org_idx
  on user_gmail_connections(organization_id);

alter table user_gmail_connections enable row level security;

drop policy if exists user_gmail_connections_select on user_gmail_connections;
drop policy if exists user_gmail_connections_write  on user_gmail_connections;
-- 本人 or manager のみ自分の接続を SELECT (refresh_token は service role 経由でのみ実利用)
create policy user_gmail_connections_select on user_gmail_connections
  for select to authenticated
  using (
    is_manager_or_above()
    or user_id = (select id from app_users where auth_user_id = auth.uid())
  );
create policy user_gmail_connections_write on user_gmail_connections
  for all to authenticated
  using (
    user_id = (select id from app_users where auth_user_id = auth.uid())
  )
  with check (
    user_id = (select id from app_users where auth_user_id = auth.uid())
  );
