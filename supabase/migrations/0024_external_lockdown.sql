-- ============================================================
-- 0024_external_lockdown.sql
-- 横断テーブル / テンプレ系 / 監査系で external ロールを明示拒否
--
-- 0023 では companies / contracts / weekly_reviews / company_tasks のみ
-- external 対応にした。本マイグレーションでは「external が触れてはいけない」
-- 残りのテーブルにロックダウンを追加する。
--
-- 方針:
--   - 各 select / write ポリシーを drop -> 再作成
--   - 既存条件に AND not is_external() を加える
--   - 個別の company_id 紐付けがあるテーブル（renewal_milestones,
--     churn_signals, expansion_opportunities, program_company_tasks,
--     voc_items）は将来的に external にも限定参照を許す可能性があるが、
--     初期実装では一律拒否としておく
-- ============================================================

-- ============================================================
-- テンプレ・テンプレ系（external は触れない）
-- ============================================================

-- renewal_milestones
drop policy if exists renewal_milestones_select on renewal_milestones;
create policy renewal_milestones_select on renewal_milestones
  for select to authenticated
  using (
    not is_external()
    and (is_manager_or_above() or has_company_access(company_id))
  );

drop policy if exists renewal_milestones_write on renewal_milestones;
create policy renewal_milestones_write on renewal_milestones
  for all to authenticated
  using (
    not is_external()
    and (is_manager_or_above() or has_company_access(company_id))
  )
  with check (
    not is_external()
    and (is_manager_or_above() or has_company_access(company_id))
  );

-- churn_signals
drop policy if exists churn_signals_select on churn_signals;
create policy churn_signals_select on churn_signals
  for select to authenticated
  using (
    not is_external()
    and (is_manager_or_above() or has_company_access(company_id))
  );

drop policy if exists churn_signals_write on churn_signals;
create policy churn_signals_write on churn_signals
  for all to authenticated
  using (
    not is_external()
    and (is_manager_or_above() or has_company_access(company_id))
  )
  with check (
    not is_external()
    and (is_manager_or_above() or has_company_access(company_id))
  );

-- expansion_opportunities
drop policy if exists expansion_opportunities_select on expansion_opportunities;
create policy expansion_opportunities_select on expansion_opportunities
  for select to authenticated
  using (
    not is_external()
    and (is_manager_or_above() or has_company_access(company_id))
  );

drop policy if exists expansion_opportunities_write on expansion_opportunities;
create policy expansion_opportunities_write on expansion_opportunities
  for all to authenticated
  using (
    not is_external()
    and (is_manager_or_above() or has_company_access(company_id))
  )
  with check (
    not is_external()
    and (is_manager_or_above() or has_company_access(company_id))
  );

-- voc_items
drop policy if exists voc_items_select on voc_items;
create policy voc_items_select on voc_items
  for select to authenticated
  using (
    not is_external()
    and (is_manager_or_above() or has_company_access(company_id))
  );

drop policy if exists voc_items_write on voc_items;
create policy voc_items_write on voc_items
  for all to authenticated
  using (
    not is_external()
    and (is_manager_or_above() or has_company_access(company_id))
  )
  with check (
    not is_external()
    and (is_manager_or_above() or has_company_access(company_id))
  );

-- ============================================================
-- 横断系（external 完全拒否）
-- ============================================================

-- assignments
drop policy if exists assignments_select on assignments;
create policy assignments_select on assignments
  for select to authenticated
  using (
    not is_external()
    and (is_manager_or_above() or has_company_access(company_id))
  );

drop policy if exists assignments_write on assignments;
create policy assignments_write on assignments
  for all to authenticated
  using (not is_external() and is_admin())
  with check (not is_external() and is_admin());

-- drafts: 自身のドラフトのみ
drop policy if exists drafts_select on drafts;
create policy drafts_select on drafts
  for select to authenticated
  using (not is_external() and owner_user_id = current_app_user_id());

drop policy if exists drafts_write on drafts;
create policy drafts_write on drafts
  for all to authenticated
  using (not is_external() and owner_user_id = current_app_user_id())
  with check (not is_external() and owner_user_id = current_app_user_id());

-- kpi_snapshots: 集計値、external には不要
drop policy if exists kpi_snapshots_select on kpi_snapshots;
create policy kpi_snapshots_select on kpi_snapshots
  for select to authenticated
  using (not is_external() and is_authenticated_active());

-- audit_logs: 既存どおり admin のみ select、external 拒否を追記
drop policy if exists audit_logs_select on audit_logs;
create policy audit_logs_select on audit_logs
  for select to authenticated
  using (not is_external() and is_admin());

-- ============================================================
-- one_on_one_logs : 既存 0003 で定義。external 拒否を追記
-- ============================================================
drop policy if exists one_on_one_logs_select on one_on_one_logs;
create policy one_on_one_logs_select on one_on_one_logs
  for select to authenticated
  using (
    not is_external()
    and (
      is_admin()
      or manager_user_id = current_app_user_id()
      or member_user_id = current_app_user_id()
    )
  );

drop policy if exists one_on_one_logs_insert on one_on_one_logs;
create policy one_on_one_logs_insert on one_on_one_logs
  for insert to authenticated
  with check (
    not is_external()
    and (
      is_admin()
      or manager_user_id = current_app_user_id()
    )
  );

drop policy if exists one_on_one_logs_update on one_on_one_logs;
create policy one_on_one_logs_update on one_on_one_logs
  for update to authenticated
  using (
    not is_external()
    and (
      is_admin()
      or manager_user_id = current_app_user_id()
    )
  )
  with check (
    not is_external()
    and (
      is_admin()
      or manager_user_id = current_app_user_id()
    )
  );

drop policy if exists one_on_one_logs_delete on one_on_one_logs;
create policy one_on_one_logs_delete on one_on_one_logs
  for delete to authenticated
  using (not is_external() and is_admin());

-- ============================================================
-- program_* （事業内ToDo）: external 拒否
-- ============================================================
drop policy if exists program_terms_select on program_terms;
create policy program_terms_select on program_terms
  for select to authenticated
  using (not is_external() and is_authenticated_active());

drop policy if exists program_terms_write on program_terms;
create policy program_terms_write on program_terms
  for all to authenticated
  using (not is_external() and (is_admin() or is_manager_or_above()))
  with check (not is_external() and (is_admin() or is_manager_or_above()));

drop policy if exists program_task_templates_select on program_task_templates;
create policy program_task_templates_select on program_task_templates
  for select to authenticated
  using (not is_external() and is_authenticated_active());

drop policy if exists program_task_templates_write on program_task_templates;
create policy program_task_templates_write on program_task_templates
  for all to authenticated
  using (not is_external() and (is_admin() or is_manager_or_above()))
  with check (not is_external() and (is_admin() or is_manager_or_above()));

drop policy if exists program_company_tasks_select on program_company_tasks;
create policy program_company_tasks_select on program_company_tasks
  for select to authenticated
  using (
    not is_external()
    and (is_manager_or_above() or has_company_access(company_id))
  );

drop policy if exists program_company_tasks_write on program_company_tasks;
create policy program_company_tasks_write on program_company_tasks
  for all to authenticated
  using (
    not is_external()
    and (is_manager_or_above() or has_company_access(company_id))
  )
  with check (
    not is_external()
    and (is_manager_or_above() or has_company_access(company_id))
  );
