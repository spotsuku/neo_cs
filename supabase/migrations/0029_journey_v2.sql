-- ============================================================
-- 0029_journey_v2.sql
-- 企業ジャーニー / 事業ジャーニー (account-journey-v2)
--
-- ステージ定義は組織単位でカスタム可能。companies × stage は永続、
-- contracts × stage は契約 (商材×期) ごとに別軸を持つ。
-- 後退 (display_order が下がる) も記録するが、UI 側で警告表示する。
--
-- 既存テーブル account_journeys (0001) は固定4ステージの旧モデル。
-- このマイグレーションでは置き換えではなく "拡張" として併存させる。
-- 移行は別途 backfill スクリプトで行う想定。
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. journey_stage_definitions : ステージ定義
-- ─────────────────────────────────────────────
create table journey_stage_definitions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  journey_type    text not null check (journey_type in ('company','business')),
  stage_key       text not null,
  display_order   int  not null,
  name            text not null,
  description     text not null,
  color           text,
  key_actions     text,
  -- ステージ完了の目安となるチェック項目 (key/label/description の配列)
  checkpoints     jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, journey_type, stage_key)
);

create trigger journey_stage_definitions_updated_at
  before update on journey_stage_definitions
  for each row execute function set_updated_at();

create index journey_stage_definitions_scope_idx
  on journey_stage_definitions(organization_id, journey_type, display_order);

-- ─────────────────────────────────────────────
-- 2. company_journeys : 会社単位の現在ステージ (1社=1行)
-- ─────────────────────────────────────────────
create table company_journeys (
  company_id        text primary key references companies(id) on delete cascade,
  organization_id   uuid not null references organizations(id),
  current_stage_key text not null,
  stage_entered_at  date not null,
  note              text,
  updated_at        timestamptz not null default now(),
  updated_by        uuid references app_users(id)
);

create trigger company_journeys_updated_at
  before update on company_journeys
  for each row execute function set_updated_at();

create index company_journeys_org_idx on company_journeys(organization_id);
create index company_journeys_stage_idx
  on company_journeys(organization_id, current_stage_key);

-- ─────────────────────────────────────────────
-- 3. business_journeys : 契約単位 (商材×期) の現在ステージ
-- ─────────────────────────────────────────────
create table business_journeys (
  contract_id       text primary key references contracts(id) on delete cascade,
  organization_id   uuid not null references organizations(id),
  current_stage_key text not null,
  stage_entered_at  date not null,
  -- 解約軸: active / at_risk / churned / re_approach
  lifecycle_state   text not null default 'active'
                      check (lifecycle_state in ('active','at_risk','churned','re_approach')),
  lifecycle_reason  text,
  note              text,
  updated_at        timestamptz not null default now(),
  updated_by        uuid references app_users(id)
);

create trigger business_journeys_updated_at
  before update on business_journeys
  for each row execute function set_updated_at();

create index business_journeys_org_idx on business_journeys(organization_id);
create index business_journeys_stage_idx
  on business_journeys(organization_id, current_stage_key);
create index business_journeys_lifecycle_idx
  on business_journeys(organization_id, lifecycle_state);

-- ─────────────────────────────────────────────
-- 4. journey_events : ステージ遷移ログ (audit 兼)
-- ─────────────────────────────────────────────
-- subject_id は companies.id (text) もしくは contracts.id (text) のどちらかで、
-- journey_type で区別する。FK は付けず、アプリ側で参照整合性を担保する
-- (会社 / 契約のどちらかが削除されても履歴は残す)。
create table journey_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  subject_id      text not null,
  journey_type    text not null check (journey_type in ('company','business')),
  from_stage_key  text,
  to_stage_key    text not null,
  changed_at      timestamptz not null default now(),
  changed_by      uuid references app_users(id),
  note            text,
  is_regression   boolean not null default false
);

create index journey_events_subject_idx
  on journey_events(organization_id, journey_type, subject_id, changed_at desc);

-- ─────────────────────────────────────────────
-- 5. journey_checkpoint_status : チェック項目ごとの完了状態
-- ─────────────────────────────────────────────
create table journey_checkpoint_status (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  journey_type    text not null check (journey_type in ('company','business')),
  subject_id      text not null,
  stage_key       text not null,
  checkpoint_key  text not null,
  done            boolean not null default false,
  completed_at    timestamptz,
  completed_by    uuid references app_users(id),
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, journey_type, subject_id, stage_key, checkpoint_key)
);

create trigger journey_checkpoint_status_updated_at
  before update on journey_checkpoint_status
  for each row execute function set_updated_at();

create index journey_checkpoint_status_subject_idx
  on journey_checkpoint_status(organization_id, journey_type, subject_id);

-- ============================================================
-- RLS
-- ============================================================
alter table journey_stage_definitions  enable row level security;
alter table company_journeys           enable row level security;
alter table business_journeys          enable row level security;
alter table journey_events             enable row level security;
alter table journey_checkpoint_status  enable row level security;

-- ステージ定義: 組織メンバーは閲覧、Manager 以上が編集
drop policy if exists journey_stage_definitions_select on journey_stage_definitions;
drop policy if exists journey_stage_definitions_write  on journey_stage_definitions;

create policy journey_stage_definitions_select on journey_stage_definitions
  for select to authenticated
  using (organization_id = current_org_id());

create policy journey_stage_definitions_write on journey_stage_definitions
  for all to authenticated
  using (is_manager_or_above() and organization_id = current_org_id())
  with check (is_manager_or_above() and organization_id = current_org_id());

-- 企業ジャーニー: 企業アクセス権で制御
drop policy if exists company_journeys_select on company_journeys;
drop policy if exists company_journeys_write  on company_journeys;

create policy company_journeys_select on company_journeys
  for select to authenticated
  using (
    is_manager_or_above()
    or has_company_access(company_id)
  );

create policy company_journeys_write on company_journeys
  for all to authenticated
  using (can_write_company(company_id))
  with check (can_write_company(company_id));

-- 事業ジャーニー: 親企業の権限で制御
drop policy if exists business_journeys_select on business_journeys;
drop policy if exists business_journeys_write  on business_journeys;

create policy business_journeys_select on business_journeys
  for select to authenticated
  using (
    is_manager_or_above()
    or exists (
      select 1 from contracts c
      where c.id = business_journeys.contract_id
        and has_company_access(c.company_id)
    )
  );

create policy business_journeys_write on business_journeys
  for all to authenticated
  using (
    exists (
      select 1 from contracts c
      where c.id = business_journeys.contract_id
        and can_write_company(c.company_id)
    )
  )
  with check (
    exists (
      select 1 from contracts c
      where c.id = business_journeys.contract_id
        and can_write_company(c.company_id)
    )
  );

-- 履歴ログ: 組織内全員が閲覧、insert は authenticated 全員
drop policy if exists journey_events_select on journey_events;
drop policy if exists journey_events_insert on journey_events;

create policy journey_events_select on journey_events
  for select to authenticated
  using (organization_id = current_org_id());

create policy journey_events_insert on journey_events
  for insert to authenticated
  with check (organization_id = current_org_id());

-- チェックポイント完了状態: 親 (会社 or 契約) の権限で制御
drop policy if exists journey_checkpoint_status_select on journey_checkpoint_status;
drop policy if exists journey_checkpoint_status_write  on journey_checkpoint_status;

create policy journey_checkpoint_status_select on journey_checkpoint_status
  for select to authenticated
  using (
    organization_id = current_org_id()
    and (
      is_manager_or_above()
      or (
        journey_type = 'company'
        and has_company_access(subject_id)
      )
      or (
        journey_type = 'business'
        and exists (
          select 1 from contracts c
          where c.id = subject_id
            and has_company_access(c.company_id)
        )
      )
    )
  );

create policy journey_checkpoint_status_write on journey_checkpoint_status
  for all to authenticated
  using (
    organization_id = current_org_id()
    and (
      (journey_type = 'company' and can_write_company(subject_id))
      or (
        journey_type = 'business'
        and exists (
          select 1 from contracts c
          where c.id = subject_id
            and can_write_company(c.company_id)
        )
      )
    )
  )
  with check (
    organization_id = current_org_id()
    and (
      (journey_type = 'company' and can_write_company(subject_id))
      or (
        journey_type = 'business'
        and exists (
          select 1 from contracts c
          where c.id = subject_id
            and can_write_company(c.company_id)
        )
      )
    )
  );

-- ============================================================
-- END 0028
-- ============================================================
