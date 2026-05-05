-- ============================================================
-- 0021_karute_no.sql — companies に karute_no (カルテNo.) を追加
--
-- 目的:
--   各企業に組織単位で一意の整数「カルテ No.」を付与し、UI 上の
--   ソート・識別子として利用する。ユーザは管理画面から手動編集可能で、
--   重複は unique 制約で防ぐ。
--
-- ポリシー:
--   - 同一 organization_id 内で karute_no は unique
--   - 既存企業は最初の契約 (min(contracts.start_date)) 昇順で 1, 2, 3, ...
--     を採番する。契約のない企業は created_at 順で末尾に並べる
--   - 新規 INSERT 時は (organization_id 内 MAX(karute_no) + 1) をアプリ層で割り当てる
--     (将来トリガ化検討)
-- ============================================================

-- 1) カラム追加
alter table companies
  add column if not exists karute_no integer;

-- 2) unique 制約 (組織単位)
create unique index if not exists companies_karute_no_idx
  on companies(organization_id, karute_no) where karute_no is not null;

-- 3) 既存データを契約順でバックフィル
--    契約がある: min(contracts.start_date) 昇順
--    契約がない: created_at 昇順 (末尾)
do $$
declare
  rec record;
  org uuid;
  next_no integer;
begin
  for org in (select distinct organization_id from companies) loop
    next_no := 1;
    for rec in
      select c.id
      from companies c
      left join (
        select company_id, min(start_date) as first_start
        from contracts
        group by company_id
      ) cx on cx.company_id = c.id
      where c.organization_id = org
        and c.karute_no is null
      order by
        cx.first_start nulls last,
        c.created_at asc nulls last,
        c.id asc
    loop
      update companies set karute_no = next_no where id = rec.id;
      next_no := next_no + 1;
    end loop;
  end loop;
end $$;

-- 4) コメント
comment on column companies.karute_no is
  'カルテ No. (組織内一意)。契約順 (= 最初の契約 start_date 昇順) で初期採番。手動編集可。';

-- ============================================================
-- END 0021_karute_no.sql
-- ============================================================
