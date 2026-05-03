-- ============================================================
-- 0001_init.sql — NEO CSポータル 正規化スキーマ初期マイグレーション
-- ストリーム01: 基盤
--
-- 本ファイルは roadmap/01_基盤_DDL案.sql を migration 化したもので、
-- ストリーム04の申し送りを反映している:
--   (a) MutationHook (lib/repository/audit.ts) が write 後に
--       audit_logs に追記する設計に整合。本SQLは audit_logs スキーマを
--       0002_audit_logs.sql の `add column if not exists` 群と
--       矛盾しない形で作成する
--   (b) supabase-js が前提 — package.json に @supabase/supabase-js を追加済
--   (c) マルチテナント対応の素地として organizations テーブル + 全業務
--       テーブルへの organization_id を導入。既存 mock データ用に
--       単一の default organization をシードする
-- ============================================================

-- ============================================================
-- 0. 拡張・共通関数
-- ============================================================
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- 1. テナント (organizations) — マルチテナント素地
-- ============================================================
create table organizations (
  id          uuid primary key default uuid_generate_v4(),
  slug        text not null unique,
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger organizations_updated_at before update on organizations
  for each row execute function set_updated_at();

-- 既存 mock データ用デフォルトテナント。
-- アプリ側 (lib/repository) では DEFAULT_ORG_ID 定数として参照する。
insert into organizations (id, slug, name)
values ('00000000-0000-0000-0000-000000000001', 'neoacademia', 'NEO ACADEMIA')
on conflict (slug) do nothing;

-- ============================================================
-- 2. 認証・ユーザー
-- ============================================================
create table app_users (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id),
  auth_user_id    uuid unique references auth.users(id) on delete set null,
  email           text not null unique,
  name            text not null,
  picture_url     text,
  role            text not null check (role in ('admin','manager','member','viewer')),
  is_active       boolean not null default true,
  disabled_at     timestamptz,
  last_login_at   timestamptz,
  last_seen_ip    inet,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index app_users_org_role_idx on app_users(organization_id, role) where is_active;
create trigger app_users_updated_at before update on app_users
  for each row execute function set_updated_at();

-- ============================================================
-- 3. プロダクトマスタ (テナント横断 — organization_id 不要)
-- ============================================================
create table products (
  code              text primary key check (code in ('academia','hyogikai','aiken','commu')),
  name              text not null,
  short_name        text not null,
  product_type      text not null check (product_type in ('continuous','one_shot')),
  billing_months    int,
  session_count     int,
  participant_cap   int,
  accent_color      text,
  cycle_unit        text not null check (cycle_unit in ('期','回')),
  cycle_label_format text not null,
  cycle_sync_mode   text not null check (cycle_sync_mode in ('global','per_account')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger products_updated_at before update on products
  for each row execute function set_updated_at();

create table product_courses (
  product_code  text not null references products(code) on delete cascade,
  course_key    text not null,
  name          text not null,
  short_name    text,
  description   text,
  display_order int not null default 0,
  primary key (product_code, course_key)
);

-- ============================================================
-- 4. 顧客企業 + 子テーブル (全て organization_id 必須)
-- ============================================================
create table companies (
  id                text primary key,
  organization_id   uuid not null references organizations(id),
  corporate_number  text unique,
  name              text not null,
  kana              text,
  industry          text,
  address           text,
  group_name        text,
  owner_user_id     uuid references app_users(id),
  memo              text,
  is_active         boolean not null default true,
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references app_users(id),
  updated_by        uuid references app_users(id)
);
create index companies_org_idx on companies(organization_id) where is_active;
create index companies_owner_idx on companies(owner_user_id) where is_active;
create index companies_industry_idx on companies(industry);
create trigger companies_updated_at before update on companies
  for each row execute function set_updated_at();

create table company_contacts (
  id              text primary key,
  organization_id uuid not null references organizations(id),
  company_id      text not null references companies(id) on delete cascade,
  name            text not null,
  department      text,
  title           text,
  email           text,
  tel             text,
  is_primary      boolean not null default false,
  active_from     date,
  active_to       date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index company_contacts_primary_unique
  on company_contacts(company_id) where is_primary;
create index company_contacts_org_idx on company_contacts(organization_id);
create index company_contacts_email_idx on company_contacts(email);

create table company_contact_products (
  contact_id   text not null references company_contacts(id) on delete cascade,
  product_code text not null references products(code),
  primary key (contact_id, product_code)
);

create table stakeholders (
  id              text primary key,
  organization_id uuid not null references organizations(id),
  company_id      text not null references companies(id) on delete cascade,
  contact_id      text references company_contacts(id),
  name            text not null,
  role_title      text,
  department      text,
  stakeholder_type text not null check (stakeholder_type in ('decision_maker','champion','user','at_risk')),
  active_from     date not null,
  active_to       date,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index stakeholders_org_idx on stakeholders(organization_id);
create index stakeholders_company_idx on stakeholders(company_id);

create table stakeholder_products (
  stakeholder_id text not null references stakeholders(id) on delete cascade,
  product_code   text not null references products(code),
  primary key (stakeholder_id, product_code)
);

-- ============================================================
-- 5. 契約
-- ============================================================
create table contracts (
  id                   text primary key,
  organization_id      uuid not null references organizations(id),
  company_id           text not null references companies(id) on delete restrict,
  product_code         text not null references products(code),
  course_key           text,
  plan_name            text,
  start_date           date not null,
  end_date             date,
  cycle_number         int not null default 1,
  previous_contract_id text references contracts(id),
  currency             char(3) not null default 'JPY',
  mrr_amount           numeric(12,0),
  total_revenue        numeric(14,0),
  owner_user_id        uuid references app_users(id),
  participant_count    int,
  status               text not null check (status in
    ('handoff','onboarding','active','renewal_window','renewed','churned')),
  current_phase        text,
  phase_entered_at     timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid references app_users(id),
  updated_by           uuid references app_users(id),
  foreign key (product_code, course_key) references product_courses(product_code, course_key),
  check (end_date is null or end_date >= start_date),
  check (cycle_number >= 1)
);
create index contracts_org_idx on contracts(organization_id);
create index contracts_company_idx on contracts(company_id);
create index contracts_status_idx on contracts(status);
create index contracts_endate_idx on contracts(end_date) where status in ('active','renewal_window');
create index contracts_owner_idx on contracts(owner_user_id);
create trigger contracts_updated_at before update on contracts
  for each row execute function set_updated_at();

-- ============================================================
-- 6. 参加者・セッション・出席
-- ============================================================
create table participants (
  id              text primary key,
  organization_id uuid not null references organizations(id),
  company_id      text not null references companies(id) on delete cascade,
  contract_id     text not null references contracts(id) on delete cascade,
  name            text not null,
  email           text,
  role_title      text,
  department      text,
  seniority       text check (seniority in ('young','mid','senior','exec')),
  status          text not null check (status in ('active','inactive','dropped')),
  joined_at       date not null,
  left_at         date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index participants_org_idx on participants(organization_id);
create index participants_contract_idx on participants(contract_id);
create index participants_company_idx on participants(company_id);

create table sessions (
  id              text primary key,
  organization_id uuid not null references organizations(id),
  contract_id     text not null references contracts(id) on delete cascade,
  session_number  int not null,
  scheduled_at    timestamptz not null,
  completed_at    timestamptz,
  title           text,
  unique (contract_id, session_number)
);
create index sessions_org_idx on sessions(organization_id);

create table attendance_events (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id),
  participant_id  text not null references participants(id) on delete cascade,
  session_id      text not null references sessions(id) on delete cascade,
  status          text not null check (status in ('present','absent','late')),
  recorded_at     timestamptz not null default now(),
  recorded_by     uuid references app_users(id),
  note            text,
  unique (participant_id, session_id)
);
create index attendance_org_idx on attendance_events(organization_id);
create index attendance_session_idx on attendance_events(session_id);

-- ============================================================
-- 7. オンボーディング
-- ============================================================
create table onboarding_template_categories (
  id            uuid primary key default uuid_generate_v4(),
  product_code  text not null references products(code),
  category_key  text not null,
  label         text not null,
  display_order int not null default 0,
  unique (product_code, category_key)
);

create table onboarding_template_items (
  id              uuid primary key default uuid_generate_v4(),
  category_id     uuid not null references onboarding_template_categories(id) on delete cascade,
  item_key        text not null,
  name            text not null,
  due_offset_days int not null,
  required        boolean not null default true,
  default_assignee_role text check (default_assignee_role in ('cs','pr','ops','finance')),
  unique (category_id, item_key)
);

create table onboarding_tasks (
  id               text primary key,
  organization_id  uuid not null references organizations(id),
  contract_id      text not null references contracts(id) on delete cascade,
  template_item_id uuid references onboarding_template_items(id),
  phase_key        text,
  name             text not null,
  due_date         date,
  status           text not null check (status in ('todo','doing','done','overdue')),
  assignee_user_id uuid references app_users(id),
  completed_at     timestamptz,
  completed_by     uuid references app_users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index onboarding_tasks_org_idx on onboarding_tasks(organization_id);
create index onboarding_tasks_contract_idx on onboarding_tasks(contract_id);
create index onboarding_tasks_status_idx on onboarding_tasks(status, due_date);

-- ============================================================
-- 8. アカウントジャーニー / Success Plan / 更新マイルストーン
-- ============================================================
create table account_journeys (
  organization_id  uuid not null references organizations(id),
  company_id       text not null references companies(id) on delete cascade,
  product_code     text not null references products(code),
  current_stage    text not null check (current_stage in ('onboarding','adoption','value','expansion')),
  stage_entered_at timestamptz not null,
  updated_at       timestamptz not null default now(),
  primary key (company_id, product_code)
);
create index account_journeys_org_idx on account_journeys(organization_id);

create table account_journey_events (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id),
  company_id      text not null references companies(id) on delete cascade,
  product_code    text not null references products(code),
  stage_from      text check (stage_from in ('onboarding','adoption','value','expansion')),
  stage_to        text not null check (stage_to in ('onboarding','adoption','value','expansion')),
  transitioned_at timestamptz not null default now(),
  recorded_by     uuid references app_users(id),
  note            text
);
create index ajourney_events_company_idx on account_journey_events(company_id, product_code, transitioned_at);
create index ajourney_events_org_idx on account_journey_events(organization_id);

create table success_plans (
  contract_id         text primary key references contracts(id) on delete cascade,
  organization_id     uuid not null references organizations(id),
  overall_achievement numeric(4,3),
  updated_at          timestamptz not null default now(),
  updated_by          uuid references app_users(id)
);

create table success_plan_goals (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id),
  contract_id     text not null references contracts(id) on delete cascade,
  goal_key        text not null,
  title           text not null,
  target_metric   text,
  achievement     numeric(4,3),
  note            text,
  display_order   int not null default 0,
  updated_at      timestamptz not null default now(),
  unique (contract_id, goal_key)
);

create table renewal_milestones (
  id              text primary key,
  organization_id uuid not null references organizations(id),
  contract_id     text not null references contracts(id) on delete cascade,
  milestone_type  text not null check (milestone_type in ('T-120','T-90','T-60','T-30')),
  due_date        date not null,
  status          text not null check (status in ('todo','done','skipped')),
  completed_at    timestamptz,
  note            text,
  unique (contract_id, milestone_type)
);
create index renewal_milestones_org_idx on renewal_milestones(organization_id);

-- ============================================================
-- 9. ヘルススコア・スナップショット
-- ============================================================
create table health_score_snapshots (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id),
  contract_id     text not null references contracts(id) on delete cascade,
  as_of_date      date not null,
  score           int not null check (score between 0 and 100),
  color           text not null check (color in ('green','yellow','red')),
  factors         jsonb not null default '{}'::jsonb,
  computed_at     timestamptz not null default now(),
  unique (contract_id, as_of_date)
);
create index health_snapshots_org_asof_idx on health_score_snapshots(organization_id, as_of_date);
create index health_snapshots_contract_idx on health_score_snapshots(contract_id, as_of_date desc);

-- ============================================================
-- 10. 週次レビュー
-- ============================================================
create table weekly_reviews (
  id              text primary key,
  organization_id uuid not null references organizations(id),
  company_id      text not null references companies(id) on delete cascade,
  product_code    text not null references products(code),
  week_start      date not null,
  week_end        date not null,
  week_label      text not null,
  good            text,
  more            text,
  author_user_id  uuid references app_users(id),
  locked          boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (company_id, product_code, week_start)
);
create index weekly_reviews_org_idx on weekly_reviews(organization_id, week_start desc);
create trigger weekly_reviews_updated_at before update on weekly_reviews
  for each row execute function set_updated_at();

create table weekly_actions (
  id               text primary key,
  organization_id  uuid not null references organizations(id),
  weekly_review_id text not null references weekly_reviews(id) on delete cascade,
  text             text not null,
  done             boolean not null default false,
  from_prev_week   boolean not null default false,
  carried_from_week text,
  assignee_user_id uuid references app_users(id),
  completed_at     timestamptz,
  display_order    int not null default 0
);
create index weekly_actions_review_idx on weekly_actions(weekly_review_id);

create table weekly_next_actions (
  id               text primary key,
  organization_id  uuid not null references organizations(id),
  weekly_review_id text not null references weekly_reviews(id) on delete cascade,
  text             text not null,
  assignee_user_id uuid references app_users(id),
  due_date         date,
  display_order    int not null default 0
);
create index weekly_next_actions_review_idx on weekly_next_actions(weekly_review_id);

-- ============================================================
-- 11. 面談ログ
-- ============================================================
create table meeting_logs (
  id              text primary key,
  organization_id uuid not null references organizations(id),
  company_id      text not null references companies(id) on delete cascade,
  product_code    text references products(code),
  is_cross        boolean not null default false,
  log_type        text not null check (log_type in ('mtg','mail','call')),
  occurred_at     timestamptz not null,
  title           text not null,
  summary         text,
  good            text,
  more            text,
  next_action     text,
  author_user_id  uuid references app_users(id),
  ai_generated    boolean not null default false,
  source_ref      text,
  created_at      timestamptz not null default now()
);
create index meeting_logs_org_idx on meeting_logs(organization_id);
create index meeting_logs_company_idx on meeting_logs(company_id, occurred_at desc);

-- ============================================================
-- 12. アンケート
-- ============================================================
create table survey_questions (
  id        text primary key,
  q_key     text not null unique,
  text      text not null,
  q_type    text not null check (q_type in ('scale','choice','multi_choice','text','long_text')),
  scale_min int,
  scale_max int,
  choices   jsonb,
  required  boolean not null default false
);

create table survey_templates (
  id              text primary key,
  name            text not null,
  scope           text not null check (scope in ('common','product','session')),
  product_code    text references products(code),
  session_type    text,
  respondent_type text not null check (respondent_type in ('stakeholder','participant'))
);

create table survey_template_questions (
  template_id   text not null references survey_templates(id) on delete cascade,
  question_id   text not null references survey_questions(id),
  display_order int not null default 0,
  primary key (template_id, question_id)
);

create table surveys (
  id                    text primary key,
  organization_id       uuid not null references organizations(id),
  schedule_id           text,
  contract_id           text references contracts(id),
  session_id            text references sessions(id),
  title                 text not null,
  product_session_label text,
  respondent_type       text not null check (respondent_type in ('stakeholder','participant')),
  expected_count        int,
  opened_at             timestamptz,
  closed_at             timestamptz,
  status                text not null check (status in ('draft','open','closed')),
  created_at            timestamptz not null default now()
);
create index surveys_org_idx on surveys(organization_id);

create table survey_responses (
  id              text primary key,
  organization_id uuid not null references organizations(id),
  survey_id       text not null references surveys(id) on delete cascade,
  company_id      text references companies(id),
  participant_id  text references participants(id),
  respondent_name text,
  submitted_at    timestamptz not null,
  answers         jsonb not null
);
create index survey_responses_survey_idx on survey_responses(survey_id);
create index survey_responses_company_idx on survey_responses(company_id);
create index survey_responses_org_idx on survey_responses(organization_id);

-- ============================================================
-- 13. 解約
-- ============================================================
create table churn_events (
  id               uuid primary key default uuid_generate_v4(),
  organization_id  uuid not null references organizations(id),
  contract_id      text not null references contracts(id) on delete restrict,
  churned_at       date not null,
  reason_note      text,
  next_action_date date,
  next_action_note text,
  notified         boolean not null default false,
  created_at       timestamptz not null default now(),
  created_by       uuid references app_users(id)
);
create index churn_events_org_idx on churn_events(organization_id);
create index churn_events_contract_idx on churn_events(contract_id);

create table churn_event_reasons (
  churn_event_id  uuid not null references churn_events(id) on delete cascade,
  reason_category text not null check (reason_category in
    ('budget','low_engagement','internal_change','competitor','value_unfit','other')),
  primary key (churn_event_id, reason_category)
);

-- ============================================================
-- 13b. アサイン (company × user × role) — ストリーム02 B項要望
-- ============================================================
-- メンバーマスタ × 顧客企業の担当割当。
-- companies.owner_user_id は「主担当のショートカット」として残しつつ、
-- secondary / observer を含む多対多はこのテーブルで管理する。
create table assignments (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id),
  company_id      text not null references companies(id) on delete cascade,
  user_id         uuid not null references app_users(id) on delete cascade,
  role            text not null check (role in ('primary','secondary','observer')),
  assigned_at     timestamptz not null default now(),
  assigned_by     uuid references app_users(id),
  unassigned_at   timestamptz,
  note            text,
  unique (company_id, user_id, role)
);
create index assignments_company_idx on assignments(company_id) where unassigned_at is null;
create index assignments_user_idx on assignments(user_id) where unassigned_at is null;
create index assignments_org_idx on assignments(organization_id);
-- 1社につき primary は最大1人
create unique index assignments_one_primary_per_company
  on assignments(company_id) where role = 'primary' and unassigned_at is null;

-- ============================================================
-- 13c. 1on1 ログ — ストリーム02 B項要望
-- ============================================================
-- メンバー間の1on1記録。company / contract に紐づかない純粋な人事記録。
create table one_on_one_logs (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id),
  manager_user_id uuid not null references app_users(id) on delete restrict,
  member_user_id  uuid not null references app_users(id) on delete restrict,
  occurred_at     timestamptz not null,
  duration_min    int,
  topic           text,
  summary         text,
  good            text,
  more            text,
  next_action     text,
  is_private      boolean not null default false,
  author_user_id  uuid references app_users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index one_on_one_logs_pair_idx on one_on_one_logs(manager_user_id, member_user_id, occurred_at desc);
create index one_on_one_logs_member_idx on one_on_one_logs(member_user_id, occurred_at desc);
create index one_on_one_logs_org_idx on one_on_one_logs(organization_id);
create trigger one_on_one_logs_updated_at before update on one_on_one_logs
  for each row execute function set_updated_at();

-- ============================================================
-- 14. ドラフト (autosave)
-- ============================================================
create table drafts (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id),
  owner_user_id   uuid not null references app_users(id) on delete cascade,
  entity_type     text not null,
  entity_id       text not null,
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (owner_user_id, entity_type, entity_id)
);
create index drafts_owner_idx on drafts(owner_user_id, updated_at desc);
create trigger drafts_updated_at before update on drafts
  for each row execute function set_updated_at();

-- ============================================================
-- 15. 監査ログ (0002_audit_logs.sql で強化される基底スキーマ)
-- ============================================================
-- 0002 の `add column if not exists` で request_id / source / actor_role /
-- organization_id / reason / diff が後から追加されるため、本ファイルは
-- 必要最小限のみを定義する。
create table audit_logs (
  id            bigserial primary key,
  actor_user_id uuid references app_users(id),
  actor_email   text,
  action        text not null,
  target_table  text not null,
  target_id     text,
  before_data   jsonb,
  after_data    jsonb,
  ip_address    inet,
  user_agent    text,
  created_at    timestamptz not null default now()
);
create index audit_logs_actor_idx on audit_logs(actor_user_id, created_at desc);
create index audit_logs_target_idx on audit_logs(target_table, target_id, created_at desc);

-- ============================================================
-- 16. ドメインイベント (BI/分析用)
-- ============================================================
create table domain_events (
  id              bigserial primary key,
  organization_id uuid references organizations(id),
  event_type      text not null,
  aggregate_type  text not null,
  aggregate_id    text not null,
  payload         jsonb not null default '{}'::jsonb,
  occurred_at     timestamptz not null default now(),
  recorded_by     uuid references app_users(id)
);
create index domain_events_aggregate_idx on domain_events(aggregate_type, aggregate_id, occurred_at desc);
create index domain_events_type_idx on domain_events(event_type, occurred_at desc);
create index domain_events_org_idx on domain_events(organization_id, occurred_at desc);

-- ============================================================
-- 17. 同意記録 (個情法)
-- ============================================================
create table consent_records (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id),
  subject_type    text not null check (subject_type in ('participant','contact','stakeholder','company')),
  subject_id      text not null,
  consent_type    text not null,
  consented       boolean not null,
  consented_at    timestamptz not null default now(),
  expires_at      timestamptz,
  evidence_url    text,
  note            text
);
create index consent_records_subject_idx on consent_records(subject_type, subject_id);
create index consent_records_org_idx on consent_records(organization_id);

-- ============================================================
-- 18. RLS 有効化 (詳細ポリシーは別マイグレーションで追加)
-- ============================================================
-- ポリシー無し = デフォルト全拒否。anon は何もできない。
alter table organizations enable row level security;
alter table app_users enable row level security;
alter table products enable row level security;
alter table product_courses enable row level security;
alter table companies enable row level security;
alter table company_contacts enable row level security;
alter table company_contact_products enable row level security;
alter table stakeholders enable row level security;
alter table stakeholder_products enable row level security;
alter table contracts enable row level security;
alter table participants enable row level security;
alter table sessions enable row level security;
alter table attendance_events enable row level security;
alter table onboarding_template_categories enable row level security;
alter table onboarding_template_items enable row level security;
alter table onboarding_tasks enable row level security;
alter table account_journeys enable row level security;
alter table account_journey_events enable row level security;
alter table success_plans enable row level security;
alter table success_plan_goals enable row level security;
alter table renewal_milestones enable row level security;
alter table health_score_snapshots enable row level security;
alter table weekly_reviews enable row level security;
alter table weekly_actions enable row level security;
alter table weekly_next_actions enable row level security;
alter table meeting_logs enable row level security;
alter table survey_questions enable row level security;
alter table survey_templates enable row level security;
alter table survey_template_questions enable row level security;
alter table surveys enable row level security;
alter table survey_responses enable row level security;
alter table churn_events enable row level security;
alter table churn_event_reasons enable row level security;
alter table drafts enable row level security;
alter table assignments enable row level security;
alter table one_on_one_logs enable row level security;
alter table audit_logs enable row level security;
alter table domain_events enable row level security;
alter table consent_records enable row level security;

-- ============================================================
-- END 0001_init.sql
-- ============================================================
