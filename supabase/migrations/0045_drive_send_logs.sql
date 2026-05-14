-- ============================================================
-- 0045_drive_send_logs.sql
-- F4 (Drive テンプレート連携) の送付履歴テーブル
--
-- 「どの企業に / いつ / どの版の資料を / 誰が / どのチャネルで送ったか」
-- を遡れるようにする。Drive folder 複製とは別経路で、Gmail 添付や
-- Drive 共有リンクで送付した記録も統合的に残す。
--
-- 関連:
--   - docs/PRODUCT.md §2.6 F4
--   - docs/CURRENT_STATE.md §F4
--   - lib/integrations/google-drive.ts (記録フック)
-- ============================================================

create table if not exists drive_send_logs (
  id                       uuid primary key default uuid_generate_v4(),
  organization_id          uuid not null references organizations(id),
  company_id               text not null references companies(id) on delete cascade,
  contract_id              text references contracts(id) on delete set null,
  product_code             text references products(code),
  drive_file_id            text not null,
  drive_file_name          text not null,
  drive_file_version_label text,
  sent_to_email            text not null,
  sent_to_contact_id       text references company_contacts(id) on delete set null,
  sent_by_user_id          uuid not null references app_users(id),
  sent_via                 text not null check (sent_via in ('gmail','drive_share','other')),
  note                     text,
  sent_at                  timestamptz not null default now(),
  created_at               timestamptz not null default now()
);

create index if not exists drive_send_logs_org_idx
  on drive_send_logs(organization_id);
create index if not exists drive_send_logs_company_idx
  on drive_send_logs(company_id, sent_at desc);
create index if not exists drive_send_logs_contract_idx
  on drive_send_logs(contract_id) where contract_id is not null;
create index if not exists drive_send_logs_sender_idx
  on drive_send_logs(sent_by_user_id, sent_at desc);

-- RLS: 担当範囲内の企業に紐づく送付履歴のみ閲覧可。書き込みは
-- 認証済みユーザーなら誰でも (自分の送付を記録)、削除はマネージャー以上。
alter table drive_send_logs enable row level security;

drop policy if exists drive_send_logs_select on drive_send_logs;
drop policy if exists drive_send_logs_insert on drive_send_logs;
drop policy if exists drive_send_logs_modify on drive_send_logs;

create policy drive_send_logs_select on drive_send_logs
  for select to authenticated
  using (
    is_authenticated_active() and
    exists (
      select 1 from companies c
      where c.id = drive_send_logs.company_id
        and c.organization_id = drive_send_logs.organization_id
    )
  );

create policy drive_send_logs_insert on drive_send_logs
  for insert to authenticated
  with check (
    is_authenticated_active() and
    sent_by_user_id = auth.uid()
  );

create policy drive_send_logs_modify on drive_send_logs
  for update to authenticated
  using (is_manager_or_above())
  with check (is_manager_or_above());
