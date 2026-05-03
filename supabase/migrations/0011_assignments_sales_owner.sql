-- ============================================================
-- 0011_assignments_sales_owner.sql
-- ストリーム01 P1: AssignmentRole enum 拡張 (申し送り v)
--
-- 営業引き継ぎを assignments で正本化するため "sales_owner" を追加。
-- 1社1人を想定し、partial unique index で担保 (primary と同じ仕組み)。
--
-- アプリ側 (assignmentRepo.assign / update) は primary 昇格時の自動 unassign
-- ロジックを sales_owner にも横展開する必要がある。
-- ============================================================

-- 1. 旧 role CHECK を pg_constraint 経由で動的削除し、新値を含めて貼り直す
do $$
declare
  c_name text;
begin
  for c_name in
    select conname from pg_constraint
    where conrelid = 'assignments'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table assignments drop constraint %I', c_name);
  end loop;
end$$;

alter table assignments
  add constraint assignments_role_check
  check (role in ('primary','secondary','observer','sales_owner'));

-- 2. 1社につき sales_owner は最大1人 (active のみ)
create unique index if not exists assignments_one_sales_owner_per_company
  on assignments(company_id)
  where role = 'sales_owner' and unassigned_at is null;

-- 既存の primary 用 partial unique index は 0001_init.sql で作成済 (assignments_one_primary_per_company)

-- ============================================================
-- END 0011
-- ============================================================
