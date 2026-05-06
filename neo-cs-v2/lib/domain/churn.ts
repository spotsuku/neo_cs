// 解約予兆検知ロジック (純関数)
//
// 設計原則:
//   - lib/domain/health.ts と同じく副作用なし。Repository を引数で受け取らず、
//     必要なファクトデータ (snapshots / 出席 / 面談 / マイルストン / サーベイ) のみ受ける
//   - mock 時点はオンデマンドで全契約に対し map 実行し、画面表示・通知に使う
//   - Supabase 切替時はサーバー側 cron が同関数を呼んで churn_signals に upsert
//
// 検知ルール:
//   1. score_drop          直近4週で -15pt以上の急落
//   2. score_low_streak    score < 55 が3週以上連続
//   3. consecutive_absence ミーティング欠席 直近2回連続
//   4. milestone_overdue   T-60 を超過し未着手 (status=todo)
//   5. usage_drop          直近4週の活動ペースがベースラインの50%以下
//   6. survey_detractor    最新サーベイ NPS推奨度が 0..6 (detractor)

import type { ProductCode } from "@/lib/mock/data";

export type ChurnSignalRule =
  | "score_drop"
  | "score_low_streak"
  | "consecutive_absence"
  | "milestone_overdue"
  | "usage_drop"
  | "survey_detractor";

export type ChurnSignalSeverity = "low" | "medium" | "high";

export const RULE_LABEL: Record<ChurnSignalRule, string> = {
  score_drop: "Healthスコア急落",
  score_low_streak: "Healthスコア低位継続",
  consecutive_absence: "ミーティング連続欠席",
  milestone_overdue: "更新マイルストン超過",
  usage_drop: "利用頻度低下",
  survey_detractor: "サーベイ批判者(detractor)"
};

export type ChurnSignal = {
  id: string; // contractId + rule で一意
  contractId: string;
  companyId: string;
  product: ProductCode;
  rule: ChurnSignalRule;
  severity: ChurnSignalSeverity;
  weight: number; // 0..100 重み (severity集計に使う)
  reason: string; // 1行説明
  evidence: Record<string, unknown>; // 算出根拠 (delta, asOfList 等)
  detectedAt: string; // ISO
};

export type DetectInput = {
  contractId: string;
  companyId: string;
  product: ProductCode;
  // 直近12週分のスコアスナップショット (asOf 古い順 or 新しい順どちらでもOK)
  snapshots: { asOf: string; score: number }[];
  // 直近のミーティング履歴 (occurredAt 新しい順想定)。 attended=false なら欠席
  recentMeetings: { occurredAt: string; attended: boolean }[];
  // 更新タスク (旧 RenewalMilestone は廃止し、program_company_tasks に統合)
  // 検知ルール milestone_overdue は category=renewal_* のタスクから派生する想定
  // 互換のため引数自体は維持し、空配列で渡せばこのルールはスキップされる
  milestones: {
    type: "T-120" | "T-90" | "T-60" | "T-30";
    dueDate: string;
    status: "pending" | "in_progress" | "todo" | "done" | "skipped";
  }[];
  // 直近4週の活動件数 vs ベースライン (12週平均)
  activityRecent: number;
  activityBaseline: number;
  // 最新サーベイの NPS スコア (0..10)。未取得は undefined
  latestNpsScore?: number;
  asOf?: string; // 検知時刻 (テスト用にinjectable)
};

const SEVERITY_BY_RULE: Record<ChurnSignalRule, ChurnSignalSeverity> = {
  score_drop: "high",
  score_low_streak: "high",
  consecutive_absence: "medium",
  milestone_overdue: "high",
  usage_drop: "medium",
  survey_detractor: "medium"
};

const WEIGHT_BY_RULE: Record<ChurnSignalRule, number> = {
  score_drop: 35,
  score_low_streak: 30,
  consecutive_absence: 20,
  milestone_overdue: 25,
  usage_drop: 15,
  survey_detractor: 20
};

function severityRank(s: ChurnSignalSeverity): number {
  return s === "high" ? 3 : s === "medium" ? 2 : 1;
}

export function compareSeverity(a: ChurnSignalSeverity, b: ChurnSignalSeverity): number {
  return severityRank(b) - severityRank(a);
}

// ── 個別ルール ────────────────────────────────────────────────────

function ruleScoreDrop(input: DetectInput): Omit<ChurnSignal, "id" | "contractId" | "companyId" | "product" | "detectedAt"> | null {
  const sorted = [...input.snapshots].sort((a, b) => a.asOf.localeCompare(b.asOf));
  if (sorted.length < 5) return null;
  const recent = sorted[sorted.length - 1];
  // 4週前 (= 末尾から5番目)
  const fourWeeksAgo = sorted[sorted.length - 5];
  const delta = recent.score - fourWeeksAgo.score;
  if (delta <= -15) {
    return {
      rule: "score_drop",
      severity: SEVERITY_BY_RULE.score_drop,
      weight: WEIGHT_BY_RULE.score_drop,
      reason: `直近4週で Healthスコアが ${Math.abs(delta)} ポイント急落 (${fourWeeksAgo.score} → ${recent.score})`,
      evidence: {
        deltaPoints: delta,
        from: { asOf: fourWeeksAgo.asOf, score: fourWeeksAgo.score },
        to: { asOf: recent.asOf, score: recent.score }
      }
    };
  }
  return null;
}

function ruleScoreLowStreak(input: DetectInput): Omit<ChurnSignal, "id" | "contractId" | "companyId" | "product" | "detectedAt"> | null {
  const sorted = [...input.snapshots].sort((a, b) => a.asOf.localeCompare(b.asOf));
  if (sorted.length < 3) return null;
  const last3 = sorted.slice(-3);
  if (last3.every((s) => s.score < 55)) {
    return {
      rule: "score_low_streak",
      severity: SEVERITY_BY_RULE.score_low_streak,
      weight: WEIGHT_BY_RULE.score_low_streak,
      reason: `Healthスコア 55 未満が 3週連続 (${last3.map((s) => s.score).join(" → ")})`,
      evidence: {
        weeks: last3.map((s) => ({ asOf: s.asOf, score: s.score }))
      }
    };
  }
  return null;
}

function ruleConsecutiveAbsence(input: DetectInput): Omit<ChurnSignal, "id" | "contractId" | "companyId" | "product" | "detectedAt"> | null {
  const sorted = [...input.recentMeetings].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  if (sorted.length < 2) return null;
  const last2 = sorted.slice(0, 2);
  if (last2.every((m) => !m.attended)) {
    return {
      rule: "consecutive_absence",
      severity: SEVERITY_BY_RULE.consecutive_absence,
      weight: WEIGHT_BY_RULE.consecutive_absence,
      reason: "直近2回のミーティングが連続欠席",
      evidence: { absentMeetings: last2 }
    };
  }
  return null;
}

function ruleMilestoneOverdue(input: DetectInput): Omit<ChurnSignal, "id" | "contractId" | "companyId" | "product" | "detectedAt"> | null {
  const today = (input.asOf ?? new Date().toISOString()).slice(0, 10);
  const t60 = input.milestones.find((m) => m.type === "T-60");
  if (!t60) return null;
  // G項以降: status は "pending" | "in_progress" のいずれかが「未着手扱い」。
  // 旧 "todo" も後方互換のため未着手扱いにする。
  const isUnclosed = t60.status === "pending" || t60.status === "in_progress" || t60.status === "todo";
  if (!isUnclosed) return null;
  if (t60.dueDate >= today) return null;
  return {
    rule: "milestone_overdue",
    severity: SEVERITY_BY_RULE.milestone_overdue,
    weight: WEIGHT_BY_RULE.milestone_overdue,
    reason: `更新マイルストン T-60 の期日 (${t60.dueDate}) を超過、未着手`,
    evidence: { milestone: t60, today }
  };
}

function ruleUsageDrop(input: DetectInput): Omit<ChurnSignal, "id" | "contractId" | "companyId" | "product" | "detectedAt"> | null {
  if (input.activityBaseline <= 0) return null;
  const ratio = input.activityRecent / input.activityBaseline;
  if (ratio <= 0.5) {
    return {
      rule: "usage_drop",
      severity: SEVERITY_BY_RULE.usage_drop,
      weight: WEIGHT_BY_RULE.usage_drop,
      reason: `利用頻度がベースラインの ${Math.round(ratio * 100)}% に低下 (${input.activityRecent} vs ${input.activityBaseline})`,
      evidence: {
        recent: input.activityRecent,
        baseline: input.activityBaseline,
        ratio
      }
    };
  }
  return null;
}

function ruleSurveyDetractor(input: DetectInput): Omit<ChurnSignal, "id" | "contractId" | "companyId" | "product" | "detectedAt"> | null {
  if (input.latestNpsScore === undefined) return null;
  if (input.latestNpsScore > 6) return null;
  return {
    rule: "survey_detractor",
    severity: SEVERITY_BY_RULE.survey_detractor,
    weight: WEIGHT_BY_RULE.survey_detractor,
    reason: `最新サーベイの推奨度が detractor (${input.latestNpsScore}/10)`,
    evidence: { npsScore: input.latestNpsScore }
  };
}

// ── 公開関数 ──────────────────────────────────────────────────────

export function detectChurnSignals(input: DetectInput): ChurnSignal[] {
  const detectedAt = input.asOf ?? new Date().toISOString();
  const candidates = [
    ruleScoreDrop(input),
    ruleScoreLowStreak(input),
    ruleConsecutiveAbsence(input),
    ruleMilestoneOverdue(input),
    ruleUsageDrop(input),
    ruleSurveyDetractor(input)
  ];
  return candidates
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .map((c) => ({
      ...c,
      id: `cs-${input.contractId}-${c.rule}`,
      contractId: input.contractId,
      companyId: input.companyId,
      product: input.product,
      detectedAt
    }));
}

/** 契約全体のリスクスコア集計 (高いほど危険) */
export function aggregateContractRisk(signals: ChurnSignal[]): {
  totalWeight: number;
  topSeverity: ChurnSignalSeverity | null;
} {
  if (signals.length === 0) return { totalWeight: 0, topSeverity: null };
  const totalWeight = Math.min(100, signals.reduce((s, x) => s + x.weight, 0));
  const topSeverity = [...signals].sort((a, b) => compareSeverity(a.severity, b.severity))[0]
    .severity;
  return { totalWeight, topSeverity };
}
