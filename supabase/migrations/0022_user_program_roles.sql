-- ============================================================
-- 0022_user_program_roles.sql
-- 権限スコープ拡張:
--   1) app_users.role に 'external' を追加
--   2) user_program_roles : ユーザー × 事業（product_code）スコープロール
--   3) user_company_access : external ユーザー専用の企業アクセス
--
-- 設計: lib/auth/permissions.ts と一対で動作する
--   - admin は user_program_roles を持たなくてよい（暗黙的に全事業 template_editor 相当）
--   - external 以外のロールでは user_company_access は参照されない
--
-- 関連: docs/permissions.md（後段で追加予定）
-- ============================================================

-- 1) app_users.role に 'external' を追加
alter table app_users drop constraint if exists app_users_role_check;
alter table app_users
  add constraint app_users_role_check
  check (role in ('admin','manager','member','viewer','external'));

comment on column app_users.role is
  'グローバルロール: admin / manager / member / viewer / external。external は user_company_access と組合せで使用';

-- 2) user_program_roles : 事業スコープロール
create table user_program_roles (
  user_id          uuid not null references app_users(id) on delete cascade,
  organization_id  uuid not null references organizations(id),
  product_code     text not null, -- 'academia' / 'hyogikai' / 'aiken' / 'commu' 等
  scope_role       text not null check (scope_role in ('viewer','editor','template_editor')),
  assigned_at      timestamptz not null default now(),
  assigned_by      uuid references app_users(id),
  primary key (user_id, product_code)
);

comment on table user_program_roles is
  'ユーザー×事業のスコープロール。viewer=閲覧のみ、editor=進捗・週次の項目編集、template_editor=列名・テンプレ編集まで';

create index user_program_roles_org_product_idx
  on user_program_roles(organization_id, product_code);
create index user_program_roles_product_idx
  on user_program_roles(product_code);

-- 3) user_company_access : external 用の企業アクセス
create table user_company_access (
  user_id          uuid not null references app_users(id) on delete cascade,
  organization_id  uuid not null references organizations(id),
  company_id       uuid not null references companies(id) on delete cascade,
  granted_at       timestamptz not null default now(),
  granted_by       uuid references app_users(id),
  primary key (user_id, company_id)
);

comment on table user_company_access is
  'external ロールのユーザーが閲覧/編集できる企業の許可リスト。external 以外では参照されない';

create index user_company_access_company_idx
  on user_company_access(company_id);
create index user_company_access_org_idx
  on user_company_access(organization_id);

-- ============================================================
-- RLS
-- ============================================================
alter table user_program_roles enable row level security;
alter table user_company_access enable row level security;

-- 自身の割当は本人も読める（UI 出し分けに使うため）
create policy user_program_roles_self_read on user_program_roles
  for select using (
    user_id = current_app_user_id()
    or exists (
      select 1 from app_users u
      where u.auth_user_id = auth.uid() and u.role = 'admin'
    )
  );

-- 書込みは admin のみ
create policy user_program_roles_admin_write on user_program_roles
  for all using (
    exists (
      select 1 from app_users u
      where u.auth_user_id = auth.uid() and u.role = 'admin'
    )
  ) with check (
    exists (
      select 1 from app_users u
      where u.auth_user_id = auth.uid() and u.role = 'admin'
    )
  );

create policy user_company_access_self_read on user_company_access
  for select using (
    user_id = current_app_user_id()
    or exists (
      select 1 from app_users u
      where u.auth_user_id = auth.uid() and u.role = 'admin'
    )
  );

create policy user_company_access_admin_write on user_company_access
  for all using (
    exists (
      select 1 from app_users u
      where u.auth_user_id = auth.uid() and u.role = 'admin'
    )
  ) with check (
    exists (
      select 1 from app_users u
      where u.auth_user_id = auth.uid() and u.role = 'admin'
    )
  );

-- ============================================================
-- 既存テーブルの RLS 強化: external ユーザーは user_company_access に
-- 登録された企業のみ参照可能にする
--
-- ヘルパ関数: 現在のユーザーが external か & 企業アクセス可否
-- ============================================================
create or replace function auth_external_can_view_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select case
    when not exists (
      select 1 from app_users u
      where u.auth_user_id = auth.uid() and u.role = 'external'
    ) then true  -- external でなければ本関数の制限は適用しない
    else exists (
      select 1 from user_company_access a
      join app_users u on u.id = a.user_id
      where u.auth_user_id = auth.uid() and a.company_id = target_company_id
    )
  end;
$$;

comment on function auth_external_can_view_company(uuid) is
  'external ユーザーの場合のみ user_company_access による絞り込みを行う。それ以外は true を返す';

-- companies / contracts / weekly_reviews 等の SELECT ポリシーに
-- AND auth_external_can_view_company(company_id) を追記する形で
-- external アクセス制限を有効化するのは別マイグレーションで行う
-- （既存ポリシーを書き換えると影響範囲が大きいため、別 PR で慎重に適用）
