-- ============================================================
-- 0038_onboarding_academia_phase_extension.sql
-- 既存 academia オンボテンプレに、外部メンバーアプリ
-- (neo-fukuoka-members.web.app) のフェーズ別 21 項目を追加。
--
-- 追加カテゴリ (display_order=5..7):
--   - contract_welcome   契約ウェルカム付フェーズ (9項目)
--   - usage_policy       活用方針確定フェーズ     (5項目)
--   - participation_prep 参加準備フェーズ          (7項目)
--
-- 注意: 既存カテゴリ (contract/pr/course_setup/participant) は
--       温存。各企業の onboarding_tasks へは投入しない (テンプレのみ)。
-- ============================================================

-- カテゴリ追加
insert into onboarding_template_categories(product_code, category_key, label, display_order) values
  ('academia', 'contract_welcome',   '契約ウェルカム付フェーズ', 5),
  ('academia', 'usage_policy',       '活用方針確定フェーズ',     6),
  ('academia', 'participation_prep', '参加準備フェーズ',         7)
on conflict (product_code, category_key) do nothing;

-- 項目追加
do $$
declare
  cat_id uuid;
begin
  -- ===== 契約ウェルカム付フェーズ (9項目) =====
  select id into cat_id from onboarding_template_categories
   where product_code='academia' and category_key='contract_welcome';
  insert into onboarding_template_items(category_id, item_key, name, due_offset_days, required, default_assignee_role) values
    (cat_id, 'verbal_approval',    '企業からの内諾',     -90, true, 'cs'),
    (cat_id, 'sales_handoff',      '営業からの引き継ぎ', -85, true, 'cs'),
    (cat_id, 'handoff_greeting',   '引継挨拶',           -80, true, 'cs'),
    (cat_id, 'contract_info',      '契約関連情報確認',   -75, true, 'cs'),
    (cat_id, 'invoice_info',       '請求関連情報確認',   -75, true, 'finance'),
    (cat_id, 'contract_send',      '契約書送付',         -60, true, 'cs'),
    (cat_id, 'contract_signed',    '契約締結',           -45, true, 'cs'),
    (cat_id, 'invoice_send',       '請求書送付',         -30, true, 'finance'),
    (cat_id, 'payment_confirm',    '入金確認',           -15, true, 'finance')
  on conflict (category_id, item_key) do nothing;

  -- ===== 活用方針確定フェーズ (5項目) =====
  select id into cat_id from onboarding_template_categories
   where product_code='academia' and category_key='usage_policy';
  insert into onboarding_template_items(category_id, item_key, name, due_offset_days, required, default_assignee_role) values
    (cat_id, 'prekickoff_schedule', 'プレキックオフ日程調整',     -45, true, 'cs'),
    (cat_id, 'prekickoff_execute',  'プレキックオフ実施',         -30, true, 'cs'),
    (cat_id, 'org_chart_decided',   '企業組織図決定',             -25, true, 'cs'),
    (cat_id, 'vision_articulation', 'ビジョンと期待値の言語化',   -25, true, 'cs'),
    (cat_id, 'participant_finalized','企業選抜生確定',            -21, true, 'cs')
  on conflict (category_id, item_key) do nothing;

  -- ===== 参加準備フェーズ (7項目) =====
  select id into cat_id from onboarding_template_categories
   where product_code='academia' and category_key='participation_prep';
  insert into onboarding_template_items(category_id, item_key, name, due_offset_days, required, default_assignee_role) values
    (cat_id, 'kickoff_schedule',         'キックオフ日程調整',         -14, true,  'cs'),
    (cat_id, 'kickoff_execute',          'キックオフ実施',               0, true,  'cs'),
    (cat_id, 'pre_training_attendance',  '事前研修出欠確認',            -7, true,  'cs'),
    (cat_id, 'slack_login',              'Slackのログイン',             -3, true,  'ops'),
    (cat_id, 'portal_login',             'ポータルログイン',            -3, true,  'ops'),
    (cat_id, 'kickoff_party_attendance', 'キックオフパーティ出欠確認',  -3, true,  'cs'),
    (cat_id, 'first_lecture_attend',     '第1回講義参加',                7, false, 'cs')
  on conflict (category_id, item_key) do nothing;
end $$;
