-- ============================================================
-- 0043: Gmail 同期向け dedup 列を email_threads / email_messages に追加
--   - gmail_thread_id / gmail_message_id を保持
--   - organization_id 単位でユニーク (Gmail の messageId/threadId はテナント間で衝突しない想定だが
--     念のため org スコープで一意化)
--   - 既存の mock 由来データ (gmail_id 無し) は影響を受けないよう partial unique index
-- ============================================================

alter table email_threads
  add column if not exists gmail_thread_id text;
alter table email_messages
  add column if not exists gmail_message_id text;

create unique index if not exists email_threads_gmail_uidx
  on email_threads(organization_id, gmail_thread_id)
  where gmail_thread_id is not null;

create unique index if not exists email_messages_gmail_uidx
  on email_messages(gmail_message_id)
  where gmail_message_id is not null;
