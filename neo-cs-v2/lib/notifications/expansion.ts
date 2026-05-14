/**
 * エクスパンション機会 → Slack 通知ブリッジ (F項)
 *
 * 設計はストリーム02 D項 lib/notifications/churn.ts と同パターン:
 *   - score >= EXPANSION_NOTIFY_THRESHOLD (=80) を「通知すべき機会」とみなす
 *   - notified_at が立っているレコードはスキップ (重複防止)
 *   - server-only (Slack webhook URL を漏らさない)
 *   - dispatchPendingExpansionNotifications() を ストリーム04 の cron から呼ぶ
 */

import "server-only";
import {
  notifyExpansionOpportunity,
  type ExpansionOpportunityNotification
} from "./slack";
import {
  expansionOpportunityRepo,
  companyRepo,
  healthSnapshotRepo,
  userRepo
} from "@/lib/repository/server";
import type { ExpansionOpportunityRecord } from "@/lib/repository/server";
import { EXPANSION_NOTIFY_THRESHOLD } from "@/lib/domain/expansion/expansion";

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL ?? "http://localhost:3000";

async function buildPayload(op: ExpansionOpportunityRecord): Promise<ExpansionOpportunityNotification> {
  const [company, snapshots] = await Promise.all([
    companyRepo.getById(op.companyId),
    healthSnapshotRepo.listByContract(op.contractId)
  ]);
  const latestScore = snapshots.length > 0 ? snapshots[snapshots.length - 1].score : null;

  let ownerName: string | null = null;
  if (company?.ownerName) {
    const u = await userRepo.getByEmail(`${company.ownerName}@example.com`).catch(() => null);
    ownerName = u?.name ?? company.ownerName;
  }

  // evidence の文字列化 + suggestedAction を先頭に積む
  const evidenceLines: string[] = [];
  evidenceLines.push(`推奨アクション: ${op.suggestedAction}`);
  for (const [k, v] of Object.entries(op.evidence)) {
    if (typeof v === "object" && v !== null) {
      evidenceLines.push(`${k}: ${JSON.stringify(v)}`);
    } else {
      evidenceLines.push(`${k}: ${String(v)}`);
    }
  }

  return {
    opportunityId: op.id,
    contractId: op.contractId,
    companyName: company?.name ?? op.companyId,
    reason: op.reason,
    evidence: evidenceLines,
    healthScore: latestScore,
    detectedAt: op.detectedAt,
    dashboardUrl: `${APP_BASE_URL}/companies/${op.companyId}`,
    ownerName,
    estimatedUpsellJpy: op.estimatedUpsellJpy ?? null
  };
}

export async function notifyAndMarkExpansionOpportunity(
  op: ExpansionOpportunityRecord
): Promise<{
  notified: boolean;
  reason: "ok" | "already_notified" | "below_threshold" | "closed" | "post_failed";
}> {
  if (op.notifiedAt) return { notified: false, reason: "already_notified" };
  if (op.closedAt) return { notified: false, reason: "closed" };
  if (op.score < EXPANSION_NOTIFY_THRESHOLD) return { notified: false, reason: "below_threshold" };

  const payload = await buildPayload(op);
  const ok = await notifyExpansionOpportunity(payload);
  if (!ok) return { notified: false, reason: "post_failed" };
  await expansionOpportunityRepo.markNotified(op.id);
  return { notified: true, reason: "ok" };
}

/**
 * 一括通知 — ストリーム04の cron がこの関数を週次で呼ぶ想定。
 * `openOnly + unNotifiedOnly + minScore=EXPANSION_NOTIFY_THRESHOLD` でフィルタ。
 */
export async function dispatchPendingExpansionNotifications(): Promise<{
  attempted: number;
  notified: number;
  skipped: number;
  failed: number;
}> {
  const pending = await expansionOpportunityRepo.list({
    openOnly: true,
    unNotifiedOnly: true,
    minScore: EXPANSION_NOTIFY_THRESHOLD
  });
  let notified = 0;
  let skipped = 0;
  let failed = 0;
  for (const op of pending) {
    const r = await notifyAndMarkExpansionOpportunity(op);
    if (r.notified) notified++;
    else if (r.reason === "post_failed") failed++;
    else skipped++;
  }
  return { attempted: pending.length, notified, skipped, failed };
}
