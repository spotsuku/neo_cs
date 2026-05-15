-- ============================================================
-- 0049_onboarding_academia_template_reset.sql
-- academia オンボテンプレを 3 フェーズ構成に作り直す。
-- - 既存 academia カテゴリ (contract / pr / course_setup / participant /
--   旧 contract_welcome / usage_policy / participation_prep) を一括削除
-- - 以下 3 フェーズを新規投入:
--     contract_welcome   契約ウェルカムフェーズ (9項目)
--     usage_policy       活用方針確定フェーズ   (5項目)
--     participation_prep 参加準備フェーズ        (7項目)
--
-- onboarding_tasks.template_item_id は ON DELETE SET NULL (0048) のため、
-- 既存タスクのリンクは外れるが行自体は残る。
-- ============================================================

-- 1) 既存 academia カテゴリを全削除 (items はカスケード削除)
delete from onboarding_template_categories where product_code='academia';

-- 2) カテゴリ追加
insert into onboarding_template_categories(product_code, category_key, label, display_order) values
  ('academia', 'contract_welcome',   '契約ウェルカムフェーズ', 1),
  ('academia', 'usage_policy',       '活用方針確定フェーズ',   2),
  ('academia', 'participation_prep', '参加準備フェーズ',       3);

-- 3) 項目追加
do $$
declare
  cat_id uuid;
begin
  -- ===== 契約ウェルカムフェーズ (9項目) =====
  select id into cat_id from onboarding_template_categories
   where product_code='academia' and category_key='contract_welcome';
  insert into onboarding_template_items(category_id, item_key, name, due_offset_days, required, default_assignee_role) values
    (cat_id, 'verbal_approval',  '企業からの内諾',         -90, true, 'cs'),
    (cat_id, 'sales_handoff',    '営業からの引き継ぎ',     -85, true, 'cs'),
    (cat_id, 'handoff_greeting', '引き継ぎ挨拶（メール）', -80, true, 'cs'),
    (cat_id, 'contract_info',    '契約内容、送付先確認',   -75, true, 'cs'),
    (cat_id, 'invoice_info',     '請求内容、送付先確認',   -75, true, 'finance'),
    (cat_id, 'contract_send',    '契約書送付',             -60, true, 'cs'),
    (cat_id, 'contract_signed',  '契約締結完了',           -45, true, 'cs'),
    (cat_id, 'invoice_send',     '請求書送付',             -30, true, 'finance'),
    (cat_id, 'payment_confirm',  '入金確認',               -15, true, 'finance');

  -- ===== 活用方針確定フェーズ (5項目) =====
  select id into cat_id from onboarding_template_categories
   where product_code='academia' and category_key='usage_policy';
  insert into onboarding_template_items(category_id, item_key, name, due_offset_days, required, default_assignee_role) values
    (cat_id, 'prekickoff_schedule',  'プレキックオフ日程調整',     -45, true, 'cs'),
    (cat_id, 'prekickoff_execute',   'プレキックオフ実施',         -30, true, 'cs'),
    (cat_id, 'org_chart_submitted',  '企業組織図提出完了',         -25, true, 'cs'),
    (cat_id, 'vision_submitted',     'ビジョンと期待値の提出完了', -25, true, 'cs'),
    (cat_id, 'participant_finalized','企業選抜生確定',             -21, true, 'cs');

  -- ===== 参加準備フェーズ (7項目) =====
  select id into cat_id from onboarding_template_categories
   where product_code='academia' and category_key='participation_prep';
  insert into onboarding_template_items(category_id, item_key, name, due_offset_days, required, default_assignee_role) values
    (cat_id, 'kickoff_schedule',         'キックオフ日程調整',         -14, true,  'cs'),
    (cat_id, 'kickoff_execute',          'キックオフ実施',               0, true,  'cs'),
    (cat_id, 'pre_training_attendance',  '事前研修全員参加',            -7, true,  'cs'),
    (cat_id, 'slack_login',              'Slackに全員ログイン完了',     -3, true,  'ops'),
    (cat_id, 'portal_login',             'ポータルに全員ログイン完了',  -3, true,  'ops'),
    (cat_id, 'kickoff_party_attendance', 'kickoffパーティ参加',         -3, true,  'cs'),
    (cat_id, 'first_lecture_attend',     '第1回講義参加',                7, false, 'cs');
end $$;
