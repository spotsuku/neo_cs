// 対応漏れ検出: 経営ダッシュボードで「いま動かないと落とす」企業を可視化する
//
// 判定軸 (どれか1つ以上に該当した企業):
//   1. 最終接触から 28 日 (4週) 以上経過
//   2. 担当未割当 (ownerName 空)
//   3. 企業ジャーニー停滞: 同ステージに 180 日以上滞在
//   4. 高優先度 VOC が未対応のまま 14 日以上経過
// 各軸を箇条書きで返し、UI 側で「なぜ漏れているか」を即視認できるようにする

import type { Company } from "@/lib/mock/entities";
import type { CompanyJourney } from "@/lib/mock/journeys";
import type { VocItemRecord } from "@/lib/repository";

export type MissedReason =
  | "stale_contact"
  | "no_owner"
  | "journey_stuck"
  | "voc_unresolved";

export const MISSED_REASON_LABEL: Record<MissedReason, string> = {
  stale_contact: "最終接触から4週間以上",
  no_owner: "担当未割当",
  journey_stuck: "ジャーニー停滞 (6ヶ月以上)",
  voc_unresolved: "高優先度 VOC が未対応"
};

export type MissedCompany = {
  companyId: string;
  companyName: string;
  ownerName?: string;
  reasons: MissedReason[];
  /** 最終接触からの日数 (分かれば) */
  lastTouchDays?: number;
  /** ジャーニー停滞日数 */
  journeyStuckDays?: number;
  /** 未対応 VOC 件数 */
  vocOpenCount?: number;
};

const STALE_CONTACT_THRESHOLD = 28;
const JOURNEY_STUCK_THRESHOLD = 180;
const VOC_HIGH_AGE_THRESHOLD = 14;

export function detectMissedCompanies(
  asOf: string,
  companies: Company[],
  journeys: CompanyJourney[],
  vocItems: VocItemRecord[]
): MissedCompany[] {
  const journeyByCompany = new Map<string, CompanyJourney>();
  for (const j of journeys) journeyByCompany.set(j.companyId, j);

  const vocByCompany = new Map<string, VocItemRecord[]>();
  for (const v of vocItems) {
    if (!v.companyId) continue;
    if (v.status !== "open" && v.status !== "in_progress") continue;
    const arr = vocByCompany.get(v.companyId) ?? [];
    arr.push(v);
    vocByCompany.set(v.companyId, arr);
  }

  const out: MissedCompany[] = [];

  for (const co of companies) {
    const reasons: MissedReason[] = [];

    if (typeof co.lastTouchDays === "number" && co.lastTouchDays >= STALE_CONTACT_THRESHOLD) {
      reasons.push("stale_contact");
    }
    if (!co.ownerName || co.ownerName.trim() === "") {
      reasons.push("no_owner");
    }

    const j = journeyByCompany.get(co.id);
    let journeyStuckDays: number | undefined;
    if (j) {
      const days = (Date.parse(asOf) - Date.parse(j.stageEnteredAt)) / (1000 * 60 * 60 * 24);
      if (days >= JOURNEY_STUCK_THRESHOLD) {
        reasons.push("journey_stuck");
        journeyStuckDays = Math.floor(days);
      }
    }

    const vocList = vocByCompany.get(co.id) ?? [];
    const highOpen = vocList.filter((v) => {
      if (v.priority !== "high") return false;
      const ageDays = (Date.parse(asOf) - Date.parse(v.createdAt)) / (1000 * 60 * 60 * 24);
      return ageDays >= VOC_HIGH_AGE_THRESHOLD;
    });
    if (highOpen.length > 0) reasons.push("voc_unresolved");

    if (reasons.length === 0) continue;

    out.push({
      companyId: co.id,
      companyName: co.name,
      ownerName: co.ownerName,
      reasons,
      lastTouchDays: co.lastTouchDays,
      journeyStuckDays,
      vocOpenCount: highOpen.length || undefined
    });
  }

  // 危険度順: reasons 多い → 最終接触日数大 → 名前
  out.sort((a, b) => {
    if (b.reasons.length !== a.reasons.length) return b.reasons.length - a.reasons.length;
    return (b.lastTouchDays ?? 0) - (a.lastTouchDays ?? 0);
  });

  return out;
}
