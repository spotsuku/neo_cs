/**
 * 縮退運転 (Degraded Mode) スイッチ
 *
 * 依存サービス障害時に AI 機能を強制 skip して手動UIに誘導するための
 * 共通フラグ。環境変数 + メモリキャッシュ (TTL 60s) で評価。
 *
 *   DEGRADED_ANTHROPIC=true → /api/claude は 503 を返し、UI 側は手動入力UIへ
 *   DEGRADED_GMAIL=true     → Gmail 連携は skip し、CSが手動でメモを残す導線
 *
 * /api/health の結果から自動セットする補助関数 markUnhealthy(service) も提供。
 */

type Service = 'anthropic' | 'gmail' | 'supabase';

const TTL_MS = 60_000;
const memo = new Map<Service, { until: number; value: boolean }>();

function envFlag(s: Service): boolean {
  const v = process.env[`DEGRADED_${s.toUpperCase()}`];
  return v === 'true' || v === '1';
}

export function isDegraded(s: Service): boolean {
  if (envFlag(s)) return true;
  const e = memo.get(s);
  if (!e) return false;
  if (e.until < Date.now()) {
    memo.delete(s);
    return false;
  }
  return e.value;
}

export function markUnhealthy(s: Service): void {
  memo.set(s, { until: Date.now() + TTL_MS, value: true });
}

export function markHealthy(s: Service): void {
  memo.delete(s);
}
