-- ============================================================
-- 0007_admin_seed.sql
-- ストリーム01 P1: 初回ログイン時の admin 自動昇格 (招待制 admin)
--
-- 旧 api/auth.js の「初回ユーザーは自動 admin」(レース条件で外部Google
-- アカウントが admin を奪取するリスク) を撲滅し、明示的に
-- INITIAL_ADMIN_EMAIL に登録された email のみ admin として扱う。
--
-- 仕組み:
--   1. 環境変数 INITIAL_ADMIN_EMAIL に admin にしたい email を設定
--      (例: 'k_furuno@neoacademia.jp')
--   2. supabase db push 時に本マイグレーションが
--      app_admin_emails (email allowlist) を作成
--   3. handle_new_auth_user() トリガが auth.users への INSERT を捕捉し、
--      app_users に対応レコードを作成。email が allowlist にあれば
--      role='admin'、なければ role='member' で作成
--   4. 招待制を厳格化したい場合は app_admin_emails にだけ email を入れて、
--      他の email は事前に app_users(role='member', is_active=false) で
--      作成しておけば未許可ユーザーは無効状態でブロックできる
-- ============================================================

-- 初期管理者メールの allowlist (allowlist にある email は初回ログインで admin)
create table if not exists app_admin_emails (
  email      text primary key,
  added_at   timestamptz not null default now(),
  added_by   uuid references app_users(id),
  note       text
);

alter table app_admin_emails enable row level security;
drop policy if exists app_admin_emails_select on app_admin_emails;
drop policy if exists app_admin_emails_write  on app_admin_emails;
create policy app_admin_emails_select on app_admin_emails
  for select to authenticated
  using (is_admin());
create policy app_admin_emails_write on app_admin_emails
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- 初期 seed: 環境固有の email は手動で INSERT してください。
-- supabase CLI から実行する場合は以下のように:
--   psql $DATABASE_URL -c "insert into app_admin_emails(email) values ('k_furuno@neoacademia.jp') on conflict do nothing"
-- もしくは Supabase ダッシュボードの SQL Editor で実行。

-- ============================================================
-- handle_new_auth_user: auth.users INSERT 時に app_users 行を生成
-- ============================================================
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role          text;
  v_org_id        uuid;
  v_existing_id   uuid;
begin
  -- 既存 app_users に同 email があれば auth_user_id を紐付けるだけ
  select id into v_existing_id from app_users where email = new.email limit 1;
  if v_existing_id is not null then
    update app_users
       set auth_user_id = new.id,
           last_login_at = now()
     where id = v_existing_id;
    return new;
  end if;

  -- allowlist にあれば admin、なければ member
  if exists (select 1 from app_admin_emails where email = new.email) then
    v_role := 'admin';
  else
    v_role := 'member';
  end if;

  -- 新規ユーザーはデフォルト org に紐付ける。マルチテナント運用では
  -- email ドメイン → organization_id のマッピングを別表で持つ拡張を行う。
  v_org_id := '00000000-0000-0000-0000-000000000001'::uuid;

  insert into app_users (
    organization_id, auth_user_id, email, name, role, is_active, last_login_at
  ) values (
    v_org_id,
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    v_role,
    true,
    now()
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- ============================================================
-- END 0007
-- ============================================================
