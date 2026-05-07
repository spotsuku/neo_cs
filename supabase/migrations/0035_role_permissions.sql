-- ============================================================
-- 0035_role_permissions.sql
-- ロール権限マトリクス: 機能キーごとに「最低ロール」を保持
--
-- 背景:
--   従来の権限判定 (lib/auth/permissions.ts) は admin / manager / member の
--   ハードコード判定だった。契約 CRUD や期管理など、組織により担当範囲が
--   異なる機能を「admin が後から開放できる」形に切り替えるために本テーブルを
--   導入する。
--
-- 設計:
--   - permission_key  : "contract_manage" / "program_term_manage" など
--   - min_role        : この機能を実行できる最低ロール
--                       (admin > manager > member > viewer)
--   - updated_by      : 監査用 (誰が変更したか)
--
-- アプリ側 (lib/auth/role-permissions.ts) は本テーブルを読み込み、
-- canPerform(ctx, key) で actor.role が min_role 以上か判定する。
-- DB 不在時は安全側のデフォルト (manager 以上) で動作する。
-- ============================================================

create table if not exists role_permissions (
  permission_key  text primary key,
  min_role        text not null check (min_role in ('admin','manager','member','viewer')),
  description     text,
  updated_by      uuid references app_users(id),
  updated_at      timestamptz not null default now()
);

-- 既定値 seed: admin/manager のみが触れるようにする (後から admin が緩められる)
insert into role_permissions(permission_key, min_role, description) values
  ('contract_manage',     'manager', '企業ページで契約 (Contract) の追加・編集・解約・削除を行う'),
  ('program_term_manage', 'manager', '研修ごとの期 (Term / 第◯期 / 第◯回) の作成・編集・削除を行う')
on conflict (permission_key) do nothing;

-- RLS: select は authenticated 全員可 (UI 出し分けに必要)、write は service_role のみ
alter table role_permissions enable row level security;

drop policy if exists role_permissions_select_auth on role_permissions;
create policy role_permissions_select_auth on role_permissions
  for select to authenticated using (true);

drop policy if exists role_permissions_no_write_authenticated on role_permissions;
create policy role_permissions_no_write_authenticated on role_permissions
  for insert to authenticated with check (false);
drop policy if exists role_permissions_no_update_authenticated on role_permissions;
create policy role_permissions_no_update_authenticated on role_permissions
  for update to authenticated using (false) with check (false);
drop policy if exists role_permissions_no_delete_authenticated on role_permissions;
create policy role_permissions_no_delete_authenticated on role_permissions
  for delete to authenticated using (false);
