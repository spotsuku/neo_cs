-- ============================================================
-- 0015_stakeholder_engagement.sql
-- Phase2-#4 顧客側担当者エンゲージメント tier 可視化
--
-- 背景:
--   stakeholders に「直近接点頻度」ベースの 4 区分 tier を持たせる。
--   既存の関連列 stakeholders.engagement (low|med|high — 主観評価) とは
--   別概念。こちらは自動算出 (lib/domain/engagement.ts) を suggested とし、
--   担当 CS が手動で上書き可能 (engagement_tier列 を override 値として保持)。
--
-- 列:
--   engagement_tier               : core | active | casual | at_risk (NULL=未設定=自動算出に従う)
--   engagement_tier_overridden_by : 上書きした app_users.id
--   engagement_tier_overridden_at : 上書き時刻
--   engagement_note               : 上書き理由メモ (CS の判断記録)
--
-- 注意:
--   - 自動算出はクライアント側 (画面表示時) で実施。本テーブルには
--     suggested 値はキャッシュしない (再計算が安価で stale を避けるため)
--   - 監査は audit_logs (run_after_write フック経由) に記録
-- ============================================================

alter table stakeholders
  add column if not exists engagement_tier text
    check (engagement_tier in ('core','active','casual','at_risk')),
  add column if not exists engagement_tier_overridden_by uuid references app_users(id),
  add column if not exists engagement_tier_overridden_at timestamptz,
  add column if not exists engagement_note text;

-- 上書きの整合性: tier を立てたら overridden_at は自動で now() を期待する
-- (アプリ側で setEngagementTier から渡す前提だが、保険として trigger を置く)
create or replace function stakeholders_set_engagement_overridden_at()
returns trigger as $$
begin
  if NEW.engagement_tier is distinct from OLD.engagement_tier then
    if NEW.engagement_tier is null then
      NEW.engagement_tier_overridden_by := null;
      NEW.engagement_tier_overridden_at := null;
    else
      -- overridden_at が呼出側未指定なら now() を補う
      if NEW.engagement_tier_overridden_at is null then
        NEW.engagement_tier_overridden_at := now();
      end if;
    end if;
  end if;
  return NEW;
end$$ language plpgsql;

drop trigger if exists trg_stakeholders_engagement_overridden_at on stakeholders;
create trigger trg_stakeholders_engagement_overridden_at
  before update on stakeholders
  for each row
  execute function stakeholders_set_engagement_overridden_at();

-- 検索高速化 (at_risk top5 などで頻出)
create index if not exists stakeholders_engagement_tier_idx
  on stakeholders(organization_id, engagement_tier);
