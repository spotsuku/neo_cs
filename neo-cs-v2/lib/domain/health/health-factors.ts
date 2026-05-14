// 実シグナルから Health Score の factor を導出する (副作用あり版)
//
// lib/domain/health.ts は純関数で normalizer / score 算出のみを提供する。
// こちらは Repository 経由で attendance / meeting / onboarding / churn / journey
// の各テーブルを引き、HealthFactors を組み立てる。日次バッチ
// (api/cron/health-snapshots) から呼ばれる前提。
//
// 旧 deriveMockFactors (mock の baselineColor からの擬似生成) を置き換える Phase B
// の実装。各シグナルが取得不可・空の場合は対応 factor を undefined にして
// computeHealthScore 側で「中立 (70点) 扱い」に流す。

import type { Repository } from "@/lib/repository/types";
import type { Contract } from "@/lib/repository/types";
import type { HealthFactors } from "./health";
import { DEFAULT_ORG_ID } from "@/lib/repository/types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** weeksSinceLastTouch の算出で読み込む meeting_logs の上限。
 *  契約 product (or "cross") に絞り込む前のサンプル数。同一企業に複数事業が
 *  ある場合は他事業のログが混在するため、product フィルタ後に直近の 1 件を
 *  選ぶ。100 件あれば現実的な顧客接点は十分カバーできる。 */
const MEETING_FETCH_LIMIT = 100;

export type DeriveFactorsArgs = {
  contract: Contract;
  /** 評価基準日 YYYY-MM-DD (例: cron 実行日) */
  asOf: string;
};

/**
 * 契約に紐づく実シグナルを集計して HealthFactors を返す。
 *
 * 各 factor のソース:
 *   - attendance:              attendance_events の status="present"|"late" 比率
 *   - weeksSinceLastTouch:     meeting_logs (会社単位) のうち
 *                              product=contract.product or "cross" に絞った
 *                              直近 1 件と asOf の差を週数化
 *   - overdueOnboardingTasks:  onboarding_tasks のうち done/not_applicable 以外で
 *                              dueDate < asOf のもの
 *   - negativeSignalCount:     churn_signals (未解決) のうち severity が high/medium
 *   - milestoneProgress:       business journey の現ステージ以前の checkpoint done 比率
 *                              (現ステージが取得できない場合は全 checkpoint 横断)
 *
 * シグナルが空 / 取得失敗の factor は undefined を返し、normalize 側で中立扱い
 * (70点) に丸められる。
 */
export async function deriveFactorsFromSignals(
  repo: Repository,
  { contract, asOf }: DeriveFactorsArgs
): Promise<HealthFactors> {
  const orgId = contract.organizationId ?? DEFAULT_ORG_ID;
  const asOfTs = new Date(`${asOf}T00:00:00Z`).getTime();

  const [
    attendanceEvents,
    meetings,
    onboardingItems,
    churnSignals,
    checkpoints,
    businessJourney,
    stageDefs
  ] = await Promise.all([
    repo.attendance.listByContract(contract.id).catch(() => []),
    repo.meetingLogs
      .listByCompany(contract.companyId, {
        sort: "date desc",
        limit: MEETING_FETCH_LIMIT
      })
      .catch(() => []),
    repo.onboardingItems.listByContractIds([contract.id]).catch(() => []),
    repo.churnSignals
      .listByContract(contract.id, { unresolvedOnly: true })
      .catch(() => []),
    repo.journeyCheckpoints
      .list({
        organizationId: orgId,
        journeyType: "business",
        subjectId: contract.id
      })
      .catch(() => []),
    repo.businessJourneys.getByContract(contract.id).catch(() => null),
    repo.journeyStageDefinitions
      .list({ organizationId: orgId, journeyType: "business" })
      .catch(() => [])
  ]);

  // 1. attendance — present + late を肯定的扱いとして比率を算出。
  //    asOf 以前に記録されたイベントのみ対象 (未来日付の混入を防ぐ)。
  let attendance: number | undefined;
  const pastEvents = attendanceEvents.filter((a) => {
    const t = Date.parse(a.recordedAt);
    return Number.isFinite(t) && t <= asOfTs;
  });
  if (pastEvents.length > 0) {
    const positive = pastEvents.filter(
      (a) => a.status === "present" || a.status === "late"
    ).length;
    attendance = positive / pastEvents.length;
  }

  // 2. weeksSinceLastTouch — 契約 product (or "cross") の meeting に限定して
  //    直近 1 件の date と asOf の差を週単位に丸める。
  //    同一企業に複数事業がある場合に他事業のログで「接点あり」と誤判定する
  //    ことを避ける。meeting が無い顧客は undefined のまま (中立扱い)。
  let weeksSinceLastTouch: number | undefined;
  const relevantMeeting = meetings.find(
    (m) => m.product === contract.product || m.product === "cross"
  );
  const lastDateStr = relevantMeeting?.date;
  if (lastDateStr) {
    const lastTs = Date.parse(`${lastDateStr}T00:00:00Z`);
    if (Number.isFinite(lastTs)) {
      const diffDays = Math.max(0, Math.floor((asOfTs - lastTs) / DAY_MS));
      weeksSinceLastTouch = Math.floor(diffDays / 7);
    }
  }

  // 3. overdueOnboardingTasks — dueDate が asOf 未満かつ未消化 (done / not_applicable
  //    以外) のタスク件数。mock の status="overdue" だけに頼ると asOf=今日以外
  //    (将来 / 過去日付指定の cron) で誤判定するため、自前で日付比較する。
  const overdueOnboardingTasks = onboardingItems.filter((i) => {
    if (i.status === "done" || i.status === "not_applicable") return false;
    if (!i.dueDate) return false;
    return i.dueDate < asOf;
  }).length;

  // 4. negativeSignalCount — 未解決 churn signal のうち重要度 high/medium のみを
  //    カウント (low は雑音的なので除外)。
  const negativeSignalCount = churnSignals.filter(
    (s) => s.severity === "high" || s.severity === "medium"
  ).length;

  // 5. milestoneProgress — 事業ジャーニーの「現ステージ以前」の checkpoint done 比率。
  //    未来ステージのチェックポイント (未着手で当然) を分母に含めると、
  //    オンボード初期の契約が一律低スコアになるため除外する。
  //    business_journeys が取得できない場合は全 checkpoint 横断にフォールバック。
  let milestoneProgress: number | undefined;
  if (checkpoints.length > 0) {
    const relevantCheckpoints = filterCheckpointsUpToCurrentStage(
      checkpoints,
      businessJourney?.currentStageKey,
      stageDefs
    );
    if (relevantCheckpoints.length > 0) {
      const done = relevantCheckpoints.filter((c) => c.done).length;
      milestoneProgress = done / relevantCheckpoints.length;
    }
  }

  return {
    attendance,
    weeksSinceLastTouch,
    overdueOnboardingTasks,
    negativeSignalCount,
    milestoneProgress
  };
}

/**
 * 「現ステージまで」の checkpoint に絞り込む。
 * - currentStageKey と stageDefs の両方が揃っていない場合は全件返す (フォールバック)。
 * - 現ステージが見つからない場合も全件返す。
 * - displayOrder が currentStage 以下の stageKey に属する checkpoint を採用。
 */
function filterCheckpointsUpToCurrentStage<
  T extends { stageKey: string }
>(
  checkpoints: T[],
  currentStageKey: string | undefined,
  stageDefs: Array<{ stageKey: string; displayOrder: number }>
): T[] {
  if (!currentStageKey || stageDefs.length === 0) return checkpoints;
  const current = stageDefs.find((s) => s.stageKey === currentStageKey);
  if (!current) return checkpoints;
  const cutoff = current.displayOrder;
  const allowedKeys = new Set(
    stageDefs.filter((s) => s.displayOrder <= cutoff).map((s) => s.stageKey)
  );
  return checkpoints.filter((c) => allowedKeys.has(c.stageKey));
}
