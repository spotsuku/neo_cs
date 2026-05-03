-- ============================================================
-- 0002_audit_logs.sql
-- ストリーム04: 監査ログ・同意・イベントログの実装強化
--
-- 前提: 0001_init.sql が app_users / audit_logs / domain_events /
--       consent_records / 全業務テーブルを既に作成していること。
--       (ストリーム01 — roadmap/01_基盤_DDL案.sql を migration 化したもの)
--
-- 本マイグレーションは0001で作成された監査系テーブルに、
--   - 改ざん不可性 (UPDATE/DELETE禁止トリガ)
--   - 必須フィールドの強化 (request_id, source 追加)
--   - 性能インデックス追加
--   - RLSポリシー (admin/auditor read, service_role insert)
--   - 汎用 audit トリガ関数 (DBレイヤフォールバック)
-- を後付けする。
--
-- アプリ側 (neo-cs-v2/lib/repository/audit.ts) からの service_role 経由
-- INSERT が一次経路。DBトリガはフォールバック兼ねて全テーブルへ装着可能。
-- ============================================================

-- ============================================================
-- 1. audit_logs スキーマ強化
-- ============================================================
alter table audit_logs
  add column if not exists request_id     text,
  add column if not exists source         text not null default 'app'
    check (source in ('app','api','job','migration','db_trigger')),
  add column if not exists actor_role     text,
  add column if not exists organization_id uuid,
  add column if not exists reason         text,
  add column if not exists diff           jsonb;

-- read_sensitive 等の追加 action 値を許容
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'audit_logs_action_check'
  ) then
    alter table audit_logs drop constraint audit_logs_action_check;
  end if;
end$$;

alter table audit_logs
  add constraint audit_logs_action_check check (
    action in (
      'create','update','delete',
      'login','logout','export','read_sensitive',
      'consent_grant','consent_revoke',
      'role_change','disable_user','enable_user'
    )
  );

create index if not exists audit_logs_request_idx
  on audit_logs(request_id) where request_id is not null;
create index if not exists audit_logs_org_time_idx
  on audit_logs(organization_id, created_at desc) where organization_id is not null;

-- ============================================================
-- 2. 改ざん不可性 (immutability)
-- ============================================================
create or replace function audit_logs_block_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_logs is append-only (operation: %)', TG_OP
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists audit_logs_no_update on audit_logs;
create trigger audit_logs_no_update
  before update on audit_logs
  for each row execute function audit_logs_block_mutation();

drop trigger if exists audit_logs_no_delete on audit_logs;
create trigger audit_logs_no_delete
  before delete on audit_logs
  for each row execute function audit_logs_block_mutation();

-- ============================================================
-- 3. RLS: admin / auditor のみ参照可、INSERT は service_role のみ
-- ============================================================
alter table audit_logs enable row level security;

drop policy if exists audit_logs_select on audit_logs;
create policy audit_logs_select on audit_logs
  for select to authenticated
  using (
    exists (
      select 1 from app_users u
      where u.id = auth.uid()
        and u.is_active
        and u.role in ('admin','auditor')
    )
  );

drop policy if exists audit_logs_insert on audit_logs;
create policy audit_logs_insert on audit_logs
  for insert to service_role
  with check (true);

revoke insert, update, delete on audit_logs from anon, authenticated;

-- ============================================================
-- 4. 汎用 audit トリガ (DBレイヤ二重化フォールバック)
--    使い方: select audit_attach('companies'); で対象テーブルにフック
--    アプリ側で記録に失敗しても DB トリガが捕捉する。
-- ============================================================
create or replace function audit_capture()
returns trigger language plpgsql security definer as $$
declare
  v_actor uuid;
  v_email text;
  v_role  text;
  v_org   uuid;
begin
  begin
    v_actor := auth.uid();
  exception when others then
    v_actor := null;
  end;

  if v_actor is not null then
    select email, role into v_email, v_role from app_users where id = v_actor;
  end if;

  insert into audit_logs (
    actor_user_id, actor_email, actor_role,
    action, target_table, target_id,
    before_data, after_data, source
  ) values (
    v_actor, v_email, v_role,
    case TG_OP when 'INSERT' then 'create'
               when 'UPDATE' then 'update'
               when 'DELETE' then 'delete' end,
    TG_TABLE_NAME,
    coalesce(
      case when TG_OP = 'DELETE' then (to_jsonb(OLD)->>'id')
           else (to_jsonb(NEW)->>'id') end,
      'unknown'
    ),
    case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) else null end,
    case when TG_OP in ('INSERT','UPDATE') then to_jsonb(NEW) else null end,
    'db_trigger'
  );

  return case when TG_OP = 'DELETE' then OLD else NEW end;
end;
$$;

create or replace function audit_attach(p_table regclass)
returns void language plpgsql as $$
declare
  v_trig text := 'audit_' || split_part(p_table::text, '.', -1);
begin
  execute format('drop trigger if exists %I on %s', v_trig, p_table);
  execute format(
    'create trigger %I after insert or update or delete on %s ' ||
    'for each row execute function audit_capture()',
    v_trig, p_table
  );
end;
$$;

-- 主要テーブルに装着 (存在チェック付き — 0001適用後に有効化)
do $$
declare
  t text;
  targets text[] := array[
    'companies','contacts','stakeholders',
    'contracts','success_plans','renewal_milestones','churn_records',
    'onboarding_tasks','participants','attendance_records',
    'meeting_logs','weekly_reviews',
    'survey_responses','consent_records',
    'app_users'
  ];
begin
  foreach t in array targets loop
    if to_regclass(t) is not null then
      perform audit_attach(t::regclass);
    end if;
  end loop;
end$$;

-- ============================================================
-- 5. consent_records 強化
--    - グランス/撤回の二相をフィールドで明示
--    - 必須項目の追加
-- ============================================================
alter table consent_records
  add column if not exists revoked_at      timestamptz,
  add column if not exists revoked_by      uuid references app_users(id),
  add column if not exists granted_by      uuid references app_users(id),
  add column if not exists purpose_text    text,
  add column if not exists policy_version  text;

create index if not exists consent_active_idx
  on consent_records(subject_type, subject_id, consent_type)
  where revoked_at is null and consented = true;

alter table consent_records enable row level security;

drop policy if exists consent_records_read on consent_records;
create policy consent_records_read on consent_records
  for select to authenticated
  using (
    exists (
      select 1 from app_users u
      where u.id = auth.uid() and u.is_active
        and u.role in ('admin','manager','auditor')
    )
  );

drop policy if exists consent_records_write on consent_records;
create policy consent_records_write on consent_records
  for insert to authenticated
  with check (
    exists (
      select 1 from app_users u
      where u.id = auth.uid() and u.is_active
        and u.role in ('admin','manager','member')
    )
  );

-- 同意撤回判定ヘルパ
create or replace function has_active_consent(
  p_subject_type text, p_subject_id text, p_consent_type text
) returns boolean language sql stable as $$
  select exists (
    select 1 from consent_records
    where subject_type = p_subject_type
      and subject_id   = p_subject_id
      and consent_type = p_consent_type
      and consented = true
      and revoked_at is null
      and (expires_at is null or expires_at > now())
  );
$$;

-- ============================================================
-- 6. /api/claude コール監査 (コスト/レート用)
-- ============================================================
create table if not exists claude_api_calls (
  id              bigserial primary key,
  actor_user_id   uuid references app_users(id),
  organization_id uuid,
  model           text not null,
  input_tokens    integer,
  output_tokens   integer,
  latency_ms      integer,
  status          smallint not null,
  request_id      text,
  ip              inet,
  user_agent      text,
  error_code      text,
  created_at      timestamptz not null default now()
);
create index if not exists claude_calls_actor_time_idx
  on claude_api_calls(actor_user_id, created_at desc);
create index if not exists claude_calls_status_time_idx
  on claude_api_calls(status, created_at desc);

alter table claude_api_calls enable row level security;
create policy claude_calls_admin_read on claude_api_calls
  for select to authenticated
  using (
    exists (select 1 from app_users u
            where u.id = auth.uid() and u.is_active
              and u.role in ('admin','auditor'))
  );

-- ============================================================
-- 終了
-- ============================================================
comment on table audit_logs is 'append-only audit trail. 改ざん不可。記録は service_role 経由で行う';
comment on table consent_records is '個情法・GDPR用同意記録。撤回はrevoked_atで表現';
comment on table claude_api_calls is 'Anthropic API 呼び出しの監査・コスト分析用';
