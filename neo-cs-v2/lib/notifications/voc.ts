/**
 * VOC (Voice of Customer) → Slack 通知ブリッジ (H項)
 *
 * 設計はストリーム02 D/F項と同パターン:
 *   - priority="high" を「通知すべき VOC」とする
 *   - notifiedAt が立っているレコードはスキップ (重複防止)
 *   - server-only
 *
 * 04側 lib/notifications/slack.ts に SlackChannel='VOC' + notifyVocItem(payload)
 * が追加されたため、本ファイルは notifyVocItem を経由する形に整理済 (2026-05-03)。
 * 重複防止は dedup driver (memory|supabase) 経由 (slack.ts → dedup.ts)。
 */

import "server-only";
import { notifyVocItem, type VocItemNotification } from "./slack";
import { vocItemRepo, companyRepo, userRepo } from "@/lib/repository/server";
import type { VocItemRecord } from "@/lib/repository/server";
import { VOC_TAG_LABEL, type VocTag } from "@/lib/domain/voc";

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL ?? "http://localhost:3000";

async function buildPayload(v: VocItemRecord): Promise<VocItemNotification> {
  const company = v.companyId ? await companyRepo.getById(v.companyId) : null;
  const assignedUser = v.assignedTo ? await userRepo.getById(v.assignedTo) : null;
  const tagLabels = v.tags.map((t) => VOC_TAG_LABEL[t as VocTag] ?? t);

  return {
    vocItemId: v.id,
    contractId: v.contractId ?? null,
    companyName: company?.name ?? v.companyId ?? "—",
    excerpt: v.excerpt,
    tags: tagLabels,
    priority: v.priority,
    sourceType: v.sourceType,
    detectedAt: v.createdAt,
    dashboardUrl: `${APP_BASE_URL}/voc#${v.id}`,
    companyDashboardUrl: v.companyId ? `${APP_BASE_URL}/companies/${v.companyId}` : null,
    assignedToName: assignedUser?.name ?? null
    // suggestedAction は VocItemRecord に未定義のため省略 (将来導入時に詰める)
  };
}

export async function notifyAndMarkVocItem(
  v: VocItemRecord
): Promise<{
  notified: boolean;
  reason: "ok" | "already_notified" | "low_priority" | "post_failed";
}> {
  if (v.notifiedAt) return { notified: false, reason: "already_notified" };
  if (v.priority !== "high") return { notified: false, reason: "low_priority" };

  const payload = await buildPayload(v);
  const ok = await notifyVocItem(payload);
  if (!ok) return { notified: false, reason: "post_failed" };
  await vocItemRepo.markNotified(v.id);
  return { notified: true, reason: "ok" };
}

/** 一括通知 — 04 cron から週次で呼ぶ想定 */
export async function dispatchPendingVocNotifications(): Promise<{
  attempted: number;
  notified: number;
  skipped: number;
  failed: number;
}> {
  const pending = await vocItemRepo.list({
    priority: "high",
    unNotifiedOnly: true
  });
  let notified = 0;
  let skipped = 0;
  let failed = 0;
  for (const v of pending) {
    const r = await notifyAndMarkVocItem(v);
    if (r.notified) notified++;
    else if (r.reason === "post_failed") failed++;
    else skipped++;
  }
  return { attempted: pending.length, notified, skipped, failed };
}
