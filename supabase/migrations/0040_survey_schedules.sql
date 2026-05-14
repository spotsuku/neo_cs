-- ============================================================
-- 0040: アンケートスケジュール (survey_schedules)
--   - 研修 × タイミング ごとのアンケート発生定義
--   - lib/mock/surveys.ts:surveySchedules を正本に DB へ移送
--   - seed として既存 22 件を一括 INSERT
-- ============================================================

create table if not exists survey_schedules (
  id                      text primary key,
  organization_id         uuid not null references organizations(id),
  product_code            text not null references products(code),
  name                    text not null,
  template_ids            jsonb not null default '[]'::jsonb,
  trigger                 jsonb not null,
  respondent_target       text not null check (respondent_target in
    ('all_stakeholders','primary_contact','all_participants','custom')),
  expected_respondent_ids jsonb,
  active                  boolean not null default true,
  created_at              timestamptz not null default now()
);

create index if not exists survey_schedules_org_idx on survey_schedules(organization_id);
create index if not exists survey_schedules_product_idx on survey_schedules(product_code);

-- RLS (surveys と同じ「配信側は全社が見える」設計を踏襲)
alter table survey_schedules enable row level security;

drop policy if exists survey_schedules_select on survey_schedules;
drop policy if exists survey_schedules_write on survey_schedules;
create policy survey_schedules_select on survey_schedules
  for select to authenticated
  using (is_authenticated_active());
create policy survey_schedules_write on survey_schedules
  for all to authenticated
  using (is_manager_or_above())
  with check (is_manager_or_above());

-- ============================================================
-- 初期 seed (lib/mock/surveys.ts:surveySchedules)
-- 既存 mock データと整合させる。再実行に強いよう on conflict do nothing。
-- ============================================================
insert into survey_schedules (id, organization_id, product_code, name, template_ids, trigger, respondent_target, active) values
  ('sch-academia-stakeholder-yearly', '00000000-0000-0000-0000-000000000001', 'academia', 'ACADEMIA 担当者向け定期アンケート（年3回）', '["tpl-stakeholder"]'::jsonb, '{"type":"periodic_yearly","atMonths":[3,7,11]}'::jsonb, 'all_stakeholders', true),
  ('sch-academia-participant-kickoff', '00000000-0000-0000-0000-000000000001', 'academia', 'ACADEMIA 参加者向け Kickoff後アンケート', '["tpl-common","tpl-academia","tpl-kickoff"]'::jsonb, '{"type":"at_session_type","sessionType":"kickoff"}'::jsonb, 'all_participants', true),
  ('sch-academia-participant-midterm', '00000000-0000-0000-0000-000000000001', 'academia', 'ACADEMIA 参加者向け 中間アンケート', '["tpl-common","tpl-academia","tpl-midterm"]'::jsonb, '{"type":"at_session_type","sessionType":"midterm"}'::jsonb, 'all_participants', true),
  ('sch-academia-participant-final', '00000000-0000-0000-0000-000000000001', 'academia', 'ACADEMIA 参加者向け 最終アンケート', '["tpl-common","tpl-academia","tpl-final"]'::jsonb, '{"type":"at_session_type","sessionType":"final"}'::jsonb, 'all_participants', true),
  ('sch-academia-participant-session5', '00000000-0000-0000-0000-000000000001', 'academia', 'ACADEMIA 第5回講義後アンケート', '["tpl-common","tpl-academia"]'::jsonb, '{"type":"after_session","sessionNumber":5}'::jsonb, 'all_participants', true),
  ('sch-academia-participant-session15', '00000000-0000-0000-0000-000000000001', 'academia', 'ACADEMIA 第15回講義後アンケート', '["tpl-common","tpl-academia"]'::jsonb, '{"type":"after_session","sessionNumber":15}'::jsonb, 'all_participants', true),
  ('sch-academia-1ki-1q-participant', '00000000-0000-0000-0000-000000000001', 'academia', 'ACADEMIA 1期 1学期アンケート（参加者）', '[]'::jsonb, '{"type":"at_session_type","sessionType":"term1"}'::jsonb, 'all_participants', true),
  ('sch-academia-1ki-2q-participant', '00000000-0000-0000-0000-000000000001', 'academia', 'ACADEMIA 1期 2学期アンケート（参加者）', '[]'::jsonb, '{"type":"at_session_type","sessionType":"term2"}'::jsonb, 'all_participants', true),
  ('sch-academia-1ki-3q-participant', '00000000-0000-0000-0000-000000000001', 'academia', 'ACADEMIA 1期 1年間振り返りアンケート（参加者）', '[]'::jsonb, '{"type":"at_session_type","sessionType":"final"}'::jsonb, 'all_participants', true),
  ('sch-academia-1ki-1q-stakeholder', '00000000-0000-0000-0000-000000000001', 'academia', 'ACADEMIA 1期 1学期アンケート（担当者）', '[]'::jsonb, '{"type":"at_session_type","sessionType":"term1"}'::jsonb, 'all_stakeholders', true),
  ('sch-academia-1ki-2q-stakeholder', '00000000-0000-0000-0000-000000000001', 'academia', 'ACADEMIA 1期 2学期アンケート（担当者）', '[]'::jsonb, '{"type":"at_session_type","sessionType":"term2"}'::jsonb, 'all_stakeholders', true),
  ('sch-academia-1ki-3q-stakeholder', '00000000-0000-0000-0000-000000000001', 'academia', 'ACADEMIA 1期 3学期アンケート（担当者）', '[]'::jsonb, '{"type":"at_session_type","sessionType":"final"}'::jsonb, 'all_stakeholders', true),
  ('sch-academia-1ki-per-lecture', '00000000-0000-0000-0000-000000000001', 'academia', 'ACADEMIA 1期 各講義後アンケート', '[]'::jsonb, '{"type":"after_session","sessionNumber":0}'::jsonb, 'all_participants', true),
  ('sch-hyogikai-stakeholder-yearly', '00000000-0000-0000-0000-000000000001', 'hyogikai', '評議会 担当者向け定期アンケート（年2回）', '["tpl-stakeholder"]'::jsonb, '{"type":"periodic_yearly","atMonths":[4,10]}'::jsonb, 'primary_contact', true),
  ('sch-hyogikai-participant-session', '00000000-0000-0000-0000-000000000001', 'hyogikai', '評議会 参加者向け 定例後アンケート', '["tpl-common","tpl-hyogikai"]'::jsonb, '{"type":"at_session_type","sessionType":"session"}'::jsonb, 'all_participants', true),
  ('sch-hyogikai-participant-kickoff', '00000000-0000-0000-0000-000000000001', 'hyogikai', '評議会 参加者向け 初回アンケート', '["tpl-common","tpl-hyogikai","tpl-kickoff"]'::jsonb, '{"type":"at_session_type","sessionType":"kickoff"}'::jsonb, 'all_participants', true),
  ('sch-aiken-day1', '00000000-0000-0000-0000-000000000001', 'aiken', 'AIKEN Day1後アンケート', '["tpl-common","tpl-aiken"]'::jsonb, '{"type":"after_session","sessionNumber":1}'::jsonb, 'all_participants', true),
  ('sch-aiken-day2', '00000000-0000-0000-0000-000000000001', 'aiken', 'AIKEN Day2後アンケート', '["tpl-common","tpl-aiken"]'::jsonb, '{"type":"after_session","sessionNumber":2}'::jsonb, 'all_participants', true),
  ('sch-aiken-final', '00000000-0000-0000-0000-000000000001', 'aiken', 'AIKEN 修了アンケート', '["tpl-common","tpl-aiken","tpl-final"]'::jsonb, '{"type":"at_session_type","sessionType":"final"}'::jsonb, 'all_participants', true),
  ('sch-commu-monthly1', '00000000-0000-0000-0000-000000000001', 'commu', 'コミュマネ 月次定例1後アンケート', '["tpl-common","tpl-commu"]'::jsonb, '{"type":"after_session","sessionNumber":1}'::jsonb, 'all_participants', true),
  ('sch-commu-monthly2', '00000000-0000-0000-0000-000000000001', 'commu', 'コミュマネ 月次定例2後アンケート', '["tpl-common","tpl-commu"]'::jsonb, '{"type":"after_session","sessionNumber":2}'::jsonb, 'all_participants', true),
  ('sch-commu-final', '00000000-0000-0000-0000-000000000001', 'commu', 'コミュマネ 更新前アンケート', '["tpl-common","tpl-commu","tpl-final"]'::jsonb, '{"type":"at_session_type","sessionType":"final"}'::jsonb, 'all_participants', true)
on conflict (id) do nothing;
