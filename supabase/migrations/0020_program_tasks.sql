-- ============================================================
-- 0020_program_tasks.sql
-- 事業内ToDo (期内固定タスク)
--
-- オンボーディングと同型のチェックリストを「事業 (product/course/cycle)」単位で
-- 運用するための3テーブル。
--   program_terms          : スコープ (アカデミア / リーダー育成 / 第7期 など)
--   program_task_templates : 期内タスク定義 (日程調整 / 招待送付 / 面談実施 …)
--   program_company_tasks  : 企業×タスクの状態セル (マトリクスの1マス)
--
-- 個社ToDo (company_tasks) とは独立。両者は混ぜない。
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. program_terms : スコープ定義
-- ─────────────────────────────────────────────
-- product/course_key/cycle_no の null は「全体対象」を表す:
--   product=academia, course_key=null, cycle_no=null → アカデミア全体
--   product=academia, course_key=leader, cycle_no=null → リーダー育成全期
--   product=academia, course_key=leader, cycle_no=7 → 2026Q2 リーダー育成 第7期
create table program_terms (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  product_code    text not null references products(code),
  course_key      text,
  cycle_no        int,
  label           text not null,
  started_at      date,
  closed_at       date,
  status          text not null default 'active'
                    check (status in ('draft','active','closed','archived')),
  created_by      uuid references app_users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (closed_at is null or started_at is null or closed_at >= started_at),
  check (cycle_no is null or cycle_no >= 1)
);

create trigger program_terms_updated_at
  before update on program_terms
  for each row execute function set_updated_at();

create index program_terms_scope_idx
  on program_terms(organization_id, product_code, course_key, cycle_no);
create index program_terms_status_idx
  on program_terms(organization_id, status);

-- ─────────────────────────────────────────────
-- 2. program_task_templates : 期内タスク定義
-- ─────────────────────────────────────────────
create table program_task_templates (
  id                      uuid primary key default gen_random_uuid(),
  program_term_id         uuid not null references program_terms(id) on delete cascade,
  order_no                int  not null,
  label                   text not null,
  description             text,
  category                text check (category in (
                            'meeting_schedule',
                            'invite_send',
                            'meeting_hold',
                            'document_check',
                            'material_send',
                            'followup',
                            'other'
                          )),
  default_due_offset_days int,
  default_due_date        date, -- 列単位で設定した期日 (空なら個別セルの dueDate のみ)
  default_assignee_to     uuid references app_users(id), -- 列単位の既定担当 (open セルへ一括反映)
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (program_term_id, order_no)
);

create trigger program_task_templates_updated_at
  before update on program_task_templates
  for each row execute function set_updated_at();

create index program_task_templates_term_idx
  on program_task_templates(program_term_id);

-- ─────────────────────────────────────────────
-- 3. program_company_tasks : 企業×タスクのセル
-- ─────────────────────────────────────────────
create table program_company_tasks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  program_term_id uuid not null references program_terms(id) on delete cascade,
  template_id     uuid not null references program_task_templates(id) on delete cascade,
  company_id      text not null references companies(id) on delete cascade,
  contract_id     text references contracts(id) on delete set null,
  status          text not null default 'pending'
                    check (status in ('pending','in_progress','done','not_applicable','skipped')),
  due_date        date,
  assigned_to     uuid references app_users(id),
  note            text,
  completed_at    timestamptz,
  completed_by    uuid references app_users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (program_term_id, template_id, company_id)
);

create trigger program_company_tasks_updated_at
  before update on program_company_tasks
  for each row execute function set_updated_at();

create index program_company_tasks_term_idx
  on program_company_tasks(program_term_id);
create index program_company_tasks_company_idx
  on program_company_tasks(company_id);
create index program_company_tasks_assigned_idx
  on program_company_tasks(assigned_to)
  where status in ('pending','in_progress');
create index program_company_tasks_due_idx
  on program_company_tasks(due_date)
  where status in ('pending','in_progress');

-- ============================================================
-- RLS
-- ============================================================
alter table program_terms           enable row level security;
alter table program_task_templates  enable row level security;
alter table program_company_tasks   enable row level security;

-- program_terms : 組織メンバーは閲覧、Manager以上が書込
drop policy if exists program_terms_select on program_terms;
drop policy if exists program_terms_write  on program_terms;

create policy program_terms_select on program_terms
  for select to authenticated
  using (organization_id = current_org_id());

create policy program_terms_write on program_terms
  for all to authenticated
  using (is_manager_or_above() and organization_id = current_org_id())
  with check (is_manager_or_above() and organization_id = current_org_id());

-- program_task_templates : 親 term と同じポリシー
drop policy if exists program_task_templates_select on program_task_templates;
drop policy if exists program_task_templates_write  on program_task_templates;

create policy program_task_templates_select on program_task_templates
  for select to authenticated
  using (
    exists (
      select 1 from program_terms t
      where t.id = program_term_id
        and t.organization_id = current_org_id()
    )
  );

create policy program_task_templates_write on program_task_templates
  for all to authenticated
  using (
    is_manager_or_above() and exists (
      select 1 from program_terms t
      where t.id = program_term_id
        and t.organization_id = current_org_id()
    )
  )
  with check (
    is_manager_or_above() and exists (
      select 1 from program_terms t
      where t.id = program_term_id
        and t.organization_id = current_org_id()
    )
  );

-- program_company_tasks : company_tasks と同じく can_write_company で制御
drop policy if exists program_company_tasks_select on program_company_tasks;
drop policy if exists program_company_tasks_write  on program_company_tasks;

create policy program_company_tasks_select on program_company_tasks
  for select to authenticated
  using (
    is_manager_or_above()
    or has_company_access(company_id)
  );

create policy program_company_tasks_write on program_company_tasks
  for all to authenticated
  using (can_write_company(company_id))
  with check (can_write_company(company_id));

-- ============================================================
-- END 0020
-- ============================================================
