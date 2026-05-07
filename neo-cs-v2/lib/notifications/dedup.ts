/**
 * 通知重複防止 — driver 切替型 dedup レイヤ
 *
 * driver:
 *   - memory   : プロセス内 Map (TTL付き)。単一インスタンス前提。テスト/開発用
 *   - supabase : notification_dedup テーブルの主キー (channel, key) 衝突で原子的判定
 *
 * 環境変数 NOTIFICATION_DEDUP_DRIVER で切替 (デフォルト memory)。
 *
 * 使い方 (lib/notifications/slack.ts などから):
 *   const acquired = await acquireDedup({ channel: "slack:churn", key: signalId, ttlSec: 86400 });
 *   if (!acquired) return false; // 既に通知済 (or 取得失敗)
 *   const ok = await postSlack(...);
 *   if (!ok) await releaseDedup({ channel: "slack:churn", key: signalId }); // 再送可能化
 *   return ok;
 *
 * 設計原則:
 *   - "acquire" は **原子的** (Postgres の主キー衝突で UNIQUE 違反 → false 返却)
 *   - 通知失敗時は "release" を呼んで TTL 内でも再送可能にする
 *   - driver 障害時 (Supabase 不通) は **fail-open** で許可 (通知の取りこぼし回避)
 *     → 同期 dedup の代替として、上位の DB 側 notified_at で多重防御
 */

import "server-only";
import { optionalImport } from "@/lib/security/optional-import";

export type DedupDriver = "memory" | "supabase";

export interface DedupKey {
  channel: string;        // 例: "slack:churn", "slack:expansion"
  key: string;            // 例: signalId / opportunityId
  ttlSec?: number;        // デフォルト 24h
}

export interface DedupDriverImpl {
  /** true = 取得成功 (新規通知) / false = 既に存在 (重複) */
  acquire(k: DedupKey): Promise<boolean>;
  /** 通知失敗時の取消 */
  release(channel: string, key: string): Promise<void>;
  /** 期限切れ削除 (cron用)。返り値は削除件数 */
  cleanup(): Promise<number>;
}

const DEFAULT_TTL_SEC = 24 * 60 * 60;

// ─── memory driver ──────────────────────────────────────────────────
const memMemo = new Map<string, number>(); // key=`${channel}:${key}`, value=expiresAtMs

export const memoryDedup: DedupDriverImpl = {
  async acquire({ channel, key, ttlSec = DEFAULT_TTL_SEC }) {
    const fullKey = `${channel}:${key}`;
    const now = Date.now();
    // 期限切れ掃除を inline で
    for (const [k, exp] of memMemo) if (exp < now) memMemo.delete(k);
    if (memMemo.has(fullKey)) return false;
    memMemo.set(fullKey, now + ttlSec * 1000);
    return true;
  },
  async release(channel, key) {
    memMemo.delete(`${channel}:${key}`);
  },
  async cleanup() {
    const now = Date.now();
    let n = 0;
    for (const [k, exp] of memMemo) {
      if (exp < now) {
        memMemo.delete(k);
        n++;
      }
    }
    return n;
  }
};

// テスト用 (memory store の reset)
export function resetMemoryDedupForTesting(): void {
  memMemo.clear();
  if (memoryGcTimer) {
    clearInterval(memoryGcTimer);
    memoryGcTimer = null;
  }
}

/**
 * memory driver の定期 GC タイマー (起動 1 回限り)。
 *
 * acquire() 内でも inline cleanup しているが、長時間 acquire() が呼ばれない
 * シナリオ (低頻度通知 + self-host long-running プロセス) では古い entry が
 * heap に残るため、定期 cleanup を回して memory leak を防ぐ。
 *
 * Vercel serverless はインスタンスが短命なので実質影響なし。
 * テストでは resetMemoryDedupForTesting() でタイマーも止める。
 */
let memoryGcTimer: ReturnType<typeof setInterval> | null = null;
const MEMORY_GC_INTERVAL_MS = 5 * 60 * 1000; // 5分毎

export function startMemoryDedupGc(): void {
  if (memoryGcTimer) return;
  memoryGcTimer = setInterval(() => {
    void memoryDedup.cleanup();
  }, MEMORY_GC_INTERVAL_MS);
  // Node.js の終了を妨げない
  if (typeof memoryGcTimer.unref === "function") memoryGcTimer.unref();
}

// memory driver が選択された場合のみタイマーを起動する。
// supabase 駆動時は Supabase 側の cron (`notification_dedup_cleanup` RPC) で掃除。
if ((process.env.NOTIFICATION_DEDUP_DRIVER ?? "memory") === "memory") {
  startMemoryDedupGc();
}

// ─── supabase driver ────────────────────────────────────────────────
type SupabaseClient = {
  from: (t: string) => {
    insert: (row: Record<string, unknown>) => Promise<{ error: { message: string; code?: string } | null }>;
    delete: () => {
      eq: (col: string, val: string) => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
      };
    };
    rpc?: never;
  };
  rpc: (fn: string) => Promise<{ data: number | null; error: { message: string } | null }>;
};
type SupabaseModule = {
  createClient: (url: string, key: string, opts?: unknown) => SupabaseClient;
};

async function getServiceClient(): Promise<SupabaseClient | null> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const mod = await optionalImport<SupabaseModule>("@supabase/supabase-js");
  if (!mod) return null;
  return mod.createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export const supabaseDedup: DedupDriverImpl = {
  async acquire({ channel, key, ttlSec = DEFAULT_TTL_SEC }) {
    const client = await getServiceClient();
    if (!client) {
      // Supabase 未配線環境 → fail-open (通知させる) + stderr 警告
      process.stderr.write(
        JSON.stringify({
          kind: "dedup_supabase_unavailable",
          time: new Date().toISOString(),
          fallback: "fail_open",
          channel,
          key
        }) + "\n"
      );
      return true;
    }
    const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString();
    const { error } = await client.from("notification_dedup").insert({
      channel,
      key,
      expires_at: expiresAt
    });
    if (!error) return true;
    // PostgreSQL unique_violation = '23505' = 既存と衝突 → 重複
    if (error.code === "23505") return false;
    // それ以外のDBエラー: fail-open (通知失敗より重複1件のほうがマシ)
    process.stderr.write(
      JSON.stringify({
        kind: "dedup_supabase_error",
        time: new Date().toISOString(),
        fallback: "fail_open",
        channel,
        key,
        message: error.message
      }) + "\n"
    );
    return true;
  },
  async release(channel, key) {
    const client = await getServiceClient();
    if (!client) return;
    await client.from("notification_dedup").delete().eq("channel", channel).eq("key", key);
  },
  async cleanup() {
    const client = await getServiceClient();
    if (!client) return 0;
    const { data, error } = await client.rpc("notification_dedup_cleanup");
    if (error) {
      process.stderr.write(
        JSON.stringify({
          kind: "dedup_cleanup_failed",
          time: new Date().toISOString(),
          message: error.message
        }) + "\n"
      );
      return 0;
    }
    return typeof data === "number" ? data : 0;
  }
};

// ─── ファサード ─────────────────────────────────────────────────────

function selectDriver(): DedupDriverImpl {
  const env = (process.env.NOTIFICATION_DEDUP_DRIVER ?? "memory") as DedupDriver;
  return env === "supabase" ? supabaseDedup : memoryDedup;
}

export async function acquireDedup(k: DedupKey): Promise<boolean> {
  return selectDriver().acquire(k);
}
export async function releaseDedup(channel: string, key: string): Promise<void> {
  return selectDriver().release(channel, key);
}
export async function cleanupExpiredDedup(): Promise<number> {
  return selectDriver().cleanup();
}

// driver を直接公開しない: テストでは memoryDedup / supabaseDedup を import して
// driver メソッドを直接叩く形で検証する。
