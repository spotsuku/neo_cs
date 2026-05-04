-- ============================================================
-- 0017_sales_handoffs.sql
-- Phase4-#6 営業 (neo-sales) → CS (neo-cs) 引き継ぎ受信テーブル
--
-- 背景:
--   neo-sales 側の Deal が「内諾」(成約) になったタイミングで
--   webhook で本テーブルに INSERT する。1 deal = 1 row。
--   companies / company_contacts / contracts / assignments を upsert
--   した後、その実体IDを本テーブルに記録して履歴 (audit) として保持する。
--   後段 (Phase4-#5: Drive 自動作成) で drive_folder_url を埋める。
--
-- 重複防止:
--   - sales_deal_id を unique key として「同じ deal の再送は 1 回しか効かない」
--   - HTTP ハンドラ側で Idempotency-Key ヘッダも併用 (アプリ層 in-memory)
--
-- RLS:
--   - admin / manager は select 可
--   - insert / update は service_role のみ (HTTP webhook は service_role 経由)
-- ============================================================

create table if not exists sales_handoffs (
  id                    uuid primary key default uuid_generate_v4(),
  organization_id       uuid not null references organizations(id),
  sales_deal_id         text not null unique,
  company_id            text references companies(id) on delete set null,
  primary_contact_id    text references company_contacts(id) on delete set null,
  contract_id           text references contracts(id) on delete set null,
  sales_owner_email     text,
  drive_folder_url      text,             -- Phase4-#5 で埋まる (それまで NULL)
  payload               jsonb not null,    -- 元 webhook ペイロードを生で保管
  received_at           timestamptz not null default now(),
  processed_at          timestamptz,
  processed_by_kind     text not null default 'system'
                        check (processed_by_kind in ('system','manual')),
  status                text not null default 'received'
                        check (status in ('received','processed','failed','duplicate')),
  error_detail          text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists sales_handoffs_org_idx on sales_handoffs(organization_id);
create index if not exists sales_handoffs_status_idx on sales_handoffs(status, received_at desc);
create index if not exists sales_handoffs_company_idx on sales_handoffs(company_id);

drop trigger if exists sales_handoffs_updated_at on sales_handoffs;
create trigger sales_handoffs_updated_at before update on sales_handoffs
  for each row execute function set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────
alter table sales_handoffs enable row level security;

drop policy if exists sales_handoffs_select_admin_manager on sales_handoffs;
create policy sales_handoffs_select_admin_manager on sales_handoffs
  for select
  using (
    exists (
      select 1 from app_users u
      where u.auth_user_id = auth.uid()
        and u.organization_id = sales_handoffs.organization_id
        and u.role in ('admin','manager')
        and u.is_active
    )
  );

-- insert/update/delete は service_role のみ (RLS bypass される)
-- 明示的に anon/authenticated を遮断
drop policy if exists sales_handoffs_no_write_authenticated on sales_handoffs;
create policy sales_handoffs_no_write_authenticated on sales_handoffs
  for all
  to authenticated
  using (false)
  with check (false);
