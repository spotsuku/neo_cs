-- NEO ACADEMIA PS Dashboard - Supabase Schema
-- Supabase の SQL Editor で実行してください

-- ダッシュボードの全データを1テーブルで管理（シンプル設計）
create table if not exists ps_data (
  id          bigserial primary key,
  key         text not null unique,   -- 例: 'stages', 'meetings_1', 'ms_overrides_3'
  value       jsonb not null,         -- JSON値をそのまま格納
  updated_at  timestamptz default now()
);

-- updated_at を自動更新するトリガー
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger ps_data_updated_at
  before update on ps_data
  for each row execute function update_updated_at();

-- RLS（Row Level Security）を有効化
alter table ps_data enable row level security;

-- 全操作を許可（認証なしで使う場合 - anon keyで操作可能）
create policy "allow_all" on ps_data
  for all using (true) with check (true);

-- インデックス
create index if not exists ps_data_key_idx on ps_data(key);

-- ユーザー管理テーブル
create table if not exists neo_users (
  id          bigserial primary key,
  email       text not null unique,
  name        text,
  picture     text,
  role        text default 'member',  -- 'admin' or 'member'
  last_login  timestamptz,
  created_at  timestamptz default now()
);

alter table neo_users enable row level security;

create policy "allow_all_neo_users" on neo_users
  for all using (true) with check (true);

create index if not exists neo_users_email_idx on neo_users(email);

