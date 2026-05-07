// ISO 週開始日 (月曜) ヘルパ
//
// lib/mock/weekly.ts の `CURRENT_WEEK_MONDAY` は固定日 (TODAY_STR='2026-04-24')
// から計算された定数で、本番運用すると毎週同じ結果になってしまうため、
// サーバ側で実時刻から動的に算出する用途で本ファイルを用意する。
//
// API:
//   getWeekMondayISO(d?)   d (Date | ISO string) を含む週の月曜を ISO ("YYYY-MM-DD") で返す。
//   currentWeekMondayISO() 「今」(=サーバ時刻) を含む週の月曜を返す。
//
// タイムゾーン:
//   ISO 文字列 (YYYY-MM-DD) を引数に取る場合は UTC として扱う。
//   Date オブジェクト or 引数なしの場合は実行環境のタイムゾーン (Vercel は UTC)。
//   業務上の「週」は JST だが、月曜判定だけなら UTC でズレない (JST の週またぎは
//   月曜 0:00 JST = 月曜 -9h UTC = 日曜 15:00 UTC で、UTC ベースで「日曜」になる)。
//   厳密に JST で判定したい場合は ISO 文字列を JST で生成して渡すこと。

export function getWeekMondayISO(input: Date | string = new Date()): string {
  const d = typeof input === "string" ? new Date(input) : new Date(input.getTime());
  const day = d.getUTCDay(); // 0=日 1=月..6=土 (UTC基準)
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function currentWeekMondayISO(): string {
  return getWeekMondayISO(new Date());
}
