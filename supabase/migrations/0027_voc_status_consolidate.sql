-- ============================================================
-- 0026_voc_status_consolidate.sql
-- VOC ステータスを4値に集約
--   new      → open
--   triaged  → in_progress
--   backlog  → in_progress
--   shipped  → done
--   wontfix  → wontfix (変更なし)
-- ============================================================

-- 1. 既存の CHECK 制約を外す (制約名は Postgres 自動生成: voc_items_status_check)
alter table voc_items
  drop constraint if exists voc_items_status_check;

-- 2. 既存データを新しい値にマップ
update voc_items set status = 'open'        where status = 'new';
update voc_items set status = 'in_progress' where status in ('triaged', 'backlog');
update voc_items set status = 'done'        where status = 'shipped';

-- 3. デフォルトと CHECK 制約を新値で再設定
alter table voc_items
  alter column status set default 'open';

alter table voc_items
  add constraint voc_items_status_check
  check (status in ('open', 'in_progress', 'done', 'wontfix'));

-- 4. 部分インデックスを再作成
drop index if exists voc_items_new_idx;
create index voc_items_open_idx on voc_items(created_at desc) where status = 'open';
