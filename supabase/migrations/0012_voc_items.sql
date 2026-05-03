-- ============================================================
-- 0012_voc_items.sql
-- ストリーム01 P1: VOC (Voice of Customer) 要望管理 (申し送り x)
--
-- ストリーム02 H項「サーベイ自由記述・面談ログ・週次レビューから抽出した
-- プロダクト要望タグの triage / backlog / ship 管理」用。
-- voc_items + voc_comments の2テーブル構成 (コメントは2-3往復程度の運用)。
-- ============================================================

create table voc_items (
  id                     text primary key,
  organization_id        uuid not null references organizations(id),
  source_type            text not null check (source_type in (
                           'survey_response',
                           'meeting_log',
                           'weekly_review'
                         )),
  source_id              text not null,
  contract_id            text references contracts(id) on delete set null,
  company_id             text references companies(id) on delete set null,
  excerpt                text not null,
  tags                   text[] not null default '{}',
  status                 text not null default 'new'
                           check (status in ('new','triaged','backlog','shipped','wontfix')),
  priority               text not null default 'med'
                           check (priority in ('low','med','high')),
  linked_pr_url          text,
  assigned_to            uuid references app_users(id),
  created_by             uuid references app_users(id),
  triaged_by             uuid references app_users(id),
  triaged_at             timestamptz,
  shipped_at             timestamptz,
  customer_notified_at   timestamptz,
  notified_at            timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger voc_items_updated_at
  before update on voc_items
  for each row execute function set_updated_at();

-- triage 待ち
create index voc_items_new_idx on voc_items(created_at desc) where status = 'new';
-- 通知バッチ: 未通知 priority=high
create index voc_items_unnotified_high_idx
  on voc_items(created_at desc)
  where notified_at is null and priority = 'high';
-- タグ検索 (GIN)
create index voc_items_tags_gin on voc_items using gin (tags);
-- org / company / contract 別索引
create index voc_items_org_idx on voc_items(organization_id, status);
create index voc_items_company_idx on voc_items(company_id) where company_id is not null;
create index voc_items_contract_idx on voc_items(contract_id) where contract_id is not null;

-- ============================================================
-- voc_comments (簡易コメント。ボードのチケット運用と同じ流量を想定)
-- ============================================================
create table voc_comments (
  id           text primary key,
  voc_item_id  text not null references voc_items(id) on delete cascade,
  author_id    uuid not null references app_users(id),
  body         text not null,
  created_at   timestamptz not null default now()
);

create index voc_comments_item_idx on voc_comments(voc_item_id, created_at);

-- ============================================================
-- RLS (0006 と同パターン)
--   - 同 org の authenticated は read 可
--   - write (create / setStatus / setPriority / append-comment 等) は
--     manager 以上 + 関連 company の担当 member
--   - source が contract/company に紐付かないケース (一般的な要望) は
--     manager 以上のみ書込み可とする
-- ============================================================
alter table voc_items enable row level security;
alter table voc_comments enable row level security;

drop policy if exists voc_items_select on voc_items;
drop policy if exists voc_items_write  on voc_items;

create policy voc_items_select on voc_items
  for select to authenticated
  using (
    is_admin()
    or organization_id = current_org_id()
  );

create policy voc_items_write on voc_items
  for all to authenticated
  using (
    is_manager_or_above()
    or (company_id is not null and has_company_access(company_id))
  )
  with check (
    is_manager_or_above()
    or (company_id is not null and has_company_access(company_id))
  );

drop policy if exists voc_comments_select on voc_comments;
drop policy if exists voc_comments_write  on voc_comments;

create policy voc_comments_select on voc_comments
  for select to authenticated
  using (
    is_admin()
    or exists (
      select 1 from voc_items i
      where i.id = voc_comments.voc_item_id
        and i.organization_id = current_org_id()
    )
  );

-- 親 voc_items に書込み可能なロールがコメント追加可能
create policy voc_comments_write on voc_comments
  for all to authenticated
  using (
    is_manager_or_above()
    or exists (
      select 1 from voc_items i
      where i.id = voc_comments.voc_item_id
        and (i.company_id is not null and has_company_access(i.company_id))
    )
  )
  with check (
    is_manager_or_above()
    or exists (
      select 1 from voc_items i
      where i.id = voc_comments.voc_item_id
        and (i.company_id is not null and has_company_access(i.company_id))
    )
  );

-- ============================================================
-- END 0012
-- ============================================================
