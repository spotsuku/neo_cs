// Stakeholder ごとに「接点 (touches)」イベントを集計するヘルパ
//
// 純関数 lib/domain/engagement.ts への入力を作る役目。
// 副作用なし、Repository 非依存。呼び出し側が必要な配列を渡す。
//
// マッチングルール (本番 schema が確定するまでの暫定実装):
//   - 名前部分一致 (stakeholder.name in meeting_log.summary / title)
//   - 同一 companyId 配下のイベントのみ対象
//   - 出席イベント / 面談ログ / 週次レビューを汎用的に touches に正規化

import type { Stakeholder } from "@/lib/repository/types";
import type { MeetingLog } from "@/lib/mock/entities";
import type {
  EngagementInput,
  EngagementResult,
  EngagementTouch
} from "./engagement";
import { computeEngagement } from "./engagement";

export type StakeholderEngagementSource = {
  meetingLogs?: MeetingLog[];
  /** 出席イベント。発生日時のみ受け取る (participantId → stakeholder の対応は呼出側) */
  attendanceDates?: string[];
  /** 週次レビューの言及日 (同上、呼出側で対応) */
  weeklyMentionDates?: string[];
};

function nameMentioned(text: string | undefined, name: string): boolean {
  if (!text || !name) return false;
  // 姓 (スペース手前) と全名で前方一致 / 部分一致
  if (text.includes(name)) return true;
  const surname = name.split(/\s+/)[0];
  if (surname && surname.length >= 2 && text.includes(surname)) return true;
  return false;
}

/** 1 stakeholder × イベント群 → touches[] */
export function buildStakeholderTouches(
  s: Pick<Stakeholder, "name" | "companyId">,
  source: StakeholderEngagementSource
): EngagementTouch[] {
  const touches: EngagementTouch[] = [];

  for (const m of source.meetingLogs ?? []) {
    if (m.companyId !== s.companyId) continue;
    const text = `${m.title} ${m.summary} ${m.good ?? ""} ${m.more ?? ""} ${m.next ?? ""}`;
    if (nameMentioned(text, s.name) || nameMentioned(m.authorName, s.name)) {
      touches.push({ occurredAt: m.date, kind: "meeting" });
    }
  }
  for (const d of source.attendanceDates ?? []) {
    touches.push({ occurredAt: d, kind: "attendance" });
  }
  for (const d of source.weeklyMentionDates ?? []) {
    touches.push({ occurredAt: d, kind: "weekly" });
  }
  return touches;
}

/**
 * 1 stakeholder の最終 EngagementResult。
 * stakeholder.engagementTier (override) を渡すと自動値を上書きする。
 */
export function computeStakeholderEngagement(
  s: Pick<Stakeholder, "name" | "companyId" | "engagementTier">,
  source: StakeholderEngagementSource,
  asOf?: string
): EngagementResult {
  const touches = buildStakeholderTouches(s, source);
  const input: EngagementInput = {
    touches,
    asOf,
    overrideTier: s.engagementTier ?? null
  };
  return computeEngagement(input);
}
