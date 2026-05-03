-- ============================================================
-- 0005_kpi_snapshots.sql
-- ストリーム01: kpi_snapshots テーブル (ストリーム02 E項 申し送り r)
--
-- 日次バッチが lib/domain/kpi.ts の純関数 (computeMrr / computeChurnRate /
-- computeNrr / computeAtRiskMrr) を呼んで本テーブルに upsert する。
-- /reports と app/page.tsx は本テーブルから SELECT して KPI を表示する
-- (P1 で切替予定。現状は mock 上でオンデマンド計算)。
-- ============================================================

create table kpi_snapshots (
  id                      bigserial primary key,
  organization_id         uuid not null references organizations(id),
  as_of                   date not null,
  total_mrr               numeric(14,0) not null,
  total_arr               numeric(14,0) not null,
  active_contract_count   int  not null,
  active_company_count    int  not null,
  churn_rate_30d          numeric(6,4),
  churn_rate_90d          numeric(6,4),
  nrr_30d                 numeric(6,4),
  nrr_90d                 numeric(6,4),
  at_risk_mrr             numeric(14,0),
  by_product              jsonb not null default '{}'::jsonb,
  by_segment              jsonb not null default '{}'::jsonb,
  computed_at             timestamptz not null default now(),
  unique (organization_id, as_of)
);

-- 申し送り r は (org_id, date) を PK と記載があったが、実装は bigserial PK +
-- (organization_id, as_of) UNIQUE 制約とした (既存マイグレーション群との整合
-- 性、bigserial 連番の有用性、upsert の onConflict 指定の単純さを優先)。
-- 検索性能・upsert 動作は同等。
create index kpi_snapshots_org_asof_idx
  on kpi_snapshots(organization_id, as_of desc);

alter table kpi_snapshots enable row level security;

-- ============================================================
-- END 0005
-- ============================================================
