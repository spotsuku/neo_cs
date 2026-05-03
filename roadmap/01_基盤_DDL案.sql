-- ============================================================
-- NEO CSポータル 正規化スキーマ DDL案 (v0.1)
-- ストリーム01: 基盤
-- 作成日: 2026-05-03
--
-- 目的:
--   現状の ps_data(key, value jsonb) KVS1テーブルから、
--   lib/mock/entities.ts / contracts.ts / cycles.ts / participants.ts /
--   surveys.ts / weekly.ts / churn.ts / onboarding.ts の型を正本に
--   正規化スキーマへ展開する。
--
-- レビュー反映:
--   - 07_データアナリスト: 正規化、イベントログ、SCD、メトリクス計算可能化
--   - 11_情シスセキュリティ: RLS本物化、anon全開放廃止、監査ログ
--   - 13_法務コンプライアンス: 監査ログ、削除フロー、同意記録
--   - 14_将来運用者: 外部キー・制約による契約整合性
--   - 16_SRE: 適切なインデックス、updated_at標準
--
-- 注意:
--   - 全テーブル created_at / updated_at / created_by / updated_by を持つ
--   - id は text (mockのslug "c-aeon" 等を一旦受け継ぎ、後でuuid移行も検討)
--   - 本DDL案はレビュー用ドラフト。実適用前に migration ファイル化する
-- ============================================================

-- ============================================================
-- 0. 共通: 拡張・関数
-- ============================================================
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- updated_at 自動更新トリガ用関数
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- 1. 認証・ユーザー (内部CS担当者)
-- ============================================================
-- Supabase Auth の auth.users と1:1で連携する内部ユーザープロファイル
create table app_users (
  id            uuid primary key default uuid_generate_v4(),
  auth_user_id  uuid unique references auth.users(id) on delete set null,
  email         text not null unique,
  name          text not null,
  picture_url   text,
  role          text not null check (role in ('admin','manager','member','viewer')),
  is_active     boolean not null default true,
  disabled_at   timestamptz,
  last_login_at timestamptz,
  last_seen_ip  inet,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index app_users_role_idx on app_users(role) where is_active;
create trigger app_users_updated_at before update on app_users
  for each row execute function set_updated_at();

-- ============================================================
-- 2. 研修プロダクト (マスタ)
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

-- 研修内コース (academia: PJT共創/リーダー育成 等)
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
-- 3. 顧客企業
-- ============================================================
create table companies (
  id                text primary key,                  -- "c-aeon" 等 (将来 uuid 化検討)
  corporate_number  text unique,                       -- 法人番号13桁 (NULL可)
  name              text not null,
  kana              text,
  industry          text,
  address           text,
  group_name        text,
  owner_user_id     uuid references app_users(id),     -- CS担当
  memo              text,
  is_active         boolean not null default true,
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references app_users(id),
  updated_by        uuid references app_users(id)
);
create index companies_owner_idx on companies(owner_user_id) where is_active;
create index companies_industry_idx on companies(industry);
create trigger companies_updated_at before update on companies
  for each row execute function set_updated_at();

-- 企業担当者 (顧客側の窓口)
create table company_contacts (
  id           text primary key,
  company_id   text not null references companies(id) on delete cascade,
  name         text not null,
  department   text,
  title        text,
  email        text,
  tel          text,
  is_primary   boolean not null default false,
  active_from  date,
  active_to    date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index company_contacts_primary_unique
  on company_contacts(company_id) where is_primary;
create index company_contacts_email_idx on company_contacts(email);

-- 企業担当者×プロダクト (担当者がどの研修に関わっているか)
create table company_contact_products (
  contact_id   text not null references company_contacts(id) on delete cascade,
  product_code text not null references products(code),
  primary key (contact_id, product_code)
);

-- ステークホルダー(役割タイプ付与: champion / decision_maker / at_risk / user)
-- contactsとは別概念で、サイクル跨いで継続する関係性
create table stakeholders (
  id            text primary key,
  company_id    text not null references companies(id) on delete cascade,
  contact_id    text references company_contacts(id),  -- 同一人物リンク (任意)
  name          text not null,
  role_title    text,
  department    text,
  stakeholder_type text not null check (stakeholder_type in ('decision_maker','champion','user','at_risk')),
  active_from   date not null,
  active_to     date,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index stakeholders_company_idx on stakeholders(company_id);

create table stakeholder_products (
  stakeholder_id text not null references stakeholders(id) on delete cascade,
  product_code   text not null references products(code),
  primary key (stakeholder_id, product_code)
);

-- ============================================================
-- 4. 契約 (サイクル単位)
-- ============================================================
create table contracts (
  id                 text primary key,                 -- "k-aeon-academia" 等
  company_id         text not null references companies(id) on delete restrict,
  product_code       text not null references products(code),
  course_key         text,
  plan_name          text,
  start_date         date not null,
  end_date           date,
  cycle_number       int not null default 1,
  previous_contract_id text references contracts(id),

  -- 金額: 通貨と按分単位を明確化
  currency           char(3) not null default 'JPY',
  mrr_amount         numeric(12,0),
  total_revenue      numeric(14,0),

  owner_user_id      uuid references app_users(id),
  participant_count  int,

  -- ライフサイクル: 派生だが、頻繁に参照するためマテリアライズ
  status             text not null check (status in ('handoff','onboarding','active','renewal_window','renewed','churned')),
  current_phase      text,
  phase_entered_at   timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references app_users(id),
  updated_by         uuid references app_users(id),

  foreign key (product_code, course_key) references product_courses(product_code, course_key)
);
create index contracts_company_idx on contracts(company_id);
create index contracts_status_idx on contracts(status);
create index contracts_endate_idx on contracts(end_date) where status in ('active','renewal_window');
create index contracts_owner_idx on contracts(owner_user_id);
create trigger contracts_updated_at before update on contracts
  for each row execute function set_updated_at();

-- ============================================================
-- 5. 参加者 (受講者) と 出席
-- ============================================================
create table participants (
  id           text primary key,
  company_id   text not null references companies(id) on delete cascade,
  contract_id  text not null references contracts(id) on delete cascade,
  name         text not null,
  email        text,
  role_title   text,
  department   text,
  seniority    text check (seniority in ('young','mid','senior','exec')),
  status       text not null check (status in ('active','inactive','dropped')),
  joined_at    date not null,
  left_at      date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index participants_contract_idx on participants(contract_id);
create index participants_company_idx on participants(company_id);

create table sessions (
  id              text primary key,
  contract_id     text not null references contracts(id) on delete cascade,
  session_number  int not null,
  scheduled_at    timestamptz not null,
  completed_at    timestamptz,
  title           text,
  unique (contract_id, session_number)
);

-- 出席イベント (ファクトテーブル)
create table attendance_events (
  id              uuid primary key default uuid_generate_v4(),
  participant_id  text not null references participants(id) on delete cascade,
  session_id      text not null references sessions(id) on delete cascade,
  status          text not null check (status in ('present','absent','late')),
  recorded_at     timestamptz not null default now(),
  recorded_by     uuid references app_users(id),
  note            text,
  unique (participant_id, session_id)
);
create index attendance_session_idx on attendance_events(session_id);

-- ============================================================
-- 6. オンボーディング
-- ============================================================
-- テンプレート (研修×カテゴリ×項目)
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

-- 契約ごとに展開された実タスク
create table onboarding_tasks (
  id            text primary key,
  contract_id   text not null references contracts(id) on delete cascade,
  template_item_id uuid references onboarding_template_items(id),
  phase_key     text,                                  -- 旧 OnboardingTask.phase
  name          text not null,
  due_date      date,
  status        text not null check (status in ('todo','doing','done','overdue')),
  assignee_user_id uuid references app_users(id),
  completed_at  timestamptz,
  completed_by  uuid references app_users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index onboarding_tasks_contract_idx on onboarding_tasks(contract_id);
create index onboarding_tasks_status_idx on onboarding_tasks(status, due_date);

-- ============================================================
-- 7. アカウントジャーニー & Success Plan (CS層)
-- ============================================================
-- 現在地スナップショット
create table account_journeys (
  company_id      text not null references companies(id) on delete cascade,
  product_code    text not null references products(code),
  current_stage   text not null check (current_stage in ('onboarding','adoption','value','expansion')),
  stage_entered_at timestamptz not null,
  updated_at      timestamptz not null default now(),
  primary key (company_id, product_code)
);

-- ジャーニー遷移イベントログ (時系列分析の核)
create table account_journey_events (
  id              uuid primary key default uuid_generate_v4(),
  company_id      text not null references companies(id) on delete cascade,
  product_code    text not null references products(code),
  stage_from      text check (stage_from in ('onboarding','adoption','value','expansion')),
  stage_to        text not null check (stage_to in ('onboarding','adoption','value','expansion')),
  transitioned_at timestamptz not null default now(),
  recorded_by     uuid references app_users(id),
  note            text
);
create index ajourney_events_company_idx on account_journey_events(company_id, product_code, transitioned_at);

create table success_plans (
  contract_id          text primary key references contracts(id) on delete cascade,
  overall_achievement  numeric(4,3),                   -- 0..1
  updated_at           timestamptz not null default now(),
  updated_by           uuid references app_users(id)
);

create table success_plan_goals (
  id                uuid primary key default uuid_generate_v4(),
  contract_id       text not null references contracts(id) on delete cascade,
  goal_key          text not null,
  title             text not null,
  target_metric     text,
  achievement       numeric(4,3),
  note              text,
  display_order     int not null default 0,
  updated_at        timestamptz not null default now(),
  unique (contract_id, goal_key)
);

-- 更新マイルストーン (T-120/90/60/30)
create table renewal_milestones (
  id            text primary key,
  contract_id   text not null references contracts(id) on delete cascade,
  milestone_type text not null check (milestone_type in ('T-120','T-90','T-60','T-30')),
  due_date      date not null,
  status        text not null check (status in ('todo','done','skipped')),
  completed_at  timestamptz,
  note          text,
  unique (contract_id, milestone_type)
);

-- ============================================================
-- 8. ヘルススコア (時系列スナップショット)
-- ============================================================
-- 日次バッチで生成される想定。これがあれば BI / コホート / ML 全部できる
create table health_score_snapshots (
  id           uuid primary key default uuid_generate_v4(),
  contract_id  text not null references contracts(id) on delete cascade,
  as_of_date   date not null,
  score        int not null check (score between 0 and 100),
  color        text not null check (color in ('green','yellow','red')),
  factors      jsonb not null default '{}'::jsonb,    -- {attendance, overdueOnboardingTasks, weeksSinceLastTouch, negativeSignalCount}
  computed_at  timestamptz not null default now(),
  unique (contract_id, as_of_date)
);
create index health_snapshots_asof_idx on health_score_snapshots(as_of_date);
create index health_snapshots_contract_idx on health_score_snapshots(contract_id, as_of_date desc);

-- ============================================================
-- 9. 週次レビュー (CS週次運用)
-- ============================================================
create table weekly_reviews (
  id           text primary key,
  company_id   text not null references companies(id) on delete cascade,
  product_code text not null references products(code),
  week_start   date not null,
  week_end     date not null,
  week_label   text not null,
  good         text,
  more         text,
  author_user_id uuid references app_users(id),
  locked       boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (company_id, product_code, week_start)
);
create trigger weekly_reviews_updated_at before update on weekly_reviews
  for each row execute function set_updated_at();

create table weekly_actions (
  id              text primary key,
  weekly_review_id text not null references weekly_reviews(id) on delete cascade,
  text            text not null,
  done            boolean not null default false,
  from_prev_week  boolean not null default false,
  carried_from_week text,
  assignee_user_id uuid references app_users(id),
  completed_at    timestamptz,
  display_order   int not null default 0
);

create table weekly_next_actions (
  id              text primary key,
  weekly_review_id text not null references weekly_reviews(id) on delete cascade,
  text            text not null,
  assignee_user_id uuid references app_users(id),
  due_date        date,
  display_order   int not null default 0
);

-- ============================================================
-- 10. 面談ログ (Meetings / Mail / Call)
-- ============================================================
create table meeting_logs (
  id           text primary key,
  company_id   text not null references companies(id) on delete cascade,
  product_code text references products(code),         -- "cross" の場合 NULL
  is_cross     boolean not null default false,
  log_type     text not null check (log_type in ('mtg','mail','call')),
  occurred_at  timestamptz not null,
  title        text not null,
  summary      text,
  good         text,
  more         text,
  next_action  text,
  author_user_id uuid references app_users(id),
  ai_generated boolean not null default false,
  source_ref   text,                                   -- メールID/議事録ID等の元データ参照 (信頼度評価)
  created_at   timestamptz not null default now()
);
create index meeting_logs_company_idx on meeting_logs(company_id, occurred_at desc);

-- ============================================================
-- 11. アンケート (Surveys)
-- ============================================================
create table survey_questions (
  id           text primary key,
  q_key        text not null unique,
  text         text not null,
  q_type       text not null check (q_type in ('scale','choice','multi_choice','text','long_text')),
  scale_min    int,
  scale_max    int,
  choices      jsonb,
  required     boolean not null default false
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
  id                  text primary key,
  schedule_id         text,
  contract_id         text references contracts(id),
  session_id          text references sessions(id),
  title               text not null,
  product_session_label text,
  respondent_type     text not null check (respondent_type in ('stakeholder','participant')),
  expected_count      int,
  opened_at           timestamptz,
  closed_at           timestamptz,
  status              text not null check (status in ('draft','open','closed')),
  created_at          timestamptz not null default now()
);

create table survey_responses (
  id              text primary key,
  survey_id       text not null references surveys(id) on delete cascade,
  company_id      text references companies(id),
  participant_id  text references participants(id),
  respondent_name text,
  submitted_at    timestamptz not null,
  answers         jsonb not null                       -- [{questionId, value}] 構造化保存
);
create index survey_responses_survey_idx on survey_responses(survey_id);
create index survey_responses_company_idx on survey_responses(company_id);

-- ============================================================
-- 12. 解約 (Churn)
-- ============================================================
create table churn_events (
  id              uuid primary key default uuid_generate_v4(),
  contract_id     text not null references contracts(id) on delete restrict,
  churned_at      date not null,
  reason_note     text,
  next_action_date date,
  next_action_note text,
  notified        boolean not null default false,
  created_at      timestamptz not null default now(),
  created_by      uuid references app_users(id)
);
create index churn_events_contract_idx on churn_events(contract_id);

-- 複数理由対応 (現状mockは1カテゴリだが、レビュー07で多対多推奨)
create table churn_event_reasons (
  churn_event_id uuid not null references churn_events(id) on delete cascade,
  reason_category text not null check (reason_category in ('budget','low_engagement','internal_change','competitor','value_unfit','other')),
  primary key (churn_event_id, reason_category)
);

-- ============================================================
-- 13. 監査ログ・イベントログ (法務/セキュリティ/SRE要件)
-- ============================================================
-- 全write操作の監査記録
create table audit_logs (
  id           bigserial primary key,
  actor_user_id uuid references app_users(id),
  actor_email  text,                                   -- 退職後も追跡できるよう冗長保持
  action       text not null,                          -- 'create','update','delete','login','export' 等
  target_table text not null,
  target_id    text,
  before_data  jsonb,
  after_data   jsonb,
  ip_address   inet,
  user_agent   text,
  created_at   timestamptz not null default now()
);
create index audit_logs_actor_idx on audit_logs(actor_user_id, created_at desc);
create index audit_logs_target_idx on audit_logs(target_table, target_id, created_at desc);

-- 業務イベントログ (BI/分析の核。監査ログとは別物)
create table domain_events (
  id           bigserial primary key,
  event_type   text not null,                          -- 'contract.created', 'contract.renewed', 'contract.churned', 'health.changed', 'milestone.completed' 等
  aggregate_type text not null,                        -- 'contract','company','participant' 等
  aggregate_id text not null,
  payload      jsonb not null default '{}'::jsonb,
  occurred_at  timestamptz not null default now(),
  recorded_by  uuid references app_users(id)
);
create index domain_events_aggregate_idx on domain_events(aggregate_type, aggregate_id, occurred_at desc);
create index domain_events_type_idx on domain_events(event_type, occurred_at desc);

-- 同意記録 (個情法・GDPR対応)
create table consent_records (
  id              uuid primary key default uuid_generate_v4(),
  subject_type    text not null check (subject_type in ('participant','contact','stakeholder','company')),
  subject_id      text not null,
  consent_type    text not null,                       -- 'ai_processing','cross_border_transfer','marketing' 等
  consented       boolean not null,
  consented_at    timestamptz not null default now(),
  expires_at      timestamptz,
  evidence_url    text,
  note            text
);
create index consent_records_subject_idx on consent_records(subject_type, subject_id);

-- ============================================================
-- 14. RLS 雛形 (詳細ポリシーは別ファイルで設計)
-- ============================================================
-- 全公開ポリシーは絶対に作らない。
-- 基本方針:
--   1. anon ロールには何も許可しない (Supabase Auth 必須)
--   2. authenticated ロールに対し app_users の role / 担当関係でフィルタ
--   3. admin は全件可。manager は自部署管理範囲。member は自分担当のみ。viewer は read のみ
--   4. service_role はサーバーサイドAPI専用
--
-- 例: companies テーブルの read ポリシー雛形 (実装は次フェーズ)
--   create policy companies_read on companies
--     for select to authenticated
--     using (
--       exists (
--         select 1 from app_users u
--         where u.auth_user_id = auth.uid()
--           and u.is_active
--           and (
--             u.role in ('admin','manager','viewer')
--             or companies.owner_user_id = u.id
--           )
--       )
--     );

-- 全テーブルで RLS を有効化 (ポリシー無し = 拒否デフォルト)
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
alter table audit_logs enable row level security;
alter table domain_events enable row level security;
alter table consent_records enable row level security;

-- ============================================================
-- END
-- ============================================================
