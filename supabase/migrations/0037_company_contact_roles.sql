-- ============================================================
-- 0037_company_contact_roles.sql
-- 組織図タブが必要とする「contact × 事業 × 役割レベル × 期」の紐付け
--
-- これまで lib/mock/entities.ts の Contact.roles[] 配列でのみ表現されていた
-- {scope, level, cycleNo} を DB 化する。これで本番環境でも組織図タブが
-- 「事業=academia × 期=第2期」での絞り込み表示を可能にする。
--
-- scope:
--   - 'overall' = 商材横断（全社レベルの担当者）
--   - product_code (academia/hyogikai/aiken/commu) = 商材ごとの担当者
--
-- level:
--   - executive : 担当役員
--   - approver  : 決裁者
--   - lead      : 担当責任者
--   - member    : 担当者
--
-- cycle_no:
--   - 期 (cycleNumber)。null = 全期共通として扱う。
-- ============================================================

create table if not exists company_contact_roles (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  contact_id      text not null references company_contacts(id) on delete cascade,
  scope           text not null check (scope in ('overall','academia','hyogikai','aiken','commu')),
  level           text not null check (level in ('executive','approver','lead','member')),
  cycle_no        int,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (contact_id, scope, level, cycle_no)
);

create index if not exists company_contact_roles_contact_idx
  on company_contact_roles(contact_id);
create index if not exists company_contact_roles_scope_idx
  on company_contact_roles(scope, cycle_no);

drop trigger if exists company_contact_roles_updated_at on company_contact_roles;
create trigger company_contact_roles_updated_at
  before update on company_contact_roles
  for each row execute function set_updated_at();

-- RLS: 通常 select は authenticated 全員、write は service_role のみ
alter table company_contact_roles enable row level security;

drop policy if exists company_contact_roles_select on company_contact_roles;
create policy company_contact_roles_select on company_contact_roles
  for select to authenticated using (true);

drop policy if exists company_contact_roles_no_write on company_contact_roles;
create policy company_contact_roles_no_write on company_contact_roles
  for all to authenticated using (false) with check (false);
