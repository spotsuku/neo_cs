-- ============================================================
-- 0033_sales_handoffs_idempotency.sql
-- Sales handoff の Idempotency-Key を sales_handoffs テーブルに永続化
--
-- 背景:
--   webhook 受信ハンドラ (app/api/integrations/sales/handoff/route.ts) で
--   Idempotency-Key を in-memory Map で管理していた。Vercel multi-instance
--   では別インスタンスが独立した Map を持つため、同 deal が重複処理される
--   可能性があった。
--
-- 本マイグレーション:
--   - sales_handoffs に idempotency_key 列を追加 (nullable)
--   - (organization_id, idempotency_key) で部分 UNIQUE インデックス
--     ※ 既存行は idempotency_key=NULL なので衝突しない
--   - ハンドラ側は事前 INSERT で衝突を検出して duplicate を返す
-- ============================================================

alter table sales_handoffs
  add column if not exists idempotency_key text;

create unique index if not exists sales_handoffs_idem_uniq
  on sales_handoffs(organization_id, idempotency_key)
  where idempotency_key is not null;
