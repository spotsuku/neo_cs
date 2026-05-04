-- ============================================================
-- 0018_drive_metadata.sql
-- Phase4-#5 Google Drive 自動連携: companies に Drive メタを追加
--
-- 背景:
--   営業引継ぎ受信時に lib/integrations/google-drive.copyTemplateFolder()
--   でテンプレフォルダを複製し、ここに保存する。
--   /companies/[id] / /sales-handoff/[id] からワンクリックで開く動線を作る。
--
-- 注:
--   - sales_handoffs.drive_folder_url は 0017 で既存 (handoff 単位の履歴)
--   - companies.drive_folder_url は「最新の正本」 (1社1フォルダの想定)
-- ============================================================

alter table companies add column if not exists drive_folder_id text;
alter table companies add column if not exists drive_folder_url text;
alter table companies add column if not exists drive_folder_created_at timestamptz;

create index if not exists companies_drive_folder_idx
  on companies(drive_folder_id)
  where drive_folder_id is not null;
