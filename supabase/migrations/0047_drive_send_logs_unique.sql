-- ============================================================
-- 0047_drive_send_logs_unique.sql
-- drive_send_logs の重複防止
--
-- gmail-sync が同じ Gmail message を再同期した際に、本文から抽出した
-- Drive リンクを多重記録する事故を防ぐため、自然キーで UNIQUE を張る。
--
-- 自然キー: (drive_file_id, company_id, sent_to_email, sent_at)
--   - drive_file_id    : 同じファイルでも別タイミングで送れば別レコード
--   - company_id       : 別企業への送付は別レコード
--   - sent_to_email    : 同じ企業内の複数連絡先への送付を別扱い
--   - sent_at          : 同じ瞬間の送信を 1 件に集約 (Gmail の internalDate)
-- ============================================================

create unique index if not exists drive_send_logs_dedup_unique
  on drive_send_logs(drive_file_id, company_id, sent_to_email, sent_at);
