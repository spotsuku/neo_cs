-- ============================================================
-- 0027_companies_logo.sql — companies にロゴ画像を保存できるように
--
-- 目的:
--   企業詳細・一覧・カードなど UI 上で企業ロゴを表示するため、
--   companies テーブルにロゴ画像の保存先 (URL もしくは data URI) を
--   保持するカラムを追加する。
--
-- 実装方針:
--   - 画像本体はオブジェクトストレージ (Supabase Storage 等) に置き、
--     companies.logo_url にはその公開 URL を入れる運用を基本とする
--   - 小さい SVG など inline で扱うケース (デモ seed) では
--     `data:image/svg+xml;base64,...` 形式の data URI も許容する
--   - 任意項目 (NULL 許容)
-- ============================================================

alter table companies
  add column if not exists logo_url text;

comment on column companies.logo_url is
  '企業ロゴ画像の URL もしくは data URI (任意)。Storage の公開 URL を想定。';

-- ============================================================
-- END 0027_companies_logo.sql
-- ============================================================
