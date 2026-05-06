-- ============================================================
-- 0030_company_vision_weather_lifecycle.sql
-- 企業ビジョン + 企業天気オーバーライド + 契約ライフサイクル
--
--   company_visions / company_vision_logs:
--     企業のNEO参画動機・中長期目標等の長文ナラティブ。
--     1社=1行。upsert 時は変更前を vision_logs にコピー (改変不可)。
--
--   company_weather_overrides:
--     自動派生 (deriveCompanyWeather) に対する手動上書き。
--     存在すれば優先表示、無ければ自動派生値を表示する。
--
--   contract_lifecycle_snapshots:
--     解約 / 更新成功 / 期満了の凍結スナップショット。
--     contract_id が PK で、契約の最終状態を凍結保存する。
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. company_visions
-- ─────────────────────────────────────────────
create table company_visions (
  company_id        text primary key references companies(id) on delete cascade,
  join_motivation   text,
  long_term_goal    text,
  this_year_goal    text,
  usage_policy      text,
  updated_at        timestamptz not null default now(),
  updated_by        uuid references app_users(id)
);

create trigger company_visions_updated_at
  before update on company_visions
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────
-- 2. company_vision_logs : 変更前スナップショット
-- ─────────────────────────────────────────────
create table company_vision_logs (
  id              uuid primary key default gen_random_uuid(),
  company_id      text not null references companies(id) on delete cascade,
  -- 変更前の値 (改変不可)
  join_motivation text,
  long_term_goal  text,
  this_year_goal  text,
  usage_policy    text,
  -- 何が変わったか (field key の配列)
  changed_fields  text[] not null,
  recorded_at     timestamptz not null default now(),
  recorded_by     uuid references app_users(id)
);

create index company_vision_logs_company_idx
  on company_vision_logs(company_id, recorded_at desc);

-- ─────────────────────────────────────────────
-- 3. company_weather_overrides
-- ─────────────────────────────────────────────
create table company_weather_overrides (
  company_id  text primary key references companies(id) on delete cascade,
  weather     text not null check (weather in ('sunny','fair','cloudy','rainy','storm')),
  note        text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references app_users(id)
);

create trigger company_weather_overrides_updated_at
  before update on company_weather_overrides
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────
-- 4. contract_lifecycle_snapshots
-- ─────────────────────────────────────────────
create table contract_lifecycle_snapshots (
  contract_id              text primary key references contracts(id) on delete cascade,
  organization_id          uuid not null references organizations(id),
  ended_as                 text not null check (ended_as in ('renewed','churned','expired')),
  ended_at                 timestamptz not null,
  final_stage_key          text not null,
  final_lifecycle_state    text not null
                              check (final_lifecycle_state in ('active','at_risk','churned','re_approach')),
  -- 出席率(0..1)・チェックポイント進捗・最終 health 等のサマリ
  metrics                  jsonb not null default '{}'::jsonb,
  churn_reason             text,
  succeeded_by_contract_id text references contracts(id),
  -- スナップショット時点の全チェックポイント完了状況 (改変不可)
  checkpoint_status_snapshot jsonb,
  created_at               timestamptz not null default now()
);

create index contract_lifecycle_snapshots_org_idx
  on contract_lifecycle_snapshots(organization_id, ended_at desc);

-- ============================================================
-- RLS
-- ============================================================
alter table company_visions                enable row level security;
alter table company_vision_logs            enable row level security;
alter table company_weather_overrides      enable row level security;
alter table contract_lifecycle_snapshots   enable row level security;

-- company_visions: 企業アクセス権で制御
drop policy if exists company_visions_select on company_visions;
drop policy if exists company_visions_write  on company_visions;

create policy company_visions_select on company_visions
  for select to authenticated
  using (
    is_manager_or_above()
    or has_company_access(company_id)
  );

create policy company_visions_write on company_visions
  for all to authenticated
  using (can_write_company(company_id))
  with check (can_write_company(company_id));

-- company_vision_logs: 親ビジョンと同じく閲覧・insert は許可、update/delete は禁止
drop policy if exists company_vision_logs_select on company_vision_logs;
drop policy if exists company_vision_logs_insert on company_vision_logs;

create policy company_vision_logs_select on company_vision_logs
  for select to authenticated
  using (
    is_manager_or_above()
    or has_company_access(company_id)
  );

create policy company_vision_logs_insert on company_vision_logs
  for insert to authenticated
  with check (can_write_company(company_id));

-- company_weather_overrides: 企業アクセス権で制御
drop policy if exists company_weather_overrides_select on company_weather_overrides;
drop policy if exists company_weather_overrides_write  on company_weather_overrides;

create policy company_weather_overrides_select on company_weather_overrides
  for select to authenticated
  using (
    is_manager_or_above()
    or has_company_access(company_id)
  );

create policy company_weather_overrides_write on company_weather_overrides
  for all to authenticated
  using (can_write_company(company_id))
  with check (can_write_company(company_id));

-- contract_lifecycle_snapshots: 親契約の権限で制御 (insert/update は CS が freeze 操作)
drop policy if exists contract_lifecycle_snapshots_select on contract_lifecycle_snapshots;
drop policy if exists contract_lifecycle_snapshots_write  on contract_lifecycle_snapshots;

create policy contract_lifecycle_snapshots_select on contract_lifecycle_snapshots
  for select to authenticated
  using (
    is_manager_or_above()
    or exists (
      select 1 from contracts c
      where c.id = contract_lifecycle_snapshots.contract_id
        and has_company_access(c.company_id)
    )
  );

create policy contract_lifecycle_snapshots_write on contract_lifecycle_snapshots
  for all to authenticated
  using (
    exists (
      select 1 from contracts c
      where c.id = contract_lifecycle_snapshots.contract_id
        and can_write_company(c.company_id)
    )
  )
  with check (
    exists (
      select 1 from contracts c
      where c.id = contract_lifecycle_snapshots.contract_id
        and can_write_company(c.company_id)
    )
  );

-- ============================================================
-- END 0029
-- ============================================================
