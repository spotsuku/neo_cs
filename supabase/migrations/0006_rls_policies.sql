-- ============================================================
-- 0006_rls_policies.sql
-- ストリーム01 P1: 残テーブルの RLS ポリシー全展開
--
-- 0001_init.sql で全テーブル `enable row level security` 済（ポリシー無し
-- =デフォルト全拒否）。本ファイルで anon を完全締め出し、authenticated に
-- 役割ベースのアクセスを与える。one_on_one_logs は 0003 で完了済 (再定義
-- しない)。
--
-- ロール:
--   - admin   : 全テーブル全行 R/W
--   - manager : 全件 read、編集は assignments で active 担当の company / contract
--   - member  : assignments で active 担当の company / contract のみ R/W
--   - viewer  : authenticated 全件 read のみ
-- 監査・操作ログ系: read は admin のみ、insert は service_role のみ
-- マスタ系 (products, survey_templates 等): authenticated 全件 read、admin write
-- ============================================================

-- ============================================================
-- 0. ヘルパ関数 (0003 と重複定義しないよう create or replace)
-- ============================================================

-- 認証ユーザーが admin か
create or replace function is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from app_users u
    where u.auth_user_id = auth.uid()
      and u.is_active
      and u.role = 'admin'
  );
$$;

-- 認証ユーザーが manager 以上 (admin or manager) か
create or replace function is_manager_or_above()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from app_users u
    where u.auth_user_id = auth.uid()
      and u.is_active
      and u.role in ('admin','manager')
  );
$$;

-- 認証ユーザーが viewer 以上 (= 認証済アクティブユーザー全員) か
create or replace function is_authenticated_active()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from app_users u
    where u.auth_user_id = auth.uid()
      and u.is_active
  );
$$;

-- 現セッションの app_users.id
create or replace function current_app_user_id()
returns uuid
language sql
stable
as $$
  select u.id from app_users u
  where u.auth_user_id = auth.uid()
    and u.is_active
  limit 1;
$$;

-- 現セッションの app_users.organization_id
create or replace function current_org_id()
returns uuid
language sql
stable
as $$
  select u.organization_id from app_users u
  where u.auth_user_id = auth.uid()
    and u.is_active
  limit 1;
$$;

-- 現ユーザーが指定 company に active アサインされているか
create or replace function has_company_access(p_company_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from assignments a
    where a.company_id = p_company_id
      and a.user_id = current_app_user_id()
      and a.unassigned_at is null
  );
$$;

-- 書込み権限: admin / manager / 担当member
create or replace function can_write_company(p_company_id text)
returns boolean
language sql
stable
as $$
  select is_manager_or_above() or has_company_access(p_company_id);
$$;

-- ============================================================
-- 1. organizations
-- ============================================================
drop policy if exists organizations_select on organizations;
drop policy if exists organizations_write  on organizations;

create policy organizations_select on organizations
  for select to authenticated
  using (
    is_authenticated_active()
    and (is_admin() or id = current_org_id())
  );

create policy organizations_write on organizations
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- ============================================================
-- 2. app_users
-- ============================================================
drop policy if exists app_users_select on app_users;
drop policy if exists app_users_self_update on app_users;
drop policy if exists app_users_admin_write on app_users;

-- self read + 同一 org の active ユーザーを read (担当者一覧表示)
create policy app_users_select on app_users
  for select to authenticated
  using (
    is_admin()
    or auth_user_id = auth.uid()
    or organization_id = current_org_id()
  );

-- 自分のレコードの一部更新は許容 (last_login_at / picture_url 等のプロファイル)
-- ただし role / is_active / organization_id の変更は admin のみ。
-- ここでは UPDATE 全般を許す代わりに、role 等のチェックは別途 audit + 03 のロジックで担保。
create policy app_users_self_update on app_users
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

create policy app_users_admin_write on app_users
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- ============================================================
-- 3. マスタ系 (products / product_courses / onboarding template /
--             survey_questions / survey_templates / survey_template_questions)
--    authenticated 全件 read、admin write
-- ============================================================
do $$
declare t text;
begin
  for t in select unnest(array[
      'products',
      'product_courses',
      'onboarding_template_categories',
      'onboarding_template_items',
      'survey_questions',
      'survey_templates',
      'survey_template_questions'
    ])
  loop
    execute format('drop policy if exists %I_select on %I', t || '_master', t);
    execute format('drop policy if exists %I_write  on %I', t || '_master', t);
    execute format($f$
      create policy %I_select on %I
        for select to authenticated
        using (is_authenticated_active())
    $f$, t || '_master', t);
    execute format($f$
      create policy %I_write on %I
        for all to authenticated
        using (is_admin())
        with check (is_admin())
    $f$, t || '_master', t);
  end loop;
end$$;

-- ============================================================
-- 4. companies + 子テーブル (contacts / stakeholders)
-- ============================================================
drop policy if exists companies_select on companies;
drop policy if exists companies_write  on companies;

create policy companies_select on companies
  for select to authenticated
  using (
    is_admin()
    or is_manager_or_above()
    or has_company_access(id)
  );

create policy companies_write on companies
  for all to authenticated
  using (can_write_company(id))
  with check (can_write_company(id));

drop policy if exists company_contacts_select on company_contacts;
drop policy if exists company_contacts_write  on company_contacts;
create policy company_contacts_select on company_contacts
  for select to authenticated
  using (is_manager_or_above() or has_company_access(company_id));
create policy company_contacts_write on company_contacts
  for all to authenticated
  using (can_write_company(company_id))
  with check (can_write_company(company_id));

drop policy if exists company_contact_products_select on company_contact_products;
drop policy if exists company_contact_products_write  on company_contact_products;
create policy company_contact_products_select on company_contact_products
  for select to authenticated
  using (
    is_manager_or_above()
    or exists (
      select 1 from company_contacts c
      where c.id = company_contact_products.contact_id
        and has_company_access(c.company_id)
    )
  );
create policy company_contact_products_write on company_contact_products
  for all to authenticated
  using (
    is_manager_or_above()
    or exists (
      select 1 from company_contacts c
      where c.id = company_contact_products.contact_id
        and has_company_access(c.company_id)
    )
  )
  with check (
    is_manager_or_above()
    or exists (
      select 1 from company_contacts c
      where c.id = company_contact_products.contact_id
        and has_company_access(c.company_id)
    )
  );

drop policy if exists stakeholders_select on stakeholders;
drop policy if exists stakeholders_write  on stakeholders;
create policy stakeholders_select on stakeholders
  for select to authenticated
  using (is_manager_or_above() or has_company_access(company_id));
create policy stakeholders_write on stakeholders
  for all to authenticated
  using (can_write_company(company_id))
  with check (can_write_company(company_id));

drop policy if exists stakeholder_products_select on stakeholder_products;
drop policy if exists stakeholder_products_write  on stakeholder_products;
create policy stakeholder_products_select on stakeholder_products
  for select to authenticated
  using (
    is_manager_or_above()
    or exists (
      select 1 from stakeholders s
      where s.id = stakeholder_products.stakeholder_id
        and has_company_access(s.company_id)
    )
  );
create policy stakeholder_products_write on stakeholder_products
  for all to authenticated
  using (
    is_manager_or_above()
    or exists (
      select 1 from stakeholders s
      where s.id = stakeholder_products.stakeholder_id
        and has_company_access(s.company_id)
    )
  )
  with check (
    is_manager_or_above()
    or exists (
      select 1 from stakeholders s
      where s.id = stakeholder_products.stakeholder_id
        and has_company_access(s.company_id)
    )
  );

-- ============================================================
-- 5. contracts + 子テーブル
-- ============================================================
drop policy if exists contracts_select on contracts;
drop policy if exists contracts_write  on contracts;
create policy contracts_select on contracts
  for select to authenticated
  using (is_manager_or_above() or has_company_access(company_id));
create policy contracts_write on contracts
  for all to authenticated
  using (can_write_company(company_id))
  with check (can_write_company(company_id));

drop policy if exists participants_select on participants;
drop policy if exists participants_write  on participants;
create policy participants_select on participants
  for select to authenticated
  using (is_manager_or_above() or has_company_access(company_id));
create policy participants_write on participants
  for all to authenticated
  using (can_write_company(company_id))
  with check (can_write_company(company_id));

drop policy if exists sessions_select on sessions;
drop policy if exists sessions_write  on sessions;
create policy sessions_select on sessions
  for select to authenticated
  using (
    is_manager_or_above()
    or exists (
      select 1 from contracts c where c.id = sessions.contract_id
        and has_company_access(c.company_id)
    )
  );
create policy sessions_write on sessions
  for all to authenticated
  using (
    is_manager_or_above()
    or exists (
      select 1 from contracts c where c.id = sessions.contract_id
        and has_company_access(c.company_id)
    )
  )
  with check (
    is_manager_or_above()
    or exists (
      select 1 from contracts c where c.id = sessions.contract_id
        and has_company_access(c.company_id)
    )
  );

drop policy if exists attendance_events_select on attendance_events;
drop policy if exists attendance_events_write  on attendance_events;
create policy attendance_events_select on attendance_events
  for select to authenticated
  using (
    is_manager_or_above()
    or exists (
      select 1 from participants p where p.id = attendance_events.participant_id
        and has_company_access(p.company_id)
    )
  );
create policy attendance_events_write on attendance_events
  for all to authenticated
  using (
    is_manager_or_above()
    or exists (
      select 1 from participants p where p.id = attendance_events.participant_id
        and has_company_access(p.company_id)
    )
  )
  with check (
    is_manager_or_above()
    or exists (
      select 1 from participants p where p.id = attendance_events.participant_id
        and has_company_access(p.company_id)
    )
  );

-- ============================================================
-- 6. オンボーディング
-- ============================================================
drop policy if exists onboarding_tasks_select on onboarding_tasks;
drop policy if exists onboarding_tasks_write  on onboarding_tasks;
create policy onboarding_tasks_select on onboarding_tasks
  for select to authenticated
  using (
    is_manager_or_above()
    or exists (
      select 1 from contracts c where c.id = onboarding_tasks.contract_id
        and has_company_access(c.company_id)
    )
  );
create policy onboarding_tasks_write on onboarding_tasks
  for all to authenticated
  using (
    is_manager_or_above()
    or exists (
      select 1 from contracts c where c.id = onboarding_tasks.contract_id
        and has_company_access(c.company_id)
    )
  )
  with check (
    is_manager_or_above()
    or exists (
      select 1 from contracts c where c.id = onboarding_tasks.contract_id
        and has_company_access(c.company_id)
    )
  );

-- ============================================================
-- 7. アカウントジャーニー / Success Plan / 更新マイルストーン
-- ============================================================
drop policy if exists account_journeys_select on account_journeys;
drop policy if exists account_journeys_write  on account_journeys;
create policy account_journeys_select on account_journeys
  for select to authenticated
  using (is_manager_or_above() or has_company_access(company_id));
create policy account_journeys_write on account_journeys
  for all to authenticated
  using (can_write_company(company_id))
  with check (can_write_company(company_id));

drop policy if exists account_journey_events_select on account_journey_events;
drop policy if exists account_journey_events_write  on account_journey_events;
create policy account_journey_events_select on account_journey_events
  for select to authenticated
  using (is_manager_or_above() or has_company_access(company_id));
create policy account_journey_events_write on account_journey_events
  for all to authenticated
  using (can_write_company(company_id))
  with check (can_write_company(company_id));

drop policy if exists success_plans_select on success_plans;
drop policy if exists success_plans_write  on success_plans;
create policy success_plans_select on success_plans
  for select to authenticated
  using (
    is_manager_or_above()
    or exists (
      select 1 from contracts c where c.id = success_plans.contract_id
        and has_company_access(c.company_id)
    )
  );
create policy success_plans_write on success_plans
  for all to authenticated
  using (
    is_manager_or_above()
    or exists (
      select 1 from contracts c where c.id = success_plans.contract_id
        and has_company_access(c.company_id)
    )
  )
  with check (
    is_manager_or_above()
    or exists (
      select 1 from contracts c where c.id = success_plans.contract_id
        and has_company_access(c.company_id)
    )
  );

drop policy if exists success_plan_goals_select on success_plan_goals;
drop policy if exists success_plan_goals_write  on success_plan_goals;
create policy success_plan_goals_select on success_plan_goals
  for select to authenticated
  using (
    is_manager_or_above()
    or exists (
      select 1 from contracts c where c.id = success_plan_goals.contract_id
        and has_company_access(c.company_id)
    )
  );
create policy success_plan_goals_write on success_plan_goals
  for all to authenticated
  using (
    is_manager_or_above()
    or exists (
      select 1 from contracts c where c.id = success_plan_goals.contract_id
        and has_company_access(c.company_id)
    )
  )
  with check (
    is_manager_or_above()
    or exists (
      select 1 from contracts c where c.id = success_plan_goals.contract_id
        and has_company_access(c.company_id)
    )
  );

drop policy if exists renewal_milestones_select on renewal_milestones;
drop policy if exists renewal_milestones_write  on renewal_milestones;
create policy renewal_milestones_select on renewal_milestones
  for select to authenticated
  using (
    is_manager_or_above()
    or exists (
      select 1 from contracts c where c.id = renewal_milestones.contract_id
        and has_company_access(c.company_id)
    )
  );
create policy renewal_milestones_write on renewal_milestones
  for all to authenticated
  using (
    is_manager_or_above()
    or exists (
      select 1 from contracts c where c.id = renewal_milestones.contract_id
        and has_company_access(c.company_id)
    )
  )
  with check (
    is_manager_or_above()
    or exists (
      select 1 from contracts c where c.id = renewal_milestones.contract_id
        and has_company_access(c.company_id)
    )
  );

-- ============================================================
-- 8. health_score_snapshots (read 制限、write は service_role のみ = 日次バッチ)
-- ============================================================
drop policy if exists health_snapshots_select on health_score_snapshots;
create policy health_snapshots_select on health_score_snapshots
  for select to authenticated
  using (
    is_manager_or_above()
    or exists (
      select 1 from contracts c where c.id = health_score_snapshots.contract_id
        and has_company_access(c.company_id)
    )
  );
-- write は service_role が RLS バイパスで実行 (insert/update ポリシー無し = 拒否)

-- ============================================================
-- 9. 週次レビュー
-- ============================================================
drop policy if exists weekly_reviews_select on weekly_reviews;
drop policy if exists weekly_reviews_write  on weekly_reviews;
create policy weekly_reviews_select on weekly_reviews
  for select to authenticated
  using (is_manager_or_above() or has_company_access(company_id));
create policy weekly_reviews_write on weekly_reviews
  for all to authenticated
  using (can_write_company(company_id))
  with check (can_write_company(company_id));

drop policy if exists weekly_actions_select on weekly_actions;
drop policy if exists weekly_actions_write  on weekly_actions;
create policy weekly_actions_select on weekly_actions
  for select to authenticated
  using (
    is_manager_or_above()
    or exists (
      select 1 from weekly_reviews r where r.id = weekly_actions.weekly_review_id
        and has_company_access(r.company_id)
    )
  );
create policy weekly_actions_write on weekly_actions
  for all to authenticated
  using (
    is_manager_or_above()
    or exists (
      select 1 from weekly_reviews r where r.id = weekly_actions.weekly_review_id
        and has_company_access(r.company_id)
    )
  )
  with check (
    is_manager_or_above()
    or exists (
      select 1 from weekly_reviews r where r.id = weekly_actions.weekly_review_id
        and has_company_access(r.company_id)
    )
  );

drop policy if exists weekly_next_actions_select on weekly_next_actions;
drop policy if exists weekly_next_actions_write  on weekly_next_actions;
create policy weekly_next_actions_select on weekly_next_actions
  for select to authenticated
  using (
    is_manager_or_above()
    or exists (
      select 1 from weekly_reviews r where r.id = weekly_next_actions.weekly_review_id
        and has_company_access(r.company_id)
    )
  );
create policy weekly_next_actions_write on weekly_next_actions
  for all to authenticated
  using (
    is_manager_or_above()
    or exists (
      select 1 from weekly_reviews r where r.id = weekly_next_actions.weekly_review_id
        and has_company_access(r.company_id)
    )
  )
  with check (
    is_manager_or_above()
    or exists (
      select 1 from weekly_reviews r where r.id = weekly_next_actions.weekly_review_id
        and has_company_access(r.company_id)
    )
  );

-- ============================================================
-- 10. 面談ログ
-- ============================================================
drop policy if exists meeting_logs_select on meeting_logs;
drop policy if exists meeting_logs_write  on meeting_logs;
create policy meeting_logs_select on meeting_logs
  for select to authenticated
  using (is_manager_or_above() or has_company_access(company_id));
create policy meeting_logs_write on meeting_logs
  for all to authenticated
  using (can_write_company(company_id))
  with check (can_write_company(company_id));

-- ============================================================
-- 11. アンケート
-- ============================================================
drop policy if exists surveys_select on surveys;
drop policy if exists surveys_write  on surveys;
create policy surveys_select on surveys
  for select to authenticated
  using (is_authenticated_active());  -- 配信側は全社が見える設計
create policy surveys_write on surveys
  for all to authenticated
  using (is_manager_or_above())
  with check (is_manager_or_above());

drop policy if exists survey_responses_select on survey_responses;
drop policy if exists survey_responses_write  on survey_responses;
create policy survey_responses_select on survey_responses
  for select to authenticated
  using (
    is_manager_or_above()
    or (company_id is not null and has_company_access(company_id))
  );
create policy survey_responses_write on survey_responses
  for all to authenticated
  using (
    is_manager_or_above()
    or (company_id is not null and has_company_access(company_id))
  )
  with check (
    is_manager_or_above()
    or (company_id is not null and has_company_access(company_id))
  );

-- ============================================================
-- 12. 解約 (churn_events / churn_event_reasons)
-- ============================================================
drop policy if exists churn_events_select on churn_events;
drop policy if exists churn_events_write  on churn_events;
create policy churn_events_select on churn_events
  for select to authenticated
  using (
    is_manager_or_above()
    or exists (
      select 1 from contracts c where c.id = churn_events.contract_id
        and has_company_access(c.company_id)
    )
  );
create policy churn_events_write on churn_events
  for all to authenticated
  using (
    is_manager_or_above()
    or exists (
      select 1 from contracts c where c.id = churn_events.contract_id
        and has_company_access(c.company_id)
    )
  )
  with check (
    is_manager_or_above()
    or exists (
      select 1 from contracts c where c.id = churn_events.contract_id
        and has_company_access(c.company_id)
    )
  );

drop policy if exists churn_event_reasons_select on churn_event_reasons;
drop policy if exists churn_event_reasons_write  on churn_event_reasons;
create policy churn_event_reasons_select on churn_event_reasons
  for select to authenticated
  using (
    exists (
      select 1 from churn_events e where e.id = churn_event_reasons.churn_event_id
    )  -- 親 churn_events の RLS で既に絞られる前提だが、明示的に EXISTS
  );
create policy churn_event_reasons_write on churn_event_reasons
  for all to authenticated
  using (is_manager_or_above())
  with check (is_manager_or_above());

-- ============================================================
-- 13. assignments
-- ============================================================
drop policy if exists assignments_select on assignments;
drop policy if exists assignments_write  on assignments;
create policy assignments_select on assignments
  for select to authenticated
  using (
    is_manager_or_above()
    or user_id = current_app_user_id()
    or has_company_access(company_id)
  );
create policy assignments_write on assignments
  for all to authenticated
  using (is_manager_or_above())
  with check (is_manager_or_above());

-- ============================================================
-- 14. churn_signals (D項)
-- ============================================================
drop policy if exists churn_signals_select on churn_signals;
drop policy if exists churn_signals_write  on churn_signals;
create policy churn_signals_select on churn_signals
  for select to authenticated
  using (is_manager_or_above() or has_company_access(company_id));
-- resolve / markNotified は担当者 + manager が可能
create policy churn_signals_write on churn_signals
  for all to authenticated
  using (can_write_company(company_id))
  with check (can_write_company(company_id));

-- ============================================================
-- 15. kpi_snapshots (E項) — read のみ、write は service_role の日次バッチ
-- ============================================================
drop policy if exists kpi_snapshots_select on kpi_snapshots;
create policy kpi_snapshots_select on kpi_snapshots
  for select to authenticated
  using (
    is_manager_or_above()
    or organization_id = current_org_id()
  );

-- ============================================================
-- 16. drafts (autosave) — 所有者本人のみ
-- ============================================================
drop policy if exists drafts_select on drafts;
drop policy if exists drafts_write  on drafts;
create policy drafts_select on drafts
  for select to authenticated
  using (owner_user_id = current_app_user_id() or is_admin());
create policy drafts_write on drafts
  for all to authenticated
  using (owner_user_id = current_app_user_id())
  with check (owner_user_id = current_app_user_id());

-- ============================================================
-- 17. audit_logs / domain_events / consent_records
--   - select は admin のみ (法務・SRE 用途)
--   - insert は service_role のみ (RLS バイパス)
-- ============================================================
drop policy if exists audit_logs_select on audit_logs;
create policy audit_logs_select on audit_logs
  for select to authenticated
  using (is_admin());
-- insert/update/delete: ポリシー無し = 拒否。service_role の RLS バイパスのみ可

drop policy if exists domain_events_select on domain_events;
create policy domain_events_select on domain_events
  for select to authenticated
  using (is_admin() or organization_id = current_org_id());

drop policy if exists consent_records_select on consent_records;
drop policy if exists consent_records_write  on consent_records;
create policy consent_records_select on consent_records
  for select to authenticated
  using (is_admin() or organization_id = current_org_id());
create policy consent_records_write on consent_records
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- ============================================================
-- 18. anon ロール: 一切付与しない
-- ============================================================
-- すべてのテーブルで anon は RLS により拒否される。
-- 念のため、schema usage を anon から外したい場合は以下を実行:
-- (Supabase デフォルトでは anon に schema usage が与えられているため、
--  RLS = ポリシー無し = 拒否、で読み書き不可)
-- revoke usage on schema public from anon;  -- ※他プロジェクトに影響するため本ファイルでは実行しない

-- ============================================================
-- END 0006
-- ============================================================
