// 数値表示ユーティリティ (副作用なし、純関数)
//
// lib/mock/data.ts に置かれていた表示ヘルパを切り出した正規 import 元。
// Server Component / Client Component / Server Action から自由に使える。

/** 円 (大きさで単位を切替: 億 / 万 / 円) */
export function yen(n: number): string {
  if (n >= 100_000_000) return `¥${(n / 100_000_000).toFixed(2)}億`;
  if (n >= 10_000) return `¥${(n / 10_000).toFixed(0)}万`;
  return `¥${n.toLocaleString()}`;
}

/** 0..1 を整数 % で。null/undefined は "—" */
export function pct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${Math.round(n * 100)}%`;
}

/** NRR 表示。実体は pct と同じだが意味的な明示のため別関数で残す */
export function nrrFormat(n: number): string {
  return `${Math.round(n * 100)}%`;
}
