-- ============================================================
-- 0019_is_demo_flag.sql — companies に is_demo フラグ追加 + CASCADE 整備
--
-- 目的:
--   本番運用開始前のフェーズで投入したダミーデータを後から一括削除
--   できるよう、companies に is_demo (boolean) を追加し、関連テーブル
--   が DELETE CASCADE で道連れ削除されることを保証する。
--
-- ポリシー:
--   - 既存の全 companies は is_demo = true として着地 (本番開始前のため)
--   - 新規 companies のデフォルトは true (登録ウィザードで明示制御も可能)
--   - 本番運用開始時: 一括削除 → INSERT (is_demo=false) → ALTER で
--     default を false に変更する想定
--
-- CASCADE 監査結果 (0001_init.sql 読み取り):
--   既に CASCADE になっているもの:
--     company_contacts, stakeholders, participants, sessions,
--     attendance_events, onboarding_tasks, account_journeys,
--     account_journey_events, success_plans, success_plan_goals,
--     renewal_milestones, health_score_snapshots, weekly_reviews,
--     weekly_actions, weekly_next_actions, meeting_logs, assignments
--   ON DELETE RESTRICT になっており、本マイグレーションで CASCADE に
--   変更するもの:
--     contracts.company_id (RESTRICT → CASCADE)
--     churn_events.contract_id (RESTRICT → CASCADE; contracts CASCADE 経由)
--   その他 (FK 無し / orphan に近いもの) は手作業対応:
--     surveys.contract_id (ON DELETE 指定なし) → SET NULL に変更
--     survey_responses.company_id (同上) → SET NULL
--   組織直下の参照 (company_tasks 等の追加マイグレ) は別途対応:
--     0014_company_tasks.sql など後続マイグレが company_id FK を CASCADE
--     で定義しているはず (確認済)
-- ============================================================

-- 1) is_demo カラム追加
alter table companies
  add column if not exists is_demo boolean not null default true;

-- 既存データを明示的に true に揃える (default=true なので冗長だが安全側)
update companies set is_demo = true where is_demo is not true;

-- 部分インデックス: デモ件数集計 / 一括削除のスキャン高速化
create index if not exists companies_is_demo_idx
  on companies(is_demo) where is_demo = true;

-- 2) FK を CASCADE に変更
--    contracts → companies: RESTRICT を CASCADE に
do $$
declare
  fk_name text;
begin
  select conname into fk_name
    from pg_constraint
   where conrelid = 'contracts'::regclass
     and confrelid = 'companies'::regclass
     and contype = 'f';
  if fk_name is not null then
    execute format('alter table contracts drop constraint %I', fk_name);
  end if;
  alter table contracts
    add constraint contracts_company_id_fkey
    foreign key (company_id) references companies(id) on delete cascade;
end $$;

--    churn_events → contracts: contracts CASCADE で連鎖したいので CASCADE 化
do $$
declare
  fk_name text;
begin
  select conname into fk_name
    from pg_constraint
   where conrelid = 'churn_events'::regclass
     and confrelid = 'contracts'::regclass
     and contype = 'f';
  if fk_name is not null then
    execute format('alter table churn_events drop constraint %I', fk_name);
  end if;
  alter table churn_events
    add constraint churn_events_contract_id_fkey
    foreign key (contract_id) references contracts(id) on delete cascade;
end $$;

-- 3) survey 系: 顧客削除時 NULL 化 (アンケート集計の履歴は残す)
do $$
declare
  fk_name text;
begin
  -- surveys.contract_id
  select conname into fk_name
    from pg_constraint
   where conrelid = 'surveys'::regclass
     and confrelid = 'contracts'::regclass
     and contype = 'f';
  if fk_name is not null then
    execute format('alter table surveys drop constraint %I', fk_name);
    alter table surveys
      add constraint surveys_contract_id_fkey
      foreign key (contract_id) references contracts(id) on delete set null;
  end if;

  -- survey_responses.company_id
  select conname into fk_name
    from pg_constraint
   where conrelid = 'survey_responses'::regclass
     and confrelid = 'companies'::regclass
     and contype = 'f'
     and pg_get_constraintdef(oid) ilike '%company_id%';
  if fk_name is not null then
    execute format('alter table survey_responses drop constraint %I', fk_name);
    alter table survey_responses
      add constraint survey_responses_company_id_fkey
      foreign key (company_id) references companies(id) on delete set null;
  end if;
end $$;

-- ============================================================
-- END 0019_is_demo_flag.sql
-- ============================================================
