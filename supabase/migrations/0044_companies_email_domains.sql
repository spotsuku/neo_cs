-- ============================================================
-- 0044: companies.email_domains を追加
--   - 受信メールの送信元アドレスのドメイン部 (例 aeon-kyushu.com) と
--     一致したら、その会社のメールとして自動振り分けする
--   - 1 社で複数ドメイン (子会社・別ブランド) を想定して text[]
--   - UI から CS が編集できるよう、後続の UI 改修で settings 画面に組み込む
--
-- 例:
--   update companies set email_domains = '{aeon-kyushu.com}' where id='c-aeon';
-- ============================================================

alter table companies
  add column if not exists email_domains text[] not null default '{}';

-- ドメイン → company 検索を高速化 (GIN index)
create index if not exists companies_email_domains_idx
  on companies using gin (email_domains);
