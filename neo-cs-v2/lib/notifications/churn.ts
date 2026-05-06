/**
 * 解約予兆 → Slack 通知ブリッジ (D項とF項の接続点)
 *
 * 役割:
 *   - lib/domain/churn.ts の検知結果 (ChurnSignal) を
 *     ストリーム04 lib/notifications/slack.ts の `notifyChurnSignal` に渡す形に整形
 *   - 重複通知防止: churn_signals.notified_at が立っているシグナルはスキップ
 *   - 「severity=high のみ通知」のフィルタを本層に閉じる
 *   - server-only (Slack webhook URL を漏らさない)
 *
 * 呼び出し箇所:
 *   - 検知バッチ (Server Action / Route Handler / cron) から、
 *     検知後にこの関数で notifyAndMark を呼ぶ。
 *
 * Supabase 切替時:
 *   - churnSignalRepo.markNotified を呼んで notified_at を立てる
 *   - 失敗時は notified_at を立てない (再送可能にする)
 */

import "server-only";
import {
  notifyChurnSignal,
  type ChurnSeverity,
  type ChurnSignalNotification
} from "./slack";
import { churnSignalRepo, companyRepo, healthSnapshotRepo, userRepo } from "@/lib/repository/server";
import type { ChurnSignalRecord } from "@/lib/repository/server";

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL ?? "http://localhost:3000";

function toSlackSeverity(s: ChurnSignalRecord["severity"]): ChurnSeverity {
  // domain側 3段階 → Slack側 4段階。high(weight≥30) は critical 昇格
  return s === "high" ? "critical" : s === "medium" ? "medium" : "low";
}

async function buildPayload(sig: ChurnSignalRecord): Promise<ChurnSignalNotification> {
  const [company, snapshots] = await Promise.all([
    companyRepo.getById(sig.companyId),
    healthSnapshotRepo.listByContract(sig.contractId)
  ]);
  const latestScore = snapshots.length > 0 ? snapshots[snapshots.length - 1].score : null;

  // ownerName から AppUser を引き、Slack mention に使う (mock時は email を fallback)
  let ownerName: string | null = null;
  if (company?.ownerName) {
    const u = await userRepo.getByEmail(`${company.ownerName}@example.com`).catch(() => null);
    ownerName = u?.name ?? company.ownerName;
  }

  // evidence の文字列化 (構造化 jsonb → 人間可読)
  const evidenceLines: string[] = [];
  for (const [k, v] of Object.entries(sig.evidence)) {
    if (typeof v === "object" && v !== null) {
      evidenceLines.push(`${k}: ${JSON.stringify(v)}`);
    } else {
      evidenceLines.push(`${k}: ${String(v)}`);
    }
  }

  return {
    signalId: sig.id,
    contractId: sig.contractId,
    companyName: company?.name ?? sig.companyId,
    severity: toSlackSeverity(sig.severity),
    reason: sig.reason,
    evidence: evidenceLines,
    healthScore: latestScore,
    detectedAt: sig.detectedAt,
    dashboardUrl: `${APP_BASE_URL}/companies/${sig.companyId}`,
    ownerName
    // ownerSlackUserId は app_users に slack_user_id 列が無いため null
  };
}

/**
 * シグナル1件を通知し、成功なら notified_at を立てる。
 * 既に通知済み (notified_at != null) の場合はスキップ (重複防止)。
 */
export async function notifyAndMarkChurnSignal(
  sig: ChurnSignalRecord
): Promise<{ notified: boolean; reason: "ok" | "already_notified" | "low_severity" | "post_failed" }> {
  if (sig.notifiedAt) {
    return { notified: false, reason: "already_notified" };
  }
  if (sig.severity !== "high") {
    return { notified: false, reason: "low_severity" };
  }
  const payload = await buildPayload(sig);
  const ok = await notifyChurnSignal(payload);
  if (!ok) {
    return { notified: false, reason: "post_failed" };
  }
  await churnSignalRepo.markNotified(sig.id);
  return { notified: true, reason: "ok" };
}

/**
 * 一括通知 (検知バッチ完了後の hook)。
 * unNotifiedOnly + severity=high をリポジトリから引いてループ。
 */
export async function dispatchPendingChurnNotifications(): Promise<{
  attempted: number;
  notified: number;
  skipped: number;
  failed: number;
}> {
  const pending = await churnSignalRepo.list({
    unNotifiedOnly: true,
    severity: "high",
    unresolvedOnly: true
  });
  let notified = 0;
  let skipped = 0;
  let failed = 0;
  for (const sig of pending) {
    const r = await notifyAndMarkChurnSignal(sig);
    if (r.notified) notified++;
    else if (r.reason === "post_failed") failed++;
    else skipped++;
  }
  return { attempted: pending.length, notified, skipped, failed };
}
