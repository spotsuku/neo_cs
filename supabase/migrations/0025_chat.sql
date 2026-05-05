-- ============================================================
-- 0025_chat.sql
-- アプリ内チャット (DM / 事業部 / メールスレッド統合)
--
-- 設計:
--   - chat_channels: 1テーブルで kind='dm'|'program'|'email_thread' を表現
--   - chat_channel_members: DM 参加者 (将来のグループDM 拡張も可)
--   - chat_messages: 全種別のメッセージを統合
--   - chat_message_mentions: 通知/検索用にメンションを正規化
--
--   email_threads は現状アプリ層でのみ存在 (mock データ)。
--   email_thread_ref を text 型でゆるく持ち、将来テーブル化時に
--   外部キー化する。
--
--   internalThreadComments (mock の社内チャット) は本番では
--   chat_messages (kind='email_thread') に統合される。
-- ============================================================

create table if not exists chat_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  kind text not null check (kind in ('dm','program','email_thread')),
  title text,
  -- kind='program' のみ
  product_code text,
  -- kind='email_thread' のみ (将来 email_threads(id) への FK 化を想定)
  email_thread_ref text,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),

  -- 事業部チャンネルは organization × productCode で一意
  constraint chat_channels_program_unique
    unique (organization_id, kind, product_code)
);

-- email_thread チャンネルは email_thread_ref でユニーク
create unique index if not exists chat_channels_email_thread_uq
  on chat_channels (organization_id, email_thread_ref)
  where kind = 'email_thread';

create index if not exists chat_channels_org_kind_idx
  on chat_channels (organization_id, kind, last_message_at desc);

-- DM 参加者
create table if not exists chat_channel_members (
  channel_id uuid not null references chat_channels(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (channel_id, user_id)
);

create index if not exists chat_channel_members_user_idx
  on chat_channel_members (user_id);

-- メッセージ
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references chat_channels(id) on delete cascade,
  author_user_id uuid not null references app_users(id),
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index if not exists chat_messages_channel_idx
  on chat_messages (channel_id, created_at);

-- メンション
create table if not exists chat_message_mentions (
  message_id uuid not null references chat_messages(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  primary key (message_id, user_id)
);

create index if not exists chat_message_mentions_user_idx
  on chat_message_mentions (user_id);

-- last_message_at を自動更新
create or replace function chat_messages_touch_channel()
returns trigger
language plpgsql
as $$
begin
  update chat_channels
     set last_message_at = NEW.created_at
   where id = NEW.channel_id;
  return NEW;
end;
$$;

drop trigger if exists chat_messages_touch_channel_trg on chat_messages;
create trigger chat_messages_touch_channel_trg
  after insert on chat_messages
  for each row execute function chat_messages_touch_channel();

-- ============================================================
-- RLS
-- ============================================================
alter table chat_channels enable row level security;
alter table chat_channel_members enable row level security;
alter table chat_messages enable row level security;
alter table chat_message_mentions enable row level security;

-- chat_channels:
--   - DM: 参加者 (chat_channel_members) のみ可視
--   - program / email_thread: 同 organization の non-external ユーザー
drop policy if exists chat_channels_select on chat_channels;
create policy chat_channels_select on chat_channels
  for select to authenticated
  using (
    (kind = 'dm' and exists (
      select 1 from chat_channel_members m
       where m.channel_id = chat_channels.id
         and m.user_id = current_app_user_id()
    ))
    or
    (kind in ('program','email_thread')
      and not is_external()
      and organization_id = current_org_id())
  );

drop policy if exists chat_channels_write on chat_channels;
create policy chat_channels_write on chat_channels
  for all to authenticated
  using (
    not is_external()
    and organization_id = current_org_id()
    and (
      kind <> 'dm'
      or exists (
        select 1 from chat_channel_members m
         where m.channel_id = chat_channels.id
           and m.user_id = current_app_user_id()
      )
    )
  )
  with check (
    not is_external()
    and organization_id = current_org_id()
  );

-- chat_channel_members: 自分が参加するチャンネルのみ
drop policy if exists chat_channel_members_select on chat_channel_members;
create policy chat_channel_members_select on chat_channel_members
  for select to authenticated
  using (
    user_id = current_app_user_id()
    or exists (
      select 1 from chat_channel_members m2
       where m2.channel_id = chat_channel_members.channel_id
         and m2.user_id = current_app_user_id()
    )
  );

drop policy if exists chat_channel_members_write on chat_channel_members;
create policy chat_channel_members_write on chat_channel_members
  for all to authenticated
  using (not is_external())
  with check (not is_external());

-- chat_messages: チャンネルが見えるなら見える
drop policy if exists chat_messages_select on chat_messages;
create policy chat_messages_select on chat_messages
  for select to authenticated
  using (
    exists (
      select 1 from chat_channels c
       where c.id = chat_messages.channel_id
         and (
           (c.kind = 'dm' and exists (
             select 1 from chat_channel_members m
              where m.channel_id = c.id and m.user_id = current_app_user_id()
           ))
           or
           (c.kind in ('program','email_thread')
            and not is_external()
            and c.organization_id = current_org_id())
         )
    )
  );

drop policy if exists chat_messages_write on chat_messages;
create policy chat_messages_write on chat_messages
  for all to authenticated
  using (
    not is_external()
    and author_user_id = current_app_user_id()
  )
  with check (
    not is_external()
    and author_user_id = current_app_user_id()
    and exists (
      select 1 from chat_channels c
       where c.id = chat_messages.channel_id
         and (
           (c.kind = 'dm' and exists (
             select 1 from chat_channel_members m
              where m.channel_id = c.id and m.user_id = current_app_user_id()
           ))
           or
           (c.kind in ('program','email_thread')
            and c.organization_id = current_org_id())
         )
    )
  );

-- chat_message_mentions: 親メッセージの可視性に従う
drop policy if exists chat_message_mentions_select on chat_message_mentions;
create policy chat_message_mentions_select on chat_message_mentions
  for select to authenticated
  using (
    exists (
      select 1 from chat_messages m
       where m.id = chat_message_mentions.message_id
    )
  );

drop policy if exists chat_message_mentions_write on chat_message_mentions;
create policy chat_message_mentions_write on chat_message_mentions
  for all to authenticated
  using (not is_external())
  with check (not is_external());

-- audit_logs フックは _base.ts 経由で十分なので DB トリガは付けない
