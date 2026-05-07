/**
 * Token Bucket レート制限 (Supabase バックエンド + memory フォールバック)
 *
 * 設計:
 *   - 本番 (REPO_DRIVER=supabase or RATE_LIMIT_DRIVER=supabase): Supabase の
 *     `rate_limit_consume(key, capacity, refill, now)` RPC を呼んで原子的に決済。
 *     multi-instance / multi-region でも一貫したレート制限になる。
 *   - フォールバック: Supabase 未配線または RPC 失敗時は in-memory bucket で
 *     fail-open (許可) する。サービス停止より「一時的にレート制限が緩む」を選ぶ。
 *
 * 呼び出し側は `await consume(key, cfg)` する (旧来の同期 API は廃止)。
 * 既定プリセットは下部の RATE_USER_CLAUDE / RATE_ORG_CLAUDE / RATE_IP_CLAUDE。
 *
 * Supabase migration: supabase/migrations/0034_rate_limit_counters.sql
 */

import { optionalImport } from "@/lib/security/optional-import";

type Key = string;

interface Bucket {
  tokens: number;
  updated: number;
}

const memoryBuckets = new Map<Key, Bucket>();

export interface RateLimitConfig {
  capacity: number;     // バーストの最大値
  refillPerSec: number; // 毎秒回復するトークン数
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

type SupabaseClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{
    data: Array<{ allowed: boolean; remaining: number; retry_after_sec: number }> | null;
    error: { message: string } | null;
  }>;
};
type SupabaseModule = {
  createClient: (url: string, key: string, opts?: unknown) => SupabaseClient;
};

let cachedClient: SupabaseClient | null | undefined;

async function getServiceClient(): Promise<SupabaseClient | null> {
  if (cachedClient !== undefined) return cachedClient;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    cachedClient = null;
    return null;
  }
  const mod = await optionalImport<SupabaseModule>("@supabase/supabase-js");
  if (!mod) {
    cachedClient = null;
    return null;
  }
  cachedClient = mod.createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return cachedClient;
}

function consumeMemory(key: Key, cfg: RateLimitConfig): RateLimitResult {
  const now = Date.now() / 1000;
  const b = memoryBuckets.get(key) ?? { tokens: cfg.capacity, updated: now };
  const elapsed = Math.max(0, now - b.updated);
  const tokens = Math.min(cfg.capacity, b.tokens + elapsed * cfg.refillPerSec);
  if (tokens < 1) {
    memoryBuckets.set(key, { tokens, updated: now });
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil((1 - tokens) / cfg.refillPerSec)
    };
  }
  memoryBuckets.set(key, { tokens: tokens - 1, updated: now });
  return { allowed: true, remaining: Math.floor(tokens - 1), retryAfterSec: 0 };
}

/**
 * key の bucket から 1 トークン消費。
 * Supabase が利用できる環境では分散原子決済、不可なら memory フォールバック。
 *
 * RATE_LIMIT_DRIVER=memory を指定すると常に memory モードで動かす (テスト用)。
 */
export async function consume(key: Key, cfg: RateLimitConfig): Promise<RateLimitResult> {
  const driver = process.env.RATE_LIMIT_DRIVER ?? "supabase";
  if (driver !== "supabase") return consumeMemory(key, cfg);

  const client = await getServiceClient();
  if (!client) return consumeMemory(key, cfg);

  try {
    const { data, error } = await client.rpc("rate_limit_consume", {
      p_key: key,
      p_capacity: cfg.capacity,
      p_refill: cfg.refillPerSec
    });
    if (error || !data || data.length === 0) {
      // RPC 失敗は fail-open (許可) で memory にもフォールバック記録
      process.stderr.write(
        JSON.stringify({
          at: new Date().toISOString(),
          kind: "rate_limit_rpc_failed",
          message: error?.message ?? "no_rows",
          fallback: "memory"
        }) + "\n"
      );
      return consumeMemory(key, cfg);
    }
    const row = data[0];
    return {
      allowed: row.allowed,
      remaining: row.remaining,
      retryAfterSec: row.retry_after_sec
    };
  } catch (e) {
    // ネットワーク障害等: fail-open
    process.stderr.write(
      JSON.stringify({
        at: new Date().toISOString(),
        kind: "rate_limit_rpc_threw",
        message: e instanceof Error ? e.message : String(e),
        fallback: "memory"
      }) + "\n"
    );
    return consumeMemory(key, cfg);
  }
}

// 既定プリセット
export const RATE_USER_CLAUDE: RateLimitConfig = { capacity: 60, refillPerSec: 60 / 300 };       // 60 / 5min
export const RATE_ORG_CLAUDE: RateLimitConfig  = { capacity: 600, refillPerSec: 600 / 300 };     // 600 / 5min
export const RATE_IP_CLAUDE: RateLimitConfig   = { capacity: 30, refillPerSec: 30 / 60 };        // 30 / 1min
