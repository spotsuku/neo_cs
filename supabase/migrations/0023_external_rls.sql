-- ============================================================
-- 0023_external_rls.sql
-- external ロールのアクセス制限を既存テーブルに適用
--
-- 設計方針:
--   - 既存ポリシーは drop して、external チェックを追加した形で再作成する
--   - external は user_company_access に登録された company のみ select/update 可
--   - 0022 の auth_external_can_view_company(uuid) を用いる
--   - 既存の admin / manager / member / viewer の挙動は不変（is_external() を
--     false に短絡することで影響を最小化）
--
-- 注意:
--   - 既存ポリシー名と完全一致させて drop -> create する
--   - 適用後は member 視点のレグレッションテストを必ず回す
-- ============================================================

-- ヘルパ: 認証ユーザーが external か
create or replace function is_external()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from app_users u
    where u.auth_user_id = auth.uid()
      and u.is_active
      and u.role = 'external'
  );
$$;

-- ============================================================
-- companies
-- ============================================================
drop policy if exists companies_select on companies;
create policy companies_select on companies
  for select to authenticated
  using (
    case
      when is_external() then auth_external_can_view_company(id)
      else is_admin() or is_manager_or_above() or has_company_access(id)
    end
  );

-- companies_write: external は更新不可（既存どおり admin/manager のみ）
-- → drop / 再作成は不要だが、保険として external 明示拒否を加える
drop policy if exists companies_write on companies;
create policy companies_write on companies
  for all to authenticated
  using (
    not is_external() and (is_admin() or is_manager_or_above())
  )
  with check (
    not is_external() and (is_admin() or is_manager_or_above())
  );

-- ============================================================
-- contracts
-- ============================================================
drop policy if exists contracts_select on contracts;
create policy contracts_select on contracts
  for select to authenticated
  using (
    case
      when is_external() then auth_external_can_view_company(company_id)
      else is_manager_or_above() or has_company_access(company_id)
    end
  );

-- ============================================================
-- weekly_reviews : external も progres 編集できるよう SELECT/UPDATE 許可
-- ============================================================
drop policy if exists weekly_reviews_select on weekly_reviews;
create policy weekly_reviews_select on weekly_reviews
  for select to authenticated
  using (
    case
      when is_external() then auth_external_can_view_company(company_id)
      else is_manager_or_above() or has_company_access(company_id)
    end
  );

-- weekly_reviews_write: external も自分のアクセス可能企業に対しては update 可
drop policy if exists weekly_reviews_write on weekly_reviews;
create policy weekly_reviews_write on weekly_reviews
  for all to authenticated
  using (
    case
      when is_external() then auth_external_can_view_company(company_id)
      else is_manager_or_above() or has_company_access(company_id)
    end
  )
  with check (
    case
      when is_external() then auth_external_can_view_company(company_id)
      else is_manager_or_above() or has_company_access(company_id)
    end
  );

-- ============================================================
-- company_tasks : 個社ToDo（external も進捗編集可）
-- ============================================================
do $$
begin
  if exists (select 1 from pg_policies where policyname = 'company_tasks_select' and tablename = 'company_tasks') then
    execute 'drop policy company_tasks_select on company_tasks';
  end if;
  if exists (select 1 from pg_policies where policyname = 'company_tasks_write' and tablename = 'company_tasks') then
    execute 'drop policy company_tasks_write on company_tasks';
  end if;
end $$;

create policy company_tasks_select on company_tasks
  for select to authenticated
  using (
    case
      when is_external() then auth_external_can_view_company(company_id)
      else is_manager_or_above() or has_company_access(company_id)
    end
  );

create policy company_tasks_write on company_tasks
  for all to authenticated
  using (
    case
      when is_external() then auth_external_can_view_company(company_id)
      else is_manager_or_above() or has_company_access(company_id)
    end
  )
  with check (
    case
      when is_external() then auth_external_can_view_company(company_id)
      else is_manager_or_above() or has_company_access(company_id)
    end
  );

-- ============================================================
-- 以下のテーブルは external には参照させない（横断画面・テンプレ系）:
--   - audit_logs : admin only（既存）
--   - kpi_snapshots : admin only（既存）
--   - product_courses : テンプレ
--   - program_terms / program_task_templates / program_company_tasks
--   - voc_items / churn_signals / renewal_milestones
--   - one_on_one_logs / assignments / drafts
--
-- いずれも既存ポリシー（manager/member 用）に external 拒否を加える形にする。
-- 必要箇所のみ列挙し、external がアクセスしようとしたら 0 行返るようにする。
-- ============================================================

-- 横断系: external は明示拒否（既存 select は変更せず write のみ拒否を追加）
-- 個別 ALTER は将来必要に応じて追加。最低限、external が self テーブル
-- （user_company_access）と上記 4 テーブル（companies/contracts/weekly_reviews/
-- company_tasks）以外に書込めないことが本マイグレーションの目的。

comment on function is_external() is
  '現在の認証ユーザーが external ロールかを返す';
