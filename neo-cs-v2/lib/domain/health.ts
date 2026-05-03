// Health Score 算出ロジック (純関数)
//
// 設計原則:
//   - 副作用なし。Repository を引数で受け取らず、必要なファクトデータのみ受ける
//   - Supabase 切替時はサーバー側日次バッチが同関数を呼ぶ
//   - factor → score → color の順 (score → color の逆算は廃止)
//
// 因子と寄与度 (合計100):
//   1. attendance (出席率)              重み 25
//   2. weeksSinceLastTouch (接点鮮度)   重み 20
//   3. overdueOnboardingTasks (期日超過) 重み 20
//   4. negativeSignalCount (ネガ件数)   重み 20
//   5. milestoneProgress (更新進捗)      重み 15
//
// 各 factor は 0..100 にスケール。重み付き加算で総合スコアを算出。
// 閾値: green ≥ 75, yellow ≥ 55, red < 55

import type { Contract } from "@/lib/mock/contracts";
import type { ProductCode } from "@/lib/mock/data";

export type HealthColor = "green" | "yellow" | "red";

export type HealthFactorKey =
  | "attendance"
  | "weeksSinceLastTouch"
  | "overdueOnboardingTasks"
  | "negativeSignalCount"
  | "milestoneProgress";

export type HealthFactors = {
  attendance?: number; // 0..1 (出席率)
  weeksSinceLastTouch?: number; // 週数 (大きいほど悪い)
  overdueOnboardingTasks?: number; // 件数
  negativeSignalCount?: number; // 件数
  milestoneProgress?: number; // 0..1 (T-120/90/60/30 の done 比率)
};

export type FactorContribution = {
  key: HealthFactorKey;
  label: string;
  rawValue: number; // 入力値 (例: 0.85, 4週, 3件 等)
  rawDisplay: string; // 画面表示用 (例: "85%", "4週", "3件")
  normalizedScore: number; // 0..100 (悪い=0, 良い=100)
  weight: number; // 重み (合計100)
  weightedScore: number; // normalized × weight / 100
  tone: "positive" | "neutral" | "negative";
  hint: string; // どう解釈すべきかの短い説明
};

export type HealthBreakdown = {
  score: number; // 0..100
  color: HealthColor;
  contributions: FactorContribution[];
  topNegative: FactorContribution | null;
  computedAt: string;
};

const FACTOR_WEIGHTS: Record<HealthFactorKey, number> = {
  attendance: 25,
  weeksSinceLastTouch: 20,
  overdueOnboardingTasks: 20,
  negativeSignalCount: 20,
  milestoneProgress: 15
};

const FACTOR_LABEL: Record<HealthFactorKey, string> = {
  attendance: "出席率",
  weeksSinceLastTouch: "最終接点",
  overdueOnboardingTasks: "オンボ期日超過",
  negativeSignalCount: "ネガティブシグナル",
  milestoneProgress: "更新マイルストーン"
};

// ── 各 factor の正規化関数 (低いほど悪い 0、高いほど良い 100) ──

function normAttendance(rate: number | undefined): number {
  if (rate === undefined || !Number.isFinite(rate)) return 70; // 未取得は中立
  // 0.95+ → 100, 0.85 → 85, 0.7 → 60, 0.5 → 30
  return Math.max(0, Math.min(100, rate * 100));
}

function normWeeksSince(weeks: number | undefined): number {
  if (weeks === undefined || !Number.isFinite(weeks)) return 70;
  // 0週=100, 1週=95, 2週=80, 4週=50, 8週=10, 12週+=0
  if (weeks <= 0) return 100;
  if (weeks <= 1) return 95;
  if (weeks <= 2) return 80;
  if (weeks <= 4) return 50;
  if (weeks <= 8) return 20;
  return 0;
}

function normOverdueTasks(count: number | undefined): number {
  if (count === undefined || !Number.isFinite(count)) return 80;
  // 0件=100, 1件=80, 2件=60, 3件=40, 5件+=0
  if (count <= 0) return 100;
  if (count === 1) return 80;
  if (count === 2) return 60;
  if (count === 3) return 40;
  if (count === 4) return 20;
  return 0;
}

function normNegativeSignals(count: number | undefined): number {
  if (count === undefined || !Number.isFinite(count)) return 80;
  if (count <= 0) return 100;
  if (count === 1) return 75;
  if (count === 2) return 50;
  if (count === 3) return 25;
  return 0;
}

function normMilestoneProgress(progress: number | undefined): number {
  if (progress === undefined || !Number.isFinite(progress)) return 70;
  // 0..1 → 0..100
  return Math.max(0, Math.min(100, progress * 100));
}

function toneOf(normalized: number): "positive" | "neutral" | "negative" {
  if (normalized >= 75) return "positive";
  if (normalized >= 50) return "neutral";
  return "negative";
}

function display(key: HealthFactorKey, raw: number | undefined): string {
  if (raw === undefined || !Number.isFinite(raw)) return "—";
  switch (key) {
    case "attendance":
      return `${Math.round(raw * 100)}%`;
    case "weeksSinceLastTouch":
      return `${raw}週前`;
    case "overdueOnboardingTasks":
      return `${raw}件`;
    case "negativeSignalCount":
      return `${raw}件`;
    case "milestoneProgress":
      return `${Math.round(raw * 100)}%`;
  }
}

function hintOf(key: HealthFactorKey, normalized: number): string {
  const bad = normalized < 50;
  switch (key) {
    case "attendance":
      return bad ? "出席が落ち込んでいる。原因把握とフォロー要" : "良好な出席率";
    case "weeksSinceLastTouch":
      return bad ? "接点が空きすぎ。即座に連絡を" : "接点は維持できている";
    case "overdueOnboardingTasks":
      return bad ? "期日超過タスクが滞留" : "期日内に進行";
    case "negativeSignalCount":
      return bad ? "ネガティブな発言・離脱兆候あり" : "ネガティブシグナルなし";
    case "milestoneProgress":
      return bad ? "更新マイルストーン消化が遅延" : "更新進捗は順調";
  }
}

export function computeHealthScore(
  factors: HealthFactors,
  computedAt = new Date().toISOString()
): HealthBreakdown {
  const norms: Record<HealthFactorKey, number> = {
    attendance: normAttendance(factors.attendance),
    weeksSinceLastTouch: normWeeksSince(factors.weeksSinceLastTouch),
    overdueOnboardingTasks: normOverdueTasks(factors.overdueOnboardingTasks),
    negativeSignalCount: normNegativeSignals(factors.negativeSignalCount),
    milestoneProgress: normMilestoneProgress(factors.milestoneProgress)
  };

  const contributions: FactorContribution[] = (Object.keys(FACTOR_WEIGHTS) as HealthFactorKey[]).map(
    (key) => {
      const raw =
        key === "attendance"
          ? factors.attendance
          : key === "weeksSinceLastTouch"
          ? factors.weeksSinceLastTouch
          : key === "overdueOnboardingTasks"
          ? factors.overdueOnboardingTasks
          : key === "negativeSignalCount"
          ? factors.negativeSignalCount
          : factors.milestoneProgress;
      const normalized = norms[key];
      const weight = FACTOR_WEIGHTS[key];
      return {
        key,
        label: FACTOR_LABEL[key],
        rawValue: raw ?? Number.NaN,
        rawDisplay: display(key, raw),
        normalizedScore: Math.round(normalized),
        weight,
        weightedScore: Math.round((normalized * weight) / 100),
        tone: toneOf(normalized),
        hint: hintOf(key, normalized)
      };
    }
  );

  const score = Math.round(
    contributions.reduce((sum, c) => sum + (c.normalizedScore * c.weight) / 100, 0)
  );

  const color: HealthColor = score >= 75 ? "green" : score >= 55 ? "yellow" : "red";

  // ネガティブで重みの大きい順 (寄与の "失われ方" が大きいもの)
  const lossSorted = [...contributions]
    .filter((c) => c.normalizedScore < 75)
    .sort((a, b) => {
      const lossA = ((100 - a.normalizedScore) * a.weight) / 100;
      const lossB = ((100 - b.normalizedScore) * b.weight) / 100;
      return lossB - lossA;
    });
  const topNegative = lossSorted[0] ?? null;

  return {
    score,
    color,
    contributions,
    topNegative,
    computedAt
  };
}

// ────────────────────────────────────────────────────────────
// Mock 用: 契約から決定論的に factor を生成
// 実データが来るまでの間、UIで factor を見せられるようにする
// 既存の Contract.healthScore.color を入力にして "らしい" factor を逆算する
// ────────────────────────────────────────────────────────────

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function deriveMockFactors(args: {
  contractId: string;
  product: ProductCode;
  baselineColor?: HealthColor;
  endDate?: string;
  asOf?: string;
}): HealthFactors {
  const seed = hashSeed(args.contractId);
  const baseline = args.baselineColor ?? "green";

  // 色から平均的な水準を選び、seed で揺らぎを与える
  // green: attendance 0.88-0.96, weeks 0-1, overdue 0, neg 0, ms 0.7-0.95
  // yellow: attendance 0.7-0.85, weeks 2-3, overdue 1-2, neg 1, ms 0.4-0.7
  // red: attendance 0.4-0.65, weeks 4-8, overdue 3-5, neg 2-4, ms 0.0-0.35

  const r1 = (seed % 100) / 100; // 0..1
  const r2 = ((seed >> 7) % 100) / 100;
  const r3 = ((seed >> 13) % 100) / 100;
  const r4 = ((seed >> 19) % 100) / 100;
  const r5 = ((seed >> 23) % 100) / 100;

  if (baseline === "green") {
    return {
      attendance: 0.88 + r1 * 0.08,
      weeksSinceLastTouch: r2 < 0.5 ? 0 : 1,
      overdueOnboardingTasks: 0,
      negativeSignalCount: r3 < 0.85 ? 0 : 1,
      milestoneProgress: 0.7 + r4 * 0.25
    };
  }
  if (baseline === "yellow") {
    return {
      attendance: 0.7 + r1 * 0.15,
      weeksSinceLastTouch: 2 + Math.floor(r2 * 2),
      overdueOnboardingTasks: r3 < 0.5 ? 1 : 2,
      negativeSignalCount: r4 < 0.7 ? 1 : 2,
      milestoneProgress: 0.4 + r5 * 0.3
    };
  }
  // red
  return {
    attendance: 0.4 + r1 * 0.25,
    weeksSinceLastTouch: 4 + Math.floor(r2 * 5),
    overdueOnboardingTasks: 3 + Math.floor(r3 * 3),
    negativeSignalCount: 2 + Math.floor(r4 * 3),
    milestoneProgress: r5 * 0.35
  };
}

export function computeFromContract(c: Contract, asOf?: string): HealthBreakdown {
  const factors = deriveMockFactors({
    contractId: c.id,
    product: c.product,
    baselineColor: c.healthScore?.color,
    endDate: c.endDate,
    asOf
  });
  return computeHealthScore(factors, asOf ? `${asOf}T00:00:00Z` : undefined);
}

export function colorScore(color: HealthColor | undefined): number | null {
  if (color === "green") return 85;
  if (color === "yellow") return 65;
  if (color === "red") return 40;
  return null;
}

export function colorOfScore(score: number): HealthColor {
  if (score >= 75) return "green";
  if (score >= 55) return "yellow";
  return "red";
}
