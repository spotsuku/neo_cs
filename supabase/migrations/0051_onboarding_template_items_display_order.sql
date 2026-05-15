-- ============================================================
-- 0051_onboarding_template_items_display_order.sql
-- onboarding_template_items に display_order 列を追加し、
-- D&D による並び替えを永続化できるようにする。
--
-- 既存行は category 内で item_key の昇順に従って 0, 10, 20, ... を採番。
-- これまでの UI 表示順 (item_key の localeCompare) を維持する。
-- ============================================================

alter table onboarding_template_items
  add column if not exists display_order int not null default 0;

-- 既存データの初期採番 (category_id ごとに item_key 順)
with ranked as (
  select
    id,
    (row_number() over (
      partition by category_id
      order by item_key
    ) - 1) * 10 as new_order
  from onboarding_template_items
)
update onboarding_template_items t
   set display_order = ranked.new_order
  from ranked
 where t.id = ranked.id
   and t.display_order = 0;

create index if not exists onboarding_template_items_category_order_idx
  on onboarding_template_items (category_id, display_order);
