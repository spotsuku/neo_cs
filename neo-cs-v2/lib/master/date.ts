// 週次運用で使う日付ユーティリティ
// (旧 lib/mock/weekly.ts から master へ切り出し)
//
// 月曜起点の週範囲計算と W番号付与。TODAY_STR のような固定日付は持たない
// (動的日付は呼び出し側で `new Date()` から算出する)。

export function getWeekRange(weekStart: string): { start: string; end: string; label: string } {
  const d = new Date(weekStart);
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  // W番号は 2026-01-05(W01) を基準
  const baseMonday = new Date("2026-01-05");
  const diffDays = Math.floor(
    (d.getTime() - baseMonday.getTime()) / (1000 * 60 * 60 * 24)
  );
  const weekNo = Math.floor(diffDays / 7) + 1;
  return {
    start: weekStart,
    end: end.toISOString().slice(0, 10),
    label: `W${String(weekNo).padStart(2, "0")}`
  };
}

export function formatWeekRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(s.getMonth() + 1)}/${pad(s.getDate())}〜${pad(e.getMonth() + 1)}/${pad(e.getDate())}`;
}

// 月曜日を日付から計算
export function getMondayOf(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=日 1=月..6=土
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

// 前の週の月曜
export function prevWeek(monday: string): string {
  const d = new Date(monday);
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

// 次の週の月曜
export function nextWeekDate(monday: string): string {
  const d = new Date(monday);
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

// 開始日まで残り日数 (現在時刻基準)
export function daysUntilStart(startDate: string): number {
  const diff = (new Date(startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return Math.ceil(diff);
}

// ─────────────────────────────────────────────
// 旧 lib/mock/weekly.ts の utility を master 経由で再公開
// ※ 元の関数本体は lib/mock/weekly.ts に残るが、app/components からは
//   master 経由でのみアクセスする
// ─────────────────────────────────────────────
export { weeksStuck, CURRENT_WEEK_MONDAY } from "@/lib/mock/weekly";
export type {
  WeeklyReview,
  WeeklyAction,
  WeeklyNextAction
} from "@/lib/mock/weekly";
