-- ============================================================
-- 0014_company_tasks.sql
-- 業務 ToDo (面談日程調整・提出物確認・資料送付など)
--
-- onboarding_tasks (オンボ専用) と分離した汎用タスク。
-- 任意で contract_id に紐付けるが、company_id は必須。
-- soft delete = status='cancelled' 推奨。
--
-- 将来 Slack 等への通知連携を想定し notify_at 列のみ用意 (本マイグレーション
-- では参照しない)。
-- ============================================================

create table company_tasks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  company_id      text not null references companies(id) on delete cascade,
  contract_id     text references contracts(id) on delete set null,
  title           text not null,
  description     text,
  category        text check (category in (
                    'meeting_schedule',
                    'document_check',
                    'material_send',
                    'followup',
                    'other'
                  )),
  status          text not null default 'pending'
                    check (status in ('pending','in_progress','done','skipped','cancelled')),
  priority        text not null default 'med'
                    check (priority in ('low','med','high','urgent')),
  due_date        date,
  notify_at       timestamptz, -- 将来通知連携用 (本MIGでは未使用)
  assigned_to     uuid references app_users(id),
  created_by      uuid references app_users(id),
  completed_at    timestamptz,
  completed_by    uuid references app_users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger company_tasks_updated_at
  before update on company_tasks
  for each row execute function set_updated_at();

create index company_tasks_company_idx on company_tasks(company_id);
create index company_tasks_assigned_idx on company_tasks(assigned_to)
  where status in ('pending','in_progress');
create index company_tasks_due_idx on company_tasks(due_date)
  where status in ('pending','in_progress');
create index company_tasks_org_status_idx on company_tasks(organization_id, status);

-- ============================================================
-- RLS (0006 と同パターン)
-- ============================================================
alter table company_tasks enable row level security;

drop policy if exists company_tasks_select on company_tasks;
drop policy if exists company_tasks_write  on company_tasks;

create policy company_tasks_select on company_tasks
  for select to authenticated
  using (
    is_manager_or_above()
    or has_company_access(company_id)
  );

create policy company_tasks_write on company_tasks
  for all to authenticated
  using (can_write_company(company_id))
  with check (can_write_company(company_id));

-- ============================================================
-- END 0014
-- ============================================================
