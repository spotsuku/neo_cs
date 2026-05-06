-- ============================================================
-- 0031_email.sql
-- メールスレッド / メッセージ / AI 抽出
--
-- Gmail × AI で進捗を自動抽出する基盤。mock (lib/mock/email.ts) で扱っている
-- ダミーデータを Supabase テーブルに移植する。
--
--   email_threads      : スレッド単位の状態管理 (status / assignee)
--   email_messages     : スレッド内メッセージ (inbound / outbound)
--   ai_extractions     : AI 抽出結果 (進捗・リスク・参加者発言など)
--
-- id は text 主キー (mock データ "et-1" "em-1" "ax-1" との互換のため)。
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. email_threads
-- ─────────────────────────────────────────────
create table email_threads (
  id                  text primary key,
  organization_id     uuid not null references organizations(id),
  company_id          text references companies(id) on delete set null,
  subject             text not null,
  status              text not null default 'new'
                        check (status in ('new','in_progress','replied','waiting','closed')),
  assignee_user_id    uuid references app_users(id),
  assignee_reason     text
                        check (assignee_reason in ('received','program','manual')),
  last_inbound_at     timestamptz,
  last_outbound_at    timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger email_threads_updated_at
  before update on email_threads
  for each row execute function set_updated_at();

create index email_threads_org_idx        on email_threads(organization_id);
create index email_threads_company_idx    on email_threads(organization_id, company_id);
create index email_threads_status_idx     on email_threads(organization_id, status);
create index email_threads_assignee_idx   on email_threads(organization_id, assignee_user_id);

-- ─────────────────────────────────────────────
-- 2. email_messages
-- ─────────────────────────────────────────────
create table email_messages (
  id                text primary key,
  thread_id         text not null references email_threads(id) on delete cascade,
  direction         text not null check (direction in ('inbound','outbound')),
  body              text not null,
  sender_email      text not null,
  recipient_emails  text[] not null default '{}',
  sent_at           timestamptz not null,
  ai_summary        text,
  created_at        timestamptz not null default now()
);

create index email_messages_thread_idx
  on email_messages(thread_id, sent_at);

-- ─────────────────────────────────────────────
-- 3. ai_extractions
-- ─────────────────────────────────────────────
create table ai_extractions (
  id                text primary key,
  organization_id   uuid not null references organizations(id),
  source_type       text not null check (source_type in ('email','meeting_log','survey')),
  source_id         text not null,
  company_id        text references companies(id) on delete set null,
  extraction_type   text not null
                      check (extraction_type in (
                        'progress_signal',
                        'risk_signal',
                        'churn_signal',
                        'expansion_signal',
                        'meeting_request'
                      )),
  excerpt           text not null,
  confidence        numeric(3,2),
  suggested_action  text,
  reviewed          boolean not null default false,
  reviewed_at       timestamptz,
  reviewed_by       uuid references app_users(id),
  created_at        timestamptz not null default now()
);

create index ai_extractions_org_idx
  on ai_extractions(organization_id, created_at desc);
create index ai_extractions_company_idx
  on ai_extractions(organization_id, company_id, created_at desc);
create index ai_extractions_source_idx
  on ai_extractions(source_type, source_id);

-- ============================================================
-- RLS
-- ============================================================
alter table email_threads   enable row level security;
alter table email_messages  enable row level security;
alter table ai_extractions  enable row level security;

-- email_threads: company_id があれば has_company_access、無ければ manager 以上
drop policy if exists email_threads_select on email_threads;
drop policy if exists email_threads_write  on email_threads;

create policy email_threads_select on email_threads
  for select to authenticated
  using (
    organization_id = current_org_id()
    and (
      is_manager_or_above()
      or (company_id is not null and has_company_access(company_id))
    )
  );

create policy email_threads_write on email_threads
  for all to authenticated
  using (
    organization_id = current_org_id()
    and (
      is_manager_or_above()
      or (company_id is not null and can_write_company(company_id))
    )
  )
  with check (
    organization_id = current_org_id()
    and (
      is_manager_or_above()
      or (company_id is not null and can_write_company(company_id))
    )
  );

-- email_messages: 親スレッドの権限で制御
drop policy if exists email_messages_select on email_messages;
drop policy if exists email_messages_write  on email_messages;

create policy email_messages_select on email_messages
  for select to authenticated
  using (
    exists (
      select 1 from email_threads t
      where t.id = email_messages.thread_id
        and t.organization_id = current_org_id()
        and (
          is_manager_or_above()
          or (t.company_id is not null and has_company_access(t.company_id))
        )
    )
  );

create policy email_messages_write on email_messages
  for all to authenticated
  using (
    exists (
      select 1 from email_threads t
      where t.id = email_messages.thread_id
        and t.organization_id = current_org_id()
        and (
          is_manager_or_above()
          or (t.company_id is not null and can_write_company(t.company_id))
        )
    )
  )
  with check (
    exists (
      select 1 from email_threads t
      where t.id = email_messages.thread_id
        and t.organization_id = current_org_id()
        and (
          is_manager_or_above()
          or (t.company_id is not null and can_write_company(t.company_id))
        )
    )
  );

-- ai_extractions: company_id があれば has_company_access、無ければ manager 以上
drop policy if exists ai_extractions_select on ai_extractions;
drop policy if exists ai_extractions_write  on ai_extractions;

create policy ai_extractions_select on ai_extractions
  for select to authenticated
  using (
    organization_id = current_org_id()
    and (
      is_manager_or_above()
      or (company_id is not null and has_company_access(company_id))
    )
  );

create policy ai_extractions_write on ai_extractions
  for all to authenticated
  using (
    organization_id = current_org_id()
    and (
      is_manager_or_above()
      or (company_id is not null and can_write_company(company_id))
    )
  )
  with check (
    organization_id = current_org_id()
    and (
      is_manager_or_above()
      or (company_id is not null and can_write_company(company_id))
    )
  );

-- ============================================================
-- END 0031
-- ============================================================
