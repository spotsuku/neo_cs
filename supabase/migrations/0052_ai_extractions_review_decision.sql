-- ============================================================
-- 0052_ai_extractions_review_decision.sql
-- ai_extractions に review_decision カラムを追加。
--
-- 承認 (approved) と 却下 (rejected) を区別する。
-- 既存 reviewed=true の行は NULL のまま (過去レビュー時点では区別を記録していない)。
-- ============================================================

alter table ai_extractions
  add column if not exists review_decision text
  check (review_decision in ('approved','rejected'));

-- ============================================================
-- END 0052
-- ============================================================
