-- ============================================================
-- 0036_onboarding_template_seed.sql
-- オンボテンプレを DB 化:
--   1. onboarding_template_items に course_key 列を追加 (nullable)
--      mock の OnboardingTemplateItem.courseKey と整合させる。
--      null = 全コース共通、文字列 = 特定コースのみ。
--   2. lib/mock/onboarding.ts:productOnboardingTemplates の値を seed する。
--      重複しないよう unique(product_code, category_key) と
--      unique(category_id, item_key) を使って ON CONFLICT DO NOTHING。
--
-- 設計:
--   - アプリ層 (lib/auth/role-permissions が canPerform を提供) で
--     onboarding テンプレ編集の権限ゲートをかける。
--   - 既存 onboarding_tasks (= 各契約のチェックリスト) は無関係 (FK は維持)。
-- ============================================================

alter table onboarding_template_items
  add column if not exists course_key text;

create index if not exists onboarding_template_items_course_idx
  on onboarding_template_items(category_id, course_key);

-- ───────── seed (mock 値) ─────────────────────────
-- カテゴリ
insert into onboarding_template_categories(product_code, category_key, label, display_order) values
  ('academia', 'contract',     '契約系',         1),
  ('academia', 'pr',           '広報系',         2),
  ('academia', 'course_setup', '講座設定系',     3),
  ('academia', 'participant',  '参加者登録系',   4),
  ('hyogikai', 'contract',     '契約系',         1),
  ('hyogikai', 'pr',           '広報系',         2),
  ('hyogikai', 'course_setup', '運営準備',       3),
  ('hyogikai', 'participant',  '参加者登録系',   4),
  ('aiken',    'contract',     '契約系',         1),
  ('aiken',    'pr',           '広報系',         2),
  ('aiken',    'course_setup', '講座設定系',     3),
  ('aiken',    'participant',  '参加者登録系',   4),
  ('commu',    'contract',     '契約系',         1),
  ('commu',    'pr',           '広報系',         2),
  ('commu',    'course_setup', '講座設定系',     3),
  ('commu',    'participant',  '参加者登録系',   4)
on conflict (product_code, category_key) do nothing;

-- 項目: SQL は冗長になるが seed なので明示的に列挙する。
-- WITH 句で category_id を引いてから INSERT する形。
do $$
declare
  cat_id uuid;
begin
  -- ===== academia =====
  select id into cat_id from onboarding_template_categories
   where product_code='academia' and category_key='contract';
  insert into onboarding_template_items(category_id, item_key, name, due_offset_days, required, default_assignee_role) values
    (cat_id, 'verbal_record',    '内諾内容の記録',     -30, true, 'cs'),
    (cat_id, 'nda',              'NDA締結',            -25, true, 'cs'),
    (cat_id, 'contract_send',    '契約書送付',         -20, true, 'cs'),
    (cat_id, 'contract_return',  '契約書回収',         -10, true, 'cs'),
    (cat_id, 'invoice',          '請求書発行',          -5, true, 'finance'),
    (cat_id, 'payment_confirm',  '入金確認',            30, true, 'finance')
  on conflict (category_id, item_key) do nothing;

  select id into cat_id from onboarding_template_categories
   where product_code='academia' and category_key='pr';
  insert into onboarding_template_items(category_id, item_key, name, due_offset_days, required, default_assignee_role) values
    (cat_id, 'lp_listing',  'LPへの企業ロゴ掲載',   -14, false, 'pr'),
    (cat_id, 'pr_release',  'プレスリリース調整',   -10, false, 'pr'),
    (cat_id, 'sns_post',    'SNS告知投稿',           -3, false, 'pr')
  on conflict (category_id, item_key) do nothing;

  select id into cat_id from onboarding_template_categories
   where product_code='academia' and category_key='course_setup';
  insert into onboarding_template_items(category_id, item_key, name, due_offset_days, required, default_assignee_role) values
    (cat_id, 'venue',          '開講式会場の予約',           -21, true, 'ops'),
    (cat_id, 'materials',      '教材一式の準備',              -7, true, 'ops'),
    (cat_id, 'lecturer',       '年間講師のアサイン確定',     -14, true, 'ops'),
    (cat_id, 'schedule',       '年間スケジュール確定・共有', -14, true, 'cs')
  on conflict (category_id, item_key) do nothing;

  select id into cat_id from onboarding_template_categories
   where product_code='academia' and category_key='participant';
  insert into onboarding_template_items(category_id, item_key, name, due_offset_days, required, default_assignee_role) values
    (cat_id, 'participant_list','派遣者3名のリスト受領',  -21, true,  'cs'),
    (cat_id, 'account',         '参加者アカウント発行',    -7, true,  'ops'),
    (cat_id, 'welcome_mail',    'ウェルカムメール配信',    -3, true,  'cs'),
    (cat_id, 'pre_survey',      '事前アンケート配布',      -3, false, 'cs')
  on conflict (category_id, item_key) do nothing;

  -- ===== hyogikai =====
  select id into cat_id from onboarding_template_categories
   where product_code='hyogikai' and category_key='contract';
  insert into onboarding_template_items(category_id, item_key, name, due_offset_days, required) values
    (cat_id, 'verbal_record',   '内諾内容の記録',  -30, true),
    (cat_id, 'contract_send',   '契約書送付',      -15, true),
    (cat_id, 'contract_return', '契約書回収',       -7, true),
    (cat_id, 'invoice',         '請求書発行',       -3, true)
  on conflict (category_id, item_key) do nothing;

  select id into cat_id from onboarding_template_categories
   where product_code='hyogikai' and category_key='pr';
  insert into onboarding_template_items(category_id, item_key, name, due_offset_days, required) values
    (cat_id, 'lp_listing', '公式サイトへの掲載', -7, false),
    (cat_id, 'sns_post',   'SNS告知',            -3, false)
  on conflict (category_id, item_key) do nothing;

  select id into cat_id from onboarding_template_categories
   where product_code='hyogikai' and category_key='course_setup';
  insert into onboarding_template_items(category_id, item_key, name, due_offset_days, required) values
    (cat_id, 'theme_plan', '年間テーマプラン共有', -14, true),
    (cat_id, 'venue',      '定例会会場の確保',     -21, true)
  on conflict (category_id, item_key) do nothing;

  select id into cat_id from onboarding_template_categories
   where product_code='hyogikai' and category_key='participant';
  insert into onboarding_template_items(category_id, item_key, name, due_offset_days, required) values
    (cat_id, 'regular_members', '固定メンバー確定',     -14, true),
    (cat_id, 'welcome_mail',    'ウェルカムメール配信',  -3, true)
  on conflict (category_id, item_key) do nothing;

  -- ===== aiken =====
  select id into cat_id from onboarding_template_categories
   where product_code='aiken' and category_key='contract';
  insert into onboarding_template_items(category_id, item_key, name, due_offset_days, required) values
    (cat_id, 'verbal_record',   '申込内容の記録', -14, true),
    (cat_id, 'contract_send',   '契約書送付',     -10, true),
    (cat_id, 'contract_return', '契約書回収',      -5, true),
    (cat_id, 'invoice',         '請求書発行',      -3, true),
    (cat_id, 'payment_confirm', '入金確認',         0, true)
  on conflict (category_id, item_key) do nothing;

  select id into cat_id from onboarding_template_categories
   where product_code='aiken' and category_key='pr';
  insert into onboarding_template_items(category_id, item_key, name, due_offset_days, required) values
    (cat_id, 'lp_listing', '受講企業ロゴ掲載', -5, false)
  on conflict (category_id, item_key) do nothing;

  select id into cat_id from onboarding_template_categories
   where product_code='aiken' and category_key='course_setup';
  insert into onboarding_template_items(category_id, item_key, name, due_offset_days, required) values
    (cat_id, 'venue',          'Day1/Day2 会場確保', -7, true),
    (cat_id, 'materials',      '教材配布',          -3, true),
    (cat_id, 'lecturer_brief', '講師との事前打合せ', -3, true)
  on conflict (category_id, item_key) do nothing;

  select id into cat_id from onboarding_template_categories
   where product_code='aiken' and category_key='participant';
  insert into onboarding_template_items(category_id, item_key, name, due_offset_days, required) values
    (cat_id, 'participant_list', '受講者リスト受領',     -7, true),
    (cat_id, 'account',          '受講者アカウント発行', -3, true),
    (cat_id, 'welcome_mail',     'ウェルカムメール配信', -2, true)
  on conflict (category_id, item_key) do nothing;

  -- ===== commu =====
  select id into cat_id from onboarding_template_categories
   where product_code='commu' and category_key='contract';
  insert into onboarding_template_items(category_id, item_key, name, due_offset_days, required) values
    (cat_id, 'verbal_record',   '内諾内容の記録', -14, true),
    (cat_id, 'contract_send',   '契約書送付',     -10, true),
    (cat_id, 'contract_return', '契約書回収',      -5, true),
    (cat_id, 'invoice',         '請求書発行',      -3, true)
  on conflict (category_id, item_key) do nothing;

  select id into cat_id from onboarding_template_categories
   where product_code='commu' and category_key='pr';
  insert into onboarding_template_items(category_id, item_key, name, due_offset_days, required) values
    (cat_id, 'lp_listing', 'LP企業ロゴ掲載', -7, false)
  on conflict (category_id, item_key) do nothing;

  select id into cat_id from onboarding_template_categories
   where product_code='commu' and category_key='course_setup';
  insert into onboarding_template_items(category_id, item_key, name, due_offset_days, required) values
    (cat_id, 'schedule',  '3ヶ月スケジュール確定', -10, true),
    (cat_id, 'materials', '教材準備',              -5, true)
  on conflict (category_id, item_key) do nothing;

  select id into cat_id from onboarding_template_categories
   where product_code='commu' and category_key='participant';
  insert into onboarding_template_items(category_id, item_key, name, due_offset_days, required) values
    (cat_id, 'participant_list', '受講者リスト受領',     -7, true),
    (cat_id, 'account',          '受講者アカウント発行', -3, true),
    (cat_id, 'kickoff_invite',   'Kickoff招待状配信',    -3, true)
  on conflict (category_id, item_key) do nothing;
end $$;
