-- ============================================================
-- 0048_onboarding_tasks_template_set_null.sql
-- onboarding_tasks.template_item_id の FK 挙動を SET NULL に変更
--
-- 背景:
--   0001_init.sql で onboarding_tasks.template_item_id は
--   `references onboarding_template_items(id)` (ON DELETE 未指定 = RESTRICT)
--   で定義されていた。このため:
--     - onboarding_template_categories を削除しようとすると
--     - cascade で onboarding_template_items を削除しようとし
--     - そこに残る onboarding_tasks が阻止して FK 違反でエラー
--
-- 修正:
--   FK を ON DELETE SET NULL に張り替える。
--   テンプレを削除しても、それまでに発生した onboarding_tasks (過去実績) は
--   残り、template_item_id だけが NULL になる。タスク本体の name/status 等は
--   保持されるので過去履歴は失われない。
--
-- 整合性:
--   listByContractIds の join (`template:onboarding_template_items(item_key)`)
--   は左外結合扱いになるため、template_item_id が NULL の行は
--   `template?.item_key ?? r.id` (現コード) で fallback され UI は壊れない。
-- ============================================================

alter table onboarding_tasks
  drop constraint if exists onboarding_tasks_template_item_id_fkey;

alter table onboarding_tasks
  add constraint onboarding_tasks_template_item_id_fkey
  foreign key (template_item_id)
  references onboarding_template_items(id)
  on delete set null;
