// 数値・割合のフォーマッタ
// (旧 lib/mock/data.ts から master へ切り出し)

export function yen(n: number): string {
  if (n >= 100_000_000) return `¥${(n / 100_000_000).toFixed(2)}億`;
  if (n >= 10_000) return `¥${(n / 10_000).toFixed(0)}万`;
  return `¥${n.toLocaleString()}`;
}

export function pct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${Math.round(n * 100)}%`;
}

export function nrrFormat(n: number): string {
  return `${Math.round(n * 100)}%`;
}
