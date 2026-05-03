/**
 * インメモリ Token Bucket レート制限
 *
 * 注意:
 *   - 単一プロセス前提。本番 (Vercel multi-region / multi-instance) では
 *     Upstash Redis 等に置換する必要がある。
 *   - 落ち着いて移行できるよう、共通インターフェース consume() を提供。
 */

type Key = string;

interface Bucket {
  tokens: number;
  updated: number;
}

const buckets = new Map<Key, Bucket>();

export interface RateLimitConfig {
  capacity: number;     // バーストの最大値
  refillPerSec: number; // 毎秒回復するトークン数
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function consume(key: Key, cfg: RateLimitConfig): RateLimitResult {
  const now = Date.now() / 1000;
  const b = buckets.get(key) ?? { tokens: cfg.capacity, updated: now };
  const elapsed = Math.max(0, now - b.updated);
  const tokens = Math.min(cfg.capacity, b.tokens + elapsed * cfg.refillPerSec);
  if (tokens < 1) {
    buckets.set(key, { tokens, updated: now });
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil((1 - tokens) / cfg.refillPerSec),
    };
  }
  buckets.set(key, { tokens: tokens - 1, updated: now });
  return { allowed: true, remaining: Math.floor(tokens - 1), retryAfterSec: 0 };
}

// 既定プリセット
export const RATE_USER_CLAUDE: RateLimitConfig = { capacity: 60, refillPerSec: 60 / 300 };       // 60 / 5min
export const RATE_ORG_CLAUDE: RateLimitConfig  = { capacity: 600, refillPerSec: 600 / 300 };     // 600 / 5min
export const RATE_IP_CLAUDE: RateLimitConfig   = { capacity: 30, refillPerSec: 30 / 60 };        // 30 / 1min
