// 通知ディスパッチャ — 日次バッチで各種ドメインイベントを user_notifications に enqueue する。
//
// 対象カテゴリ:
//   - review:     週次レビュー未提出 (今週の月曜が来て 1 日経った時点で未提出を検知)
//   - renewal:    更新ウィンドウ突入 (契約終了 90 日前を初めて切ったタイミング)
//   - onboarding: オンボタスク期限超過 (dueDate < today AND status not done/not_applicable)
//
// すべて dedup: (userId, sourceType, sourceId) で重複防止。冪等に走らせて OK。
//
// 呼び出し経路: /api/cron/notifications-dispatch から GET で 1 日 1 回。

import "server-only";
import {
  companyRepo,
  contractRepo,
  weeklyReviewRepo,
  onboardingItemRepo,
  assignmentRepo
} from "@/lib/repository/server";
import { currentWeekMondayISO } from "@/lib/domain/week/week";
import { enqueueNotification } from "./inbox";
import { getLogger } from "@/lib/observability/logger";

export type DispatchResult = {
  attempted: number;
  enqueued: number;
  skipped: number;
};

/** companyId → primary 担当者 userId のマップを一括構築（assignmentRepo を N+1 で叩かない） */
async function buildPrimaryAssigneeMap(): Promise<Map<string, string>> {
  const all = await assignmentRepo.list({ activeOnly: true }).catch(() => []);
  const map = new Map<string, string>();
  for (const a of all) {
    if (a.role !== "primary") continue;
    // 同一 company に複数 primary が居る不整合があれば最初の 1 件を採用
    if (!map.has(a.companyId)) map.set(a.companyId, a.userId);
  }
  return map;
}

/** today (YYYY-MM-DD) — テストから差し替えできるよう引数で受け取れる */
function todayISO(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.floor(
    (new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24)
  );
}

// ─────────────────────────────────────────────
// review: 週次レビュー未提出
// ─────────────────────────────────────────────
export async function dispatchWeeklyMissed(): Promise<DispatchResult> {
  const log = (await getLogger()).child({ dispatcher: "weekly_missed" });
  const weekStart = currentWeekMondayISO();
  const [companies, contracts, reviews, primaryMap] = await Promise.all([
    companyRepo.list(),
    contractRepo.list({ activeOnly: true }),
    weeklyReviewRepo.list({ weekStart }),
    buildPrimaryAssigneeMap()
  ]);
  const companiesWithActiveContract = new Set(contracts.map((c) => c.companyId));
  const reviewedKeys = new Set(reviews.map((r) => `${r.companyId}/${r.product}`));

  let attempted = 0;
  let enqueued = 0;
  let skipped = 0;
  for (const c of companies) {
    if (!companiesWithActiveContract.has(c.id)) continue;
    const productsForCompany = contracts
      .filter((ct) => ct.companyId === c.id)
      .map((ct) => ct.product);
    for (const product of new Set(productsForCompany)) {
      attempted++;
      if (reviewedKeys.has(`${c.id}/${product}`)) {
        skipped++;
        continue;
      }
      const userId = primaryMap.get(c.id);
      if (!userId) {
        skipped++;
        continue;
      }
      await enqueueNotification({
        userId,
        category: "review",
        title: `週次レビュー未提出: ${c.name}`,
        body: `今週 (${weekStart}〜) の ${product} 週次レビューがまだ提出されていません`,
        linkHref: `/weekly?company=${c.id}`,
        relatedCompanyId: c.id,
        sourceType: "weekly_missed",
        sourceId: `${c.id}/${product}/${weekStart}`
      });
      enqueued++;
    }
  }
  log.info({ attempted, enqueued, skipped }, "weekly_missed dispatch done");
  return { attempted, enqueued, skipped };
}

// ─────────────────────────────────────────────
// renewal: 更新ウィンドウ突入 (90 日前)
// ─────────────────────────────────────────────
const RENEWAL_THRESHOLD_DAYS = 90;

export async function dispatchRenewalWindow(now = new Date()): Promise<DispatchResult> {
  const log = (await getLogger()).child({ dispatcher: "renewal_window" });
  const today = todayISO(now);
  const [contracts, primaryMap, companies] = await Promise.all([
    contractRepo.list({ activeOnly: true }),
    buildPrimaryAssigneeMap(),
    companyRepo.list()
  ]);
  const companyById = new Map(companies.map((c) => [c.id, c]));

  let attempted = 0;
  let enqueued = 0;
  let skipped = 0;
  for (const c of contracts) {
    if (!c.endDate) continue;
    const remaining = daysBetween(c.endDate, today);
    // 90 日切ったタイミングを「ウィンドウ突入」とみなす (0 日以下は別扱い)
    if (remaining < 0 || remaining > RENEWAL_THRESHOLD_DAYS) continue;
    attempted++;
    const userId = primaryMap.get(c.companyId);
    if (!userId) {
      skipped++;
      continue;
    }
    const company = companyById.get(c.companyId);
    await enqueueNotification({
      userId,
      category: "renewal",
      title: `更新ウィンドウ: ${company?.name ?? c.companyId}`,
      body: `${c.product} の契約終了まであと ${remaining} 日 (${c.endDate})`,
      linkHref: `/companies/${c.companyId}`,
      relatedCompanyId: c.companyId,
      relatedContractId: c.id,
      sourceType: "renewal_window",
      // 90 日突入は contract に対して 1 回限り (再通知なし)
      sourceId: `${c.id}/90d`
    });
    enqueued++;
  }
  log.info({ attempted, enqueued, skipped }, "renewal_window dispatch done");
  return { attempted, enqueued, skipped };
}

// ─────────────────────────────────────────────
// onboarding: タスク期限超過
// ─────────────────────────────────────────────
export async function dispatchOnboardingOverdue(now = new Date()): Promise<DispatchResult> {
  const log = (await getLogger()).child({ dispatcher: "onboarding_overdue" });
  const today = todayISO(now);
  const [contracts, primaryMap, companies] = await Promise.all([
    contractRepo.list({ activeOnly: true }),
    buildPrimaryAssigneeMap(),
    companyRepo.list()
  ]);
  const contractIds = contracts.map((c) => c.id);
  const contractById = new Map(contracts.map((c) => [c.id, c]));
  const companyById = new Map(companies.map((c) => [c.id, c]));
  const items = await onboardingItemRepo
    .listByContractIds(contractIds)
    .catch(() => []);

  let attempted = 0;
  let enqueued = 0;
  let skipped = 0;
  for (const it of items) {
    if (it.status === "done" || it.status === "not_applicable") continue;
    if (!it.dueDate || it.dueDate >= today) continue;
    attempted++;
    const contract = contractById.get(it.contractId);
    if (!contract) {
      skipped++;
      continue;
    }
    const userId = primaryMap.get(contract.companyId);
    if (!userId) {
      skipped++;
      continue;
    }
    const company = companyById.get(contract.companyId);
    const overdueDays = daysBetween(today, it.dueDate);
    await enqueueNotification({
      userId,
      category: "onboarding",
      title: `オンボ期限超過: ${it.name}`,
      body: `${company?.name ?? contract.companyId} / ${overdueDays}日超過 (期限 ${it.dueDate})`,
      linkHref: `/onboarding`,
      relatedCompanyId: contract.companyId,
      relatedContractId: contract.id,
      sourceType: "onboarding_task",
      // task ごとに 1 回限り (再通知なし)
      sourceId: it.id
    });
    enqueued++;
  }
  log.info({ attempted, enqueued, skipped }, "onboarding_overdue dispatch done");
  return { attempted, enqueued, skipped };
}

// ─────────────────────────────────────────────
// 全カテゴリを一括ディスパッチ
// ─────────────────────────────────────────────
export async function dispatchAllNotifications(): Promise<{
  review: DispatchResult;
  renewal: DispatchResult;
  onboarding: DispatchResult;
}> {
  const [review, renewal, onboarding] = await Promise.all([
    dispatchWeeklyMissed(),
    dispatchRenewalWindow(),
    dispatchOnboardingOverdue()
  ]);
  return { review, renewal, onboarding };
}
