-- ============================================================
-- 本番投入前の検証クエリ集
--
-- Supabase Dashboard → SQL Editor で順に実行する。
-- 各クエリの「期待値」が満たされていれば本番投入可。
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. マイグレーション 0029 / 0030 が適用済か確認
-- ─────────────────────────────────────────────
-- 期待: 全 9 テーブルが返ってくること (count = 9)
select count(*) as journey_v2_tables
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'journey_stage_definitions',
    'company_journeys',
    'business_journeys',
    'journey_events',
    'journey_checkpoint_status',
    'company_visions',
    'company_vision_logs',
    'company_weather_overrides',
    'contract_lifecycle_snapshots'
  );

-- ─────────────────────────────────────────────
-- 2. RLS が全テーブルで ENABLE になっているか
-- ─────────────────────────────────────────────
-- 期待: rowsecurity = true が全行に並ぶこと
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'journey_stage_definitions',
    'company_journeys',
    'business_journeys',
    'journey_events',
    'journey_checkpoint_status',
    'company_visions',
    'company_vision_logs',
    'company_weather_overrides',
    'contract_lifecycle_snapshots',
    'program_terms',
    'program_task_templates',
    'program_company_tasks'
  )
order by tablename;

-- ─────────────────────────────────────────────
-- 3. デモデータが本番 DB に混入していないか
-- ─────────────────────────────────────────────
-- 期待: count = 0
select count(*) as demo_companies_count
from companies
where is_demo = true;

-- 詳細確認 (上記が 0 でない場合)
select id, name, is_demo, created_at
from companies
where is_demo = true
order by created_at desc;

-- ─────────────────────────────────────────────
-- 4. 組織テナントが正しく seed されているか
-- ─────────────────────────────────────────────
-- 期待: 少なくとも 1 行 (NEO ACADEMIA)
select id, slug, name from organizations;

-- ─────────────────────────────────────────────
-- 5. 初期管理者ユーザの確認
-- ─────────────────────────────────────────────
-- 期待: INITIAL_ADMIN_EMAIL に指定したアドレスが role='admin' で存在
select id, email, name, role, organization_id
from app_users
where role in ('admin', 'manager')
order by role, created_at;

-- ─────────────────────────────────────────────
-- 6. ジャーニーステージ定義の seed 確認 (auto-seed)
-- ─────────────────────────────────────────────
-- 期待: 初回 list 呼び出し後、company=7 / business=9 行が存在
-- (アプリから /companies/[id] にアクセスすると auto-seed される)
select journey_type, count(*) as stage_count
from journey_stage_definitions
group by journey_type
order by journey_type;

-- ─────────────────────────────────────────────
-- 7. テンプレ重複の検知 (ジャーニー二重表示バグの根因チェック)
-- ─────────────────────────────────────────────
-- 期待: 0 行 (organizationId × journeyType × stageKey はユニーク制約で守られる)
select organization_id, journey_type, stage_key, count(*) as dup_count
from journey_stage_definitions
group by organization_id, journey_type, stage_key
having count(*) > 1;

-- ─────────────────────────────────────────────
-- 8. 監査ログ (audit_logs) の改ざん検知
-- ─────────────────────────────────────────────
-- 期待: 0 行 (改ざん不可制約があれば破られていない)
select id, entity_type, action, created_at
from audit_logs
where created_at > now() - interval '7 days'
order by created_at desc
limit 20;

-- ─────────────────────────────────────────────
-- 9. 削除済み画面への参照が DB 側に残っていないか
-- ─────────────────────────────────────────────
-- sales-handoff: handoff_id を URL に埋め込んでいた箇所は /companies/[id] に修正済
-- なので DB 側の参照確認は不要。renewal_milestones テーブルは元々無いので OK。

-- ============================================================
-- すべて期待値を満たしたら、本番データ投入を開始してよい状態。
-- 投入後は次の動作確認を実機で行う:
--   - /companies/[id] でジャーニーステージ変更が DB に反映されるか
--   - /voc でカード作成・ステータス変更が DB に反映されるか
--   - /weekly で週次レビュー upsert が DB に反映されるか
--   - /dashboard/[product] で実データが表示されるか (ダミー固定値が無いか)
-- ============================================================
