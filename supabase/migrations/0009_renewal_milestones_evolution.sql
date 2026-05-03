-- ============================================================
-- 0009_renewal_milestones_evolution.sql
-- ストリーム01 P1: renewal_milestones G項対応 (申し送り w)
--
-- ストリーム02 G項「自動done廃止 + 担当者明示完了 + 証跡」のために
-- renewal_milestones テーブルを進化させる:
--   - status enum を {todo,done,skipped} → {pending,in_progress,done,skipped} へ
--   - 旧 'todo' 行は履歴保護のため 'pending' へ移行
--   - completed_by / completed_at / evidence / skipped_reason 列を追加
--   - CHECK: done は evidence + completed_by 必須、skipped は理由必須
--   - partial index: pending|in_progress かつ due_date < now() (churn.ts
--     milestone_overdue ルールが利用)
--
-- 旧 mockRenewalMilestoneRepo / lib/domain/renewal.transitionMilestone は
-- 既に新 enum を強制しているため、本マイグレーションで DB 側に同等の
-- CHECK を入れて整合する。
-- ============================================================

-- 1. 旧 status CHECK 制約を削除
do $$
declare
  c_name text;
begin
  for c_name in
    select conname from pg_constraint
    where conrelid = 'renewal_milestones'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table renewal_milestones drop constraint %I', c_name);
  end loop;
end$$;

-- 2. 旧 'todo' データを 'pending' に移行 (履歴保護)
update renewal_milestones set status = 'pending' where status = 'todo';

-- 3. status のデフォルトを 'pending' へ変更し、新 CHECK を貼る
alter table renewal_milestones
  alter column status set default 'pending';
alter table renewal_milestones
  add constraint renewal_milestones_status_check
  check (status in ('pending','in_progress','done','skipped'));

-- 4. 追加列
alter table renewal_milestones
  add column if not exists completed_by    uuid references app_users(id),
  add column if not exists completed_at    timestamptz,
  add column if not exists evidence        jsonb,
  add column if not exists skipped_reason  text;

-- 5. 業務 CHECK
-- done なら evidence + completed_by 必須 (note または attachmentUrl のいずれか)
alter table renewal_milestones
  drop constraint if exists renewal_milestones_done_evidence_required,
  add  constraint renewal_milestones_done_evidence_required
  check (
    status <> 'done'
    or (
      completed_by is not null
      and evidence is not null
      and (
        evidence ? 'note'
        or evidence ? 'attachmentUrl'
      )
    )
  );

-- skipped なら理由必須
alter table renewal_milestones
  drop constraint if exists renewal_milestones_skipped_reason_required,
  add  constraint renewal_milestones_skipped_reason_required
  check (status <> 'skipped' or skipped_reason is not null);

-- 6. 期日超過検知用 partial index
create index if not exists renewal_milestones_overdue_idx
  on renewal_milestones(due_date)
  where status in ('pending', 'in_progress');

-- ============================================================
-- END 0009
-- ============================================================
