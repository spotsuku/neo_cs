-- ============================================================
-- 0050_onboarding_tasks_backfill_template_item_id.sql
-- 一括適用 (applyTemplateToActiveContractsAction) で作成済の
-- onboarding_tasks のうち template_item_id が null の行を、
-- (product_code, phase_key=category_key, name) で template と突合して埋め直す。
--
-- 背景: createBatch (supabase) が template_item_id を INSERT していなかった
-- ため、listByContractIds の join が外れて itemKey が task UUID にフォール
-- バックし、MatrixView の列マッチに失敗していた (全セル "—")。
-- ============================================================

update onboarding_tasks t
   set template_item_id = i.id,
       updated_at = now()
  from onboarding_template_items i,
       onboarding_template_categories c,
       contracts ct
 where i.category_id = c.id
   and ct.id = t.contract_id
   and t.template_item_id is null
   and t.phase_key = c.category_key
   and t.name = i.name
   and ct.product_code = c.product_code;
