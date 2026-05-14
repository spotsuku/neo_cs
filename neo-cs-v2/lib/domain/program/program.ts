// 事業内ToDo (program_*) の純関数群
//
// 設計原則:
//   - 副作用なし。Repository を取らない
//   - スコープ判定 / 進捗集計 / オーバーデュー判定など UI/サーバ共用ロジック
//
// マイグレーション: supabase/migrations/0020_program_tasks.sql

export type ProgramCellStatus =
  | "pending"
  | "in_progress"
  | "done"
  | "not_applicable"
  | "skipped";

export type ProgramTermStatus = "draft" | "active" | "closed" | "archived";

export type ProgramTaskCategory =
  | "meeting_schedule"
  | "invite_send"
  | "meeting_hold"
  | "document_check"
  | "material_send"
  | "followup"
  | "other";

export const PROGRAM_TASK_CATEGORY_LABEL: Record<ProgramTaskCategory, string> = {
  meeting_schedule: "日程調整",
  invite_send: "招待送付",
  meeting_hold: "面談実施",
  document_check: "提出物確認",
  material_send: "資料送付",
  followup: "フォローアップ",
  other: "その他"
};

export const PROGRAM_CELL_STATUS_LABEL: Record<ProgramCellStatus, string> = {
  pending: "未着手",
  in_progress: "進行中",
  done: "完了",
  not_applicable: "実施必要なし",
  skipped: "スキップ"
};

export const PROGRAM_TERM_STATUS_LABEL: Record<ProgramTermStatus, string> = {
  draft: "下書き",
  active: "進行中",
  closed: "クローズ",
  archived: "アーカイブ"
};

export type ProgramScope = {
  productCode: string;
  courseKey?: string | null;
  cycleNo?: number | null;
};

// 与えられた契約 (product/course/cycle) が term のスコープにマッチするか
export function contractMatchesScope(
  contract: { product: string; courseKey?: string | null; cycleNumber?: number | null },
  scope: ProgramScope
): boolean {
  if (contract.product !== scope.productCode) return false;
  if (scope.courseKey != null && contract.courseKey !== scope.courseKey) return false;
  if (scope.cycleNo != null && contract.cycleNumber !== scope.cycleNo) return false;
  return true;
}

export function scopeLabel(scope: ProgramScope, productLabel: string, courseLabel?: string): string {
  const parts: string[] = [productLabel];
  if (scope.courseKey && courseLabel) parts.push(courseLabel);
  if (scope.cycleNo != null) parts.push(`第${scope.cycleNo}期`);
  return parts.join(" / ");
}

export function isOpenStatus(s: ProgramCellStatus): boolean {
  return s === "pending" || s === "in_progress";
}

export function isOverdueCell(
  cell: { status: ProgramCellStatus; dueDate?: string | null },
  today: string
): boolean {
  if (!isOpenStatus(cell.status)) return false;
  if (!cell.dueDate) return false;
  return cell.dueDate < today;
}

export type ProgressSummary = {
  total: number;
  done: number;
  open: number;
  overdue: number;
  pct: number;
};

export function summarizeProgress(
  cells: { status: ProgramCellStatus; dueDate?: string | null }[],
  today: string
): ProgressSummary {
  let done = 0;
  let open = 0;
  let overdue = 0;
  let applicable = 0;
  for (const c of cells) {
    // 「実施必要なし」は分母から除外
    if (c.status === "not_applicable") continue;
    applicable++;
    if (c.status === "done") done++;
    if (isOpenStatus(c.status)) open++;
    if (isOverdueCell(c, today)) overdue++;
  }
  const pct = applicable === 0 ? 0 : Math.round((done / applicable) * 100);
  return { total: applicable, done, open, overdue, pct };
}
