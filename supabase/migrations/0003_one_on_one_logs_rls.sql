-- ============================================================
-- 0003_one_on_one_logs_rls.sql
-- ストリーム01: one_on_one_logs RLS ポリシー
--
-- 申し送り j (ストリーム02 B項):
--   - is_private = true の行: manager_user_id 本人 + admin のみ select 可
--                              (member_user_id 本人にも非公開)
--   - is_private = false の行: manager + member 双方 + admin が select 可
--   - insert / update / delete: manager_user_id 本人 + admin のみ
--
-- 前提: app_users に role / is_active / auth_user_id を持つ (0001_init.sql)。
--      auth.uid() は Supabase Auth の認証uidを返す。
-- ============================================================

-- 既存ポリシーがあれば削除（再適用安全性）
drop policy if exists one_on_one_logs_select on one_on_one_logs;
drop policy if exists one_on_one_logs_insert on one_on_one_logs;
drop policy if exists one_on_one_logs_update on one_on_one_logs;
drop policy if exists one_on_one_logs_delete on one_on_one_logs;

-- ── ヘルパ: 現セッションが admin か ──
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

-- ── ヘルパ: 現セッションの app_users.id ──
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

-- ── SELECT ポリシー ──
-- is_private=false: manager / member / admin
-- is_private=true : manager / admin のみ
create policy one_on_one_logs_select on one_on_one_logs
  for select
  to authenticated
  using (
    is_admin()
    or manager_user_id = current_app_user_id()
    or (
      is_private = false
      and member_user_id = current_app_user_id()
    )
  );

-- ── INSERT / UPDATE / DELETE ──
-- いずれも manager 本人または admin のみ
create policy one_on_one_logs_insert on one_on_one_logs
  for insert
  to authenticated
  with check (
    is_admin()
    or manager_user_id = current_app_user_id()
  );

create policy one_on_one_logs_update on one_on_one_logs
  for update
  to authenticated
  using (
    is_admin()
    or manager_user_id = current_app_user_id()
  )
  with check (
    is_admin()
    or manager_user_id = current_app_user_id()
  );

create policy one_on_one_logs_delete on one_on_one_logs
  for delete
  to authenticated
  using (
    is_admin()
    or manager_user_id = current_app_user_id()
  );

-- service_role は RLS をバイパスするため別途ポリシー不要
-- (Supabase の service_role キー使用時は RLS 検査が走らない)

-- ============================================================
-- END 0003
-- ============================================================
