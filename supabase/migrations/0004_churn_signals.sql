-- ============================================================
-- 0004_churn_signals.sql
-- ストリーム01: churn_signals テーブル (ストリーム02 D-2 申し送り k)
--
-- 解約予兆の検知結果を保持。
-- - mock 実装は lib/repository/mock/churnSignalRepo.ts (in-memory)
-- - supabase 実装は P1 後半で本テーブル上に展開
-- ============================================================

create table churn_signals (
  id              text primary key,
  organization_id uuid not null references organizations(id),
  contract_id     text not null references contracts(id) on delete cascade,
  company_id      text not null references companies(id) on delete cascade,
  product         text not null,
  rule            text not null check (rule in (
                    'score_drop',
                    'score_low_streak',
                    'consecutive_absence',
                    'milestone_overdue',
                    'usage_drop',
                    'survey_detractor'
                  )),
  severity        text not null check (severity in ('low','medium','high')),
  weight          smallint not null,
  reason          text not null,
  evidence        jsonb not null default '{}'::jsonb,
  detected_at     timestamptz not null default now(),
  resolved_at     timestamptz,
  resolved_by     uuid references app_users(id),
  resolution_note text,
  notified_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- 未解決シグナル: ContractChurnSignals.tsx の listByContract(unresolvedOnly) で多用
create index churn_signals_unresolved_idx
  on churn_signals(contract_id, detected_at desc)
  where resolved_at is null;

-- 通知バッチ用: 未通知 high シグナル
-- 申し送り k は IN ('high','critical') と記載があったが、現行 type 定義は
-- 'low'|'medium'|'high' の3段階 (lib/repository/types.ts ChurnSignalSeverity)
-- であり、Slack 側でのみ critical 昇格を行う設計 (D-3)。本 index は
-- DB 側の severity 値域に合わせ severity='high' のみを対象にする。
create index churn_signals_unnotified_high_idx
  on churn_signals(detected_at desc)
  where notified_at is null and severity = 'high';

create index churn_signals_org_idx on churn_signals(organization_id);
create index churn_signals_company_idx on churn_signals(company_id);

alter table churn_signals enable row level security;

-- ============================================================
-- END 0004
-- ============================================================
