-- ============================================================
-- 0041: ユーザ通知 inbox (user_notifications)
--   - app/notifications/page.tsx で表示する受信箱
--   - VOC / 週次未提出 / 解約予兆 / 更新ウィンドウ / オンボ期限 等を集約
--   - 既読 (read_at) / カテゴリ / リンク先 / ソース参照 を保持
-- ============================================================

create table if not exists user_notifications (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references organizations(id),
  -- 宛先ユーザ。null は組織全体ブロードキャスト (manager only)
  user_id              uuid references app_users(id) on delete cascade,
  category             text not null check (category in
    ('alert','review','renewal','onboarding','mail')),
  title                text not null,
  body                 text,
  link_href            text,
  related_company_id   text references companies(id) on delete set null,
  related_contract_id  text references contracts(id) on delete set null,
  -- 重複生成を防ぐためのソース参照 (例: source_type='voc', source_id='v-123')
  source_type          text,
  source_id            text,
  read_at              timestamptz,
  created_at           timestamptz not null default now()
);

create index if not exists user_notifications_user_idx
  on user_notifications(user_id, read_at nulls first, created_at desc);
create index if not exists user_notifications_org_idx
  on user_notifications(organization_id);
-- 重複生成防止: 同じ (user_id, source_type, source_id) の通知は 1 件のみ。
-- ブロードキャスト (user_id is null) は dedup 対象外なので部分インデックス。
create unique index if not exists user_notifications_dedup_idx
  on user_notifications(user_id, source_type, source_id)
  where user_id is not null and source_type is not null and source_id is not null;

-- RLS
alter table user_notifications enable row level security;

drop policy if exists user_notifications_select on user_notifications;
drop policy if exists user_notifications_write  on user_notifications;
-- 自分宛 + 自分送信元 (broadcast) のみ閲覧可。manager は全件。
create policy user_notifications_select on user_notifications
  for select to authenticated
  using (
    is_manager_or_above()
    or user_id = (select id from app_users where auth_user_id = auth.uid())
    or user_id is null
  );
create policy user_notifications_write on user_notifications
  for all to authenticated
  using (
    is_manager_or_above()
    or user_id = (select id from app_users where auth_user_id = auth.uid())
  )
  with check (
    is_manager_or_above()
    or user_id = (select id from app_users where auth_user_id = auth.uid())
  );
