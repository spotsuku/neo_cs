-- ============================================================
-- 0010_expansion_opportunities.sql
-- ストリーム01 P1: expansion_opportunities テーブル (申し送り u)
--
-- ストリーム02 F-2「エクスパンション機会の検知 + 営業引き継ぎ」用。
-- churn_signals (0004) と同パターン。
--
-- 業務:
--   - lib/domain/expansion.ts (純関数) が contracts × snapshots × surveys
--     から候補を出す
--   - 検知バッチ → 本テーブルに upsert
--   - 営業引き継ぎ済みは handed_off_at + handed_off_to で記録
--   - クローズは closed_at + closed_reason ('won'|'lost'|'deferred'|'duplicate')
--   - notified_at は Slack 通知済みフラグ (重複防止)
-- ============================================================

create table expansion_opportunities (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references organizations(id),
  contract_id          text not null references contracts(id) on delete cascade,
  company_id           text not null references companies(id) on delete cascade,
  product              text not null,
  kind                 text not null check (kind in (
                         'upsell_higher_plan',
                         'cross_sell_other_product',
                         'seat_expansion',
                         'renewal_uplift'
                       )),
  rule                 text not null check (rule in (
                         'healthy_streak',
                         'survey_signal',
                         'seat_at_capacity',
                         'champion_promoted',
                         'renewal_window_green'
                       )),
  score                numeric(5,2) not null,
  reason               text not null,
  evidence             jsonb not null default '{}'::jsonb,
  suggested_action     text,
  estimated_upsell_jpy numeric(14,0),
  detected_at          timestamptz not null default now(),
  handed_off_at        timestamptz,
  handed_off_to        uuid references app_users(id),
  handed_off_note      text,
  closed_at            timestamptz,
  closed_reason        text check (closed_reason in ('won','lost','deferred','duplicate')),
  notified_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger expansion_opportunities_updated_at
  before update on expansion_opportunities
  for each row execute function set_updated_at();

-- 引き継ぎ済みは handed_off_to も必須
alter table expansion_opportunities
  add constraint expansion_opportunities_handoff_check
  check (handed_off_at is null or handed_off_to is not null);

-- closed なら reason 必須
alter table expansion_opportunities
  add constraint expansion_opportunities_close_check
  check (closed_at is null or closed_reason is not null);

-- 未クローズの機会一覧 (ContractExpansionOpportunities.tsx の listByContract が多用)
create index expansion_opportunities_open_idx
  on expansion_opportunities(contract_id, detected_at desc)
  where closed_at is null;

-- 通知バッチ: 未通知 score>=80
create index expansion_opportunities_unnotified_high_idx
  on expansion_opportunities(detected_at desc)
  where notified_at is null and score >= 80;

create index expansion_opportunities_org_idx
  on expansion_opportunities(organization_id);
create index expansion_opportunities_company_idx
  on expansion_opportunities(company_id);

-- ============================================================
-- RLS (0006 と同パターン: 担当 company 配下 read/write、admin/manager 全件)
-- ============================================================
alter table expansion_opportunities enable row level security;

drop policy if exists expansion_opportunities_select on expansion_opportunities;
drop policy if exists expansion_opportunities_write  on expansion_opportunities;

create policy expansion_opportunities_select on expansion_opportunities
  for select to authenticated
  using (is_manager_or_above() or has_company_access(company_id));

-- 引き継ぎ・クローズ・通知マークは担当者 + manager
create policy expansion_opportunities_write on expansion_opportunities
  for all to authenticated
  using (can_write_company(company_id))
  with check (can_write_company(company_id));

-- ============================================================
-- END 0010
-- ============================================================
