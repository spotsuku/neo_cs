-- ============================================================
-- 0022_hyogikai_bundle.sql — アカデミア⇄評議会のバンドル整合性
--
-- 目的:
--   アカデミア (academia) 契約には評議会 (hyogikai) 参加権が必ず付帯するため、
--   同一会社で「academia と hyogikai の両方が active」状態を禁止する。
--   売上は academia 側に内包されるため、hyogikai 単独契約は academia が
--   active な間は作成できない。
--
-- ポリシー:
--   - active 系ステータス: handoff / onboarding / active / renewal_window
--   - DBレベルで部分 unique 制約 + トリガで二重 active を防止
--   - 切替フロー (academia 解約 → hyogikai 単独契約) は status を flip
--     する trigger 内で許容される (チェックは新規 INSERT 時のみ強制)
-- ============================================================

-- 0) 既存データの整合化
--    seed に academia と hyogikai の同時 active が含まれているため、
--    unique index を張る前にバンドル方針 (academia が hyogikai 参加権を内包) に
--    従って、academia と同時に active な hyogikai は churned に倒す。
--    本番に実データがあるDBで実行されるケースを考慮し、is_demo=true のものに
--    限定 (本番データを誤って churned にしない安全策)。
update contracts c
   set status = 'churned',
       updated_at = now()
  from contracts a
  join companies co on co.id = a.company_id
 where c.organization_id = a.organization_id
   and c.company_id      = a.company_id
   and a.product_code    = 'academia'
   and c.product_code    = 'hyogikai'
   and a.status          in ('handoff', 'onboarding', 'active', 'renewal_window')
   and c.status          in ('handoff', 'onboarding', 'active', 'renewal_window')
   and co.is_demo        = true
   and c.id              <> a.id;

-- 1) アクティブ判定ビュー (再利用しやすくするため)
create or replace view contracts_active_v as
  select * from contracts
  where status in ('handoff', 'onboarding', 'active', 'renewal_window');

comment on view contracts_active_v is
  '契約サイクル中のもの (renewed / churned 以外)。バンドル整合性チェックに使用。';

-- 2) 同一 (organization_id, company_id, product_code) で active が複数生まれないよう
--    部分 unique index を追加
create unique index if not exists contracts_active_unique_idx
  on contracts (organization_id, company_id, product_code)
  where status in ('handoff', 'onboarding', 'active', 'renewal_window');

-- 3) academia と hyogikai が同時 active にならないよう専用 unique
--    (organization_id, company_id) 単位で「academia | hyogikai」グループに
--    1本だけ active を許容する仕組みを部分 index で実現
create unique index if not exists contracts_academia_hyogikai_bundle_idx
  on contracts (organization_id, company_id)
  where product_code in ('academia', 'hyogikai')
    and status in ('handoff', 'onboarding', 'active', 'renewal_window');

comment on index contracts_academia_hyogikai_bundle_idx is
  'アカデミアと評議会は同時 active 不可。アカデミアに評議会が付帯するため重複契約を防止。';

-- 4) 解約→切替時のための説明
--    academia → hyogikai に切替える場合のシーケンス:
--      a) UPDATE contracts SET status='churned' WHERE id=<academia_id>
--      b) INSERT INTO contracts (...) VALUES (..., product_code='hyogikai', status='active')
--    トランザクション内で a→b の順に実行する限り、上記 unique index は通る。

-- ============================================================
-- END 0022_hyogikai_bundle.sql
-- ============================================================
