-- ============================================================
-- 0032_onboarding_note_not_applicable.sql
-- onboarding_tasks の拡張:
--   - note (text) 列を追加 — タスク単位の自由記述メモ
--   - status check 制約に 'not_applicable' を追加 — 「対象外」状態
--
-- mock 側 (lib/mock/onboarding.ts) は既に note と not_applicable を持っており、
-- supabase repo の update が DB schema と整合しないため正しく永続化できなかった。
-- ============================================================

-- 1) note 列を追加 (既存行は NULL)
alter table onboarding_tasks
  add column if not exists note text;

-- 2) status の CHECK 制約を更新
do $$
declare
  c_name text;
begin
  for c_name in
    select conname from pg_constraint
    where conrelid = 'onboarding_tasks'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table onboarding_tasks drop constraint %I', c_name);
  end loop;
end $$;

alter table onboarding_tasks
  add constraint onboarding_tasks_status_check
  check (status in ('todo','doing','done','overdue','not_applicable'));

-- ============================================================
-- END 0032
-- ============================================================
