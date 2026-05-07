-- ============================================================
-- 0034_rate_limit_counters.sql
-- 分散レート制限 (Token Bucket) を支える counters テーブル
--
-- 背景:
--   lib/security/rate-limit.ts は in-memory Map で実装されていたため、
--   Vercel multi-instance では各インスタンスが独立した bucket を持ち、
--   実効レートがインスタンス数倍になっていた。
--
-- 設計:
--   - bucket は (key) を主キーに保存。tokens (現在の token 数) と
--     updated_at (最終更新時刻) のみ保持。capacity / refill rate は
--     アプリ側設定 (lib/security/rate-limit.ts の RATE_*) を正本とする。
--   - 古い bucket (24h 以上更新なし) は cleanup 関数で掃除する。
--
-- 並行性:
--   - 単純な SELECT → 計算 → UPDATE は競合する。アプリ側は
--     INSERT ... ON CONFLICT DO UPDATE で原子的に決済する SQL を発行する。
--
-- RLS:
--   - service_role 専用。authenticated/anon はアクセス禁止。
-- ============================================================

create table if not exists rate_limit_counters (
  key         text primary key,
  tokens      double precision not null,
  updated_at  timestamptz not null default now()
);

create index if not exists rate_limit_counters_updated_idx
  on rate_limit_counters(updated_at desc);

alter table rate_limit_counters enable row level security;

drop policy if exists rate_limit_counters_no_authenticated on rate_limit_counters;
create policy rate_limit_counters_no_authenticated on rate_limit_counters
  for all
  to authenticated
  using (false)
  with check (false);

-- 24h 以上更新の無い bucket を掃除する関数 (cron で叩く)
create or replace function rate_limit_counters_cleanup()
returns integer language plpgsql security definer set search_path = public as $$
declare
  deleted integer;
begin
  delete from rate_limit_counters
   where updated_at < now() - interval '24 hours';
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

-- ============================================================
-- 原子的 consume 関数
--   p_key         bucket key
--   p_capacity    最大トークン (バースト上限)
--   p_refill      毎秒回復量
--   p_now         判定基準時刻 (省略時 now())
-- 返却: (allowed boolean, remaining integer, retry_after_sec integer)
-- 内部で UPSERT。INSERT ... ON CONFLICT DO UPDATE により serializable に
-- 近い動作 (Postgres の row-level lock) で並行リクエストを正しく決済する。
-- ============================================================
create or replace function rate_limit_consume(
  p_key       text,
  p_capacity  double precision,
  p_refill    double precision,
  p_now       timestamptz default now()
)
returns table(allowed boolean, remaining integer, retry_after_sec integer)
language plpgsql as $$
declare
  v_tokens   double precision;
  v_updated  timestamptz;
  v_elapsed  double precision;
  v_new      double precision;
begin
  -- 既存 bucket を取得 (なければ capacity スタート)
  select tokens, updated_at into v_tokens, v_updated
    from rate_limit_counters
   where key = p_key
   for update;

  if not found then
    v_tokens := p_capacity;
    v_updated := p_now;
  end if;

  -- 経過秒数で refill
  v_elapsed := greatest(0, extract(epoch from p_now - v_updated));
  v_new := least(p_capacity, v_tokens + v_elapsed * p_refill);

  if v_new < 1 then
    -- 不許可: bucket だけ更新して retry_after を返す
    insert into rate_limit_counters(key, tokens, updated_at)
      values (p_key, v_new, p_now)
    on conflict(key) do update
      set tokens = excluded.tokens,
          updated_at = excluded.updated_at;
    return query select
      false,
      0,
      ceil((1 - v_new) / nullif(p_refill, 0))::integer;
  else
    -- 許可: 1 消費して保存
    insert into rate_limit_counters(key, tokens, updated_at)
      values (p_key, v_new - 1, p_now)
    on conflict(key) do update
      set tokens = excluded.tokens,
          updated_at = excluded.updated_at;
    return query select
      true,
      floor(v_new - 1)::integer,
      0;
  end if;
end;
$$;
