-- ============================================================
-- 0013_product_courses_edit.sql
-- Phase1-#1 コース編集機能
--
-- 背景:
--   /settings/products/[code] からコース (product_courses) の
--   追加・削除・コードID(course_key)/名称/表示順 編集ができるようにする。
--
-- product_courses は 0001_init.sql で作成済 (PK: (product_code, course_key))
-- RLS は 0006_rls_policies.sql で「マスタ系」として
-- authenticated 全件 read / admin write が定義済。
--
-- 本マイグレーションでは:
--   1. contracts(product_code, course_key) の影響件数カウント高速化のための
--      index を追加 (countContractsByCourse の SELECT count(*) WHERE 用)
--   2. course_key の英数+ハイフン制約を CHECK で追加 (画面側 validation の二重防御)
-- ============================================================

-- 1. contracts.course_key 影響カウント用 index
create index if not exists contracts_product_course_idx
  on contracts(product_code, course_key);

-- 2. course_key の文字種制約 (英数+ハイフン、2〜40文字。但し1文字英数も許容)
--    既存データに違反があると失敗するため、まず違反行を検出する
do $$
declare
  bad_count int;
begin
  select count(*) into bad_count
  from product_courses
  where course_key !~ '^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38}[a-zA-Z0-9])?$';
  if bad_count > 0 then
    raise notice 'product_courses.course_key 不正フォーマット: % 件 (制約追加スキップ)', bad_count;
  else
    -- CHECK 制約 (POSIX 正規表現)。同名既存があれば drop してから再作成
    if not exists (
      select 1 from pg_constraint
      where conname = 'product_courses_course_key_format'
    ) then
      alter table product_courses
        add constraint product_courses_course_key_format
        check (course_key ~ '^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38}[a-zA-Z0-9])?$');
    end if;
  end if;
end$$;
