-- ============================================================
-- 0039: アンケート CSV 取り込み機能
--   - survey_imports: 取り込み履歴と raw CSV
--   - survey_insights: AI 分析結果
--   - survey_responses.company_id を NULL 許容化（1 期振り返りのように
--     企業列がない CSV を取り込めるようにする）
--   - survey_questions に取り込み元を識別するメタデータ追加
-- ============================================================

-- ① survey_responses.company_id を NULL 許容にする
-- 既存定義では NOT NULL 制約は付いていないが、リポジトリ層が必須扱いしているので
-- 念のため明示的に NULL 許容を保証する。
alter table survey_responses
  alter column company_id drop not null;

-- ② survey_questions に取り込み元メタデータを追加
alter table survey_questions
  add column if not exists is_imported boolean not null default false,
  add column if not exists source_import_id uuid;

-- ③ 取り込み履歴テーブル
create table if not exists survey_imports (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id),
  file_name         text not null,
  uploaded_at       timestamptz not null default now(),
  uploaded_by       uuid references auth.users(id),
  schedule_id       text not null,
  survey_id         text references surveys(id) on delete set null,
  status            text not null check (status in ('parsing','mapping','review','applied','failed')),
  row_count         int not null default 0,
  column_mappings   jsonb not null default '[]'::jsonb,
  raw_csv           text not null,
  ai_summary        text,
  error_message     text,
  created_at        timestamptz not null default now()
);
create index if not exists survey_imports_org_idx on survey_imports(organization_id);
create index if not exists survey_imports_survey_idx on survey_imports(survey_id);
create index if not exists survey_imports_schedule_idx on survey_imports(schedule_id);

-- ④ AI 分析結果（インサイト）テーブル
create table if not exists survey_insights (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id),
  survey_id           text not null references surveys(id) on delete cascade,
  question_id         text references survey_questions(id) on delete set null,
  category            text not null check (category in ('positive','concern','suggestion','complaint','strength','weakness')),
  summary             text not null,
  source_response_ids jsonb not null default '[]'::jsonb,
  confidence          numeric(3,2) not null default 0,
  created_at          timestamptz not null default now()
);
create index if not exists survey_insights_org_idx on survey_insights(organization_id);
create index if not exists survey_insights_survey_idx on survey_insights(survey_id);

-- ⑤ RLS（既存 surveys / survey_responses と同じパターンを踏襲）
alter table survey_imports enable row level security;
alter table survey_insights enable row level security;

drop policy if exists survey_imports_select on survey_imports;
drop policy if exists survey_imports_write on survey_imports;
create policy survey_imports_select on survey_imports
  for select to authenticated
  using (is_authenticated_active());
create policy survey_imports_write on survey_imports
  for all to authenticated
  using (is_manager_or_above())
  with check (is_manager_or_above());

drop policy if exists survey_insights_select on survey_insights;
drop policy if exists survey_insights_write on survey_insights;
create policy survey_insights_select on survey_insights
  for select to authenticated
  using (is_authenticated_active());
create policy survey_insights_write on survey_insights
  for all to authenticated
  using (is_manager_or_above())
  with check (is_manager_or_above());
