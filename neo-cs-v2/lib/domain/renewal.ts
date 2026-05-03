// 更新マイルストン状態遷移ロジック (純関数 — health/churn/kpi/expansion と同じ設計)
//
// 設計原則:
//   - status 遷移、overdue 派生判定、進捗率算出を集約
//   - cycles.ts は型と spec のみ。ロジックは本ファイル
//
// status 遷移ルール:
//   pending → in_progress (担当者が着手)
//   pending → done         (証跡 evidence 必須)
//   pending → skipped      (理由 skippedReason 必須)
//   in_progress → done     (証跡必須)
//   in_progress → skipped  (理由必須)
//   done → done            (再完了は idempotent)
//   skipped → skipped      (idempotent)
//   done/skipped → pending は禁止 (誤操作防止。やり直したい場合は新マイルストン作成)
//
// reviews/02_CS責任者.md 指摘の「日付経過で自動done」は本ファイルでも一切やらない。
// overdue は表示用の派生であり、status を変更しない。

import type {
  RenewalMilestone,
  RenewalMilestoneStatus,
  RenewalMilestoneEvidence
} from "@/lib/mock/cycles";

export type Transition =
  | { kind: "to_in_progress" }
  | { kind: "to_done"; completedBy: string; evidence: RenewalMilestoneEvidence; completedAt?: string }
  | { kind: "to_skipped"; skippedReason: string; skippedAt?: string };

export type TransitionResult =
  | { ok: true; next: RenewalMilestone }
  | { ok: false; error: string };

const ALLOWED_FROM: Record<RenewalMilestoneStatus, RenewalMilestoneStatus[]> = {
  pending: ["pending", "in_progress", "done", "skipped"],
  in_progress: ["in_progress", "done", "skipped"],
  done: ["done"],
  skipped: ["skipped"]
};

/** 状態遷移を適用する純関数。invalid なら ok=false を返す */
export function transitionMilestone(
  current: RenewalMilestone,
  t: Transition
): TransitionResult {
  const targetStatus: RenewalMilestoneStatus =
    t.kind === "to_in_progress" ? "in_progress" : t.kind === "to_done" ? "done" : "skipped";

  if (!ALLOWED_FROM[current.status].includes(targetStatus)) {
    return {
      ok: false,
      error: `状態 ${current.status} から ${targetStatus} への遷移は許可されていません`
    };
  }

  if (t.kind === "to_done") {
    const hasEvidence = (t.evidence.note?.trim() || t.evidence.attachmentUrl?.trim()) ?? false;
    if (!hasEvidence) {
      return { ok: false, error: "完了マークには証跡 (note または attachmentUrl) が必要です" };
    }
    if (!t.completedBy) {
      return { ok: false, error: "完了者 (completedBy) が必須です" };
    }
    return {
      ok: true,
      next: {
        ...current,
        status: "done",
        completedBy: t.completedBy,
        completedAt: t.completedAt ?? new Date().toISOString(),
        evidence: { ...t.evidence }
      }
    };
  }

  if (t.kind === "to_skipped") {
    if (!t.skippedReason.trim()) {
      return { ok: false, error: "スキップには理由 (skippedReason) が必須です" };
    }
    return {
      ok: true,
      next: {
        ...current,
        status: "skipped",
        skippedReason: t.skippedReason,
        completedAt: t.skippedAt ?? new Date().toISOString()
      }
    };
  }

  // to_in_progress
  return {
    ok: true,
    next: { ...current, status: "in_progress" }
  };
}

/** 日付超過 (status=pending|in_progress AND dueDate < today) — 派生のみ */
export function isOverdue(m: RenewalMilestone, today: string): boolean {
  if (m.status === "done" || m.status === "skipped") return false;
  return m.dueDate < today;
}

/** 進捗率: done + skipped を完了扱いとして 0..1 を返す */
export function progressRate(milestones: RenewalMilestone[]): number {
  if (milestones.length === 0) return 0;
  const closed = milestones.filter((m) => m.status === "done" || m.status === "skipped").length;
  return closed / milestones.length;
}

/** 表示用ラベル */
export const STATUS_LABEL: Record<RenewalMilestoneStatus, string> = {
  pending: "未着手",
  in_progress: "対応中",
  done: "完了",
  skipped: "スキップ"
};

export type DerivedDisplayState = "pending" | "in_progress" | "overdue" | "done" | "skipped";

/** UI 表示用の派生状態 (overdue を含む) */
export function displayState(m: RenewalMilestone, today: string): DerivedDisplayState {
  if (m.status === "done") return "done";
  if (m.status === "skipped") return "skipped";
  if (isOverdue(m, today)) return "overdue";
  return m.status; // pending or in_progress
}
