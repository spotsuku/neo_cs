-- ============================================================
-- 0046_ai_extraction_company_suggestion.sql
-- ai_extractions.extraction_type の CHECK 制約に 'company_suggestion' を追加。
--
-- 未割当 Gmail スレッドに対する AI 企業候補提示 (on-demand) の履歴を
-- ai_extractions に保存するため、既存 5 種に新しい extraction_type を追加する。
--
-- 既存 CHECK 制約名は環境ごとに揺れる可能性があるため、
-- 0032_onboarding_note_not_applicable.sql と同じ DO ブロック方式で
-- extraction_type を含む CHECK 制約を探して drop → 再作成する。
-- ============================================================

do $$
declare
  c_name text;
begin
  for c_name in
    select conname from pg_constraint
    where conrelid = 'ai_extractions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%extraction_type%'
  loop
    execute format('alter table ai_extractions drop constraint %I', c_name);
  end loop;
end $$;

alter table ai_extractions
  add constraint ai_extractions_extraction_type_check
  check (extraction_type in (
    'progress_signal',
    'risk_signal',
    'churn_signal',
    'expansion_signal',
    'meeting_request',
    'company_suggestion'
  ));

-- ============================================================
-- END 0046
-- ============================================================
