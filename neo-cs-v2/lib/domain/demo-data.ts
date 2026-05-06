// デモデータ集計の純関数群
//
// 本番運用開始前のフェーズで投入したダミーを管理 / 一括削除するために
// 必要な「集計」「期間フィルタ」「件数組立」のロジックを純関数で持つ。
// I/O は持たないので unit test から呼べる。
//
// 関連: lib/repository/types.ts CompanyRepo.listDemo / countDemo / wipeDemoData
// 関連: app/settings/demo-data/* で表示・削除UIから呼ばれる

import type { Company } from "@/lib/repository/types";

export type DemoRange = "24h" | "7d" | "all";

export type DemoCounts = {
  /** 抽出された is_demo=true な company の総数 */
  companies: number;
  /** CASCADE で削除される子テーブルの推定件数 */
  contracts: number;
  contacts: number;
  stakeholders: number;
  weeklyReviews: number;
  meetingLogs: number;
  healthSnapshots: number;
  companyTasks: number;
  /** 集計の最終更新時刻 (UI表示用) */
  computedAt: string;
};

export const ZERO_DEMO_COUNTS: DemoCounts = {
  companies: 0,
  contracts: 0,
  contacts: 0,
  stakeholders: 0,
  weeklyReviews: 0,
  meetingLogs: 0,
  healthSnapshots: 0,
  companyTasks: 0,
  computedAt: ""
};

/**
 * createdAt ベースで「直近N時間以内に作成された企業」をフィルタする。
 * @param companies 全 is_demo=true な企業
 * @param range "24h" / "7d" / "all"
 * @param now 現在時刻 (テスト時は固定可能)
 */
export function filterDemoByRange(
  companies: Array<{ id: string; createdAt?: string | null }>,
  range: DemoRange,
  now: Date = new Date()
): Array<{ id: string; createdAt?: string | null }> {
  if (range === "all") return [...companies];
  const hours = range === "24h" ? 24 : 24 * 7;
  const cutoff = now.getTime() - hours * 60 * 60 * 1000;
  return companies.filter((c) => {
    if (!c.createdAt) return false;
    const t = Date.parse(c.createdAt);
    return Number.isFinite(t) && t >= cutoff;
  });
}

/**
 * UIの確認ダイアログで「DELETE-DEMO」と入力させるトークン。
 * 大文字小文字の差を許容しないようリテラルで定義。
 */
export const DEMO_WIPE_CONFIRM_TOKEN = "DELETE-DEMO";

/**
 * 一括削除の実行可否をチェックする純関数。
 *  - confirm が一致しない / 件数 0 / 件数異常に大きい場合はブロック
 */
export function canExecuteWipe(opts: {
  confirmInput: string;
  selectedCount: number;
  hardLimit?: number;
}): { ok: true } | { ok: false; reason: string } {
  if (opts.confirmInput.trim() !== DEMO_WIPE_CONFIRM_TOKEN) {
    return { ok: false, reason: "確認トークンが一致しません" };
  }
  if (opts.selectedCount <= 0) {
    return { ok: false, reason: "削除対象が0件です" };
  }
  const limit = opts.hardLimit ?? 10_000;
  if (opts.selectedCount > limit) {
    return {
      ok: false,
      reason: `対象が ${opts.selectedCount} 件で上限 ${limit} を超えています`
    };
  }
  return { ok: true };
}

/**
 * Company[] から is_demo=true のサブセットを抽出する純関数 (mock driver用)。
 */
export function pickDemoCompanies(companies: Company[]): Company[] {
  return companies.filter((c) => c.isDemo === true);
}

/**
 * 表示用にカテゴリ毎の件数を JSON 整形する。
 */
export function formatDemoCountsForDisplay(c: DemoCounts): Array<{ label: string; value: number }> {
  return [
    { label: "企業", value: c.companies },
    { label: "契約", value: c.contracts },
    { label: "担当窓口", value: c.contacts },
    { label: "ステークホルダー", value: c.stakeholders },
    { label: "週次レビュー", value: c.weeklyReviews },
    { label: "面談ログ", value: c.meetingLogs },
    { label: "健康スナップショット", value: c.healthSnapshots },
    { label: "個社ToDo", value: c.companyTasks }
  ];
}
