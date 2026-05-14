// 業務 ToDo (company_tasks) の純関数群
//
// 設計原則:
//   - 副作用なし。Repository を取らない
//   - 期日判定 / 状態遷移チェック / 優先度ソート など UI/サーバ共用ロジック
//
// マイグレーション: supabase/migrations/0014_company_tasks.sql

export type CompanyTaskStatus =
  | "pending"
  | "in_progress"
  | "done"
  | "skipped"
  | "cancelled";

export type CompanyTaskPriority = "low" | "med" | "high" | "urgent";

export type CompanyTaskCategory =
  | "meeting_schedule"
  | "document_check"
  | "material_send"
  | "followup"
  | "other";

export const TASK_CATEGORY_LABEL: Record<CompanyTaskCategory, string> = {
  meeting_schedule: "面談日程",
  document_check: "提出物確認",
  material_send: "資料送付",
  followup: "フォローアップ",
  other: "その他"
};

export const TASK_STATUS_LABEL: Record<CompanyTaskStatus, string> = {
  pending: "未着手",
  in_progress: "進行中",
  done: "完了",
  skipped: "スキップ",
  cancelled: "取消"
};

export const TASK_PRIORITY_LABEL: Record<CompanyTaskPriority, string> = {
  urgent: "緊急",
  high: "高",
  med: "中",
  low: "低"
};

const PRIORITY_RANK: Record<CompanyTaskPriority, number> = {
  urgent: 4,
  high: 3,
  med: 2,
  low: 1
};

/**
 * 期日切れ判定 (today を YYYY-MM-DD で受ける)
 * - dueDate < today かつ未完了 (pending/in_progress) のとき true
 */
export function isOverdue(
  task: { status: CompanyTaskStatus; dueDate?: string | null },
  today: string
): boolean {
  if (!task.dueDate) return false;
  if (task.status !== "pending" && task.status !== "in_progress") return false;
  return task.dueDate < today;
}

/** 「期日が今日以前」 (期日切れ含む) を未完了タスクで判定 */
export function isDueByToday(
  task: { status: CompanyTaskStatus; dueDate?: string | null },
  today: string
): boolean {
  if (!task.dueDate) return false;
  if (task.status !== "pending" && task.status !== "in_progress") return false;
  return task.dueDate <= today;
}

/** 「期日が今週末まで」を未完了タスクで判定。weekEnd は YYYY-MM-DD */
export function isDueByWeekEnd(
  task: { status: CompanyTaskStatus; dueDate?: string | null },
  weekEnd: string
): boolean {
  if (!task.dueDate) return false;
  if (task.status !== "pending" && task.status !== "in_progress") return false;
  return task.dueDate <= weekEnd;
}

/**
 * 状態遷移可否
 * - pending  → in_progress / done / skipped / cancelled
 * - in_progress → done / skipped / cancelled / pending
 * - done     → (再open) pending のみ
 * - skipped / cancelled → pending のみ (再開)
 */
export function canTransition(
  from: CompanyTaskStatus,
  to: CompanyTaskStatus
): boolean {
  if (from === to) return false;
  switch (from) {
    case "pending":
      return ["in_progress", "done", "skipped", "cancelled"].includes(to);
    case "in_progress":
      return ["pending", "done", "skipped", "cancelled"].includes(to);
    case "done":
    case "skipped":
    case "cancelled":
      return to === "pending";
    default:
      return false;
  }
}

/**
 * 期日近い順 + 同期日内では priority 高い順、期日無しは末尾
 */
export function sortByDueAsc<
  T extends { dueDate?: string | null; priority: CompanyTaskPriority }
>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    if (a.dueDate && b.dueDate) {
      if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    } else if (a.dueDate) {
      return -1;
    } else if (b.dueDate) {
      return 1;
    }
    return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
  });
}

/** YYYY-MM-DD の今週末 (土曜) を返す簡易ヘルパ (UI のフィルタ用) */
export function endOfWeek(today: string): string {
  // today: YYYY-MM-DD
  const d = new Date(today + "T00:00:00Z");
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const add = (6 - day + 7) % 7; // 次の土曜まで
  d.setUTCDate(d.getUTCDate() + add);
  return d.toISOString().slice(0, 10);
}
