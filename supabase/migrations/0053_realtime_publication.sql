-- ─────────────────────────────────────────────
-- Realtime publication 設定
--
-- 「ぬるぬる感」を実現するため、共同編集が想定されるテーブルを
-- supabase_realtime publication に追加する。
--
-- 対象基準: 更新頻度が高い + 複数人が同時に触る可能性のあるテーブル
--   - weekly_reviews / weekly_actions / weekly_next_actions   (週次レビュー一式)
--   - journey_checkpoint_status                                 (ジャーニーチェックポイント)
--   - company_journeys / business_journeys                       (ステージ遷移)
--
-- 含めない (更新頻度が低い / payload が大きすぎる):
--   - email_messages / drive_send_logs / audit_logs
-- ─────────────────────────────────────────────

do $$
declare
  t text;
  target_tables text[] := array[
    'weekly_reviews',
    'weekly_actions',
    'weekly_next_actions',
    'journey_checkpoint_status',
    'company_journeys',
    'business_journeys'
  ];
begin
  foreach t in array target_tables loop
    if exists (select 1 from pg_tables where schemaname='public' and tablename=t)
       and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;

    -- DELETE / UPDATE 時に old payload も取得できるようにする
    -- (差分マージや「どの行が消えたか」検出に必要)
    if exists (select 1 from pg_tables where schemaname='public' and tablename=t) then
      execute format('alter table public.%I replica identity full', t);
    end if;
  end loop;
end$$;
