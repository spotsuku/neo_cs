// コミュニティ関与度の自動おすすめロジック
// 手動設定が前提だが、運用負荷を下げるため
// roles / isPrimary / 直近メッセージ件数から「おすすめ tier」を提案する。

import type { Contact, ContactCommunityTier } from "@/lib/mock/entities";

export type CommunitySuggestion = {
  tier: ContactCommunityTier;
  reason: string;
};

export type CommunitySignals = {
  // この担当者宛/からの直近 30 日の受信メッセージ件数
  recentInboundCount?: number;
  // 直近メッセージの経過日数（無ければ undefined）
  daysSinceLastMessage?: number;
};

export function suggestCommunityTier(
  contact: Contact,
  signals: CommunitySignals = {}
): CommunitySuggestion {
  const roles = contact.roles ?? [];
  const roleCount = roles.length;
  const hasSenior = roles.some(
    (r) => r.level === "executive" || r.level === "approver"
  );
  const days = signals.daysSinceLastMessage;
  const recent = signals.recentInboundCount ?? 0;

  // 1) 90日以上音沙汰なし → 離脱危機
  if (days !== undefined && days >= 90) {
    return { tier: "at_risk", reason: `直近 ${days} 日メッセージなし` };
  }

  // 2) 多役兼務 or 主担当 → コア
  if (contact.isPrimary || roleCount >= 4) {
    return {
      tier: "core",
      reason: contact.isPrimary
        ? "主担当として登録"
        : `${roleCount} 役を兼務`
    };
  }

  // 3) シニア役職 + 直近やり取りあり → アクティブ
  if (hasSenior && (recent > 0 || days === undefined)) {
    return { tier: "active", reason: "決裁/役員クラスで関与中" };
  }

  // 4) 2 役以上 → アクティブ
  if (roleCount >= 2) {
    return { tier: "active", reason: `${roleCount} 役で関与` };
  }

  // 5) member 1 役のみ → カジュアル
  if (roleCount === 1 && roles[0]?.level === "member") {
    return { tier: "casual", reason: "担当者ロール 1 件のみ" };
  }

  // 6) ロール未設定 → カジュアル
  if (roleCount === 0) {
    return { tier: "casual", reason: "担当ロール未登録" };
  }

  return { tier: "active", reason: "標準" };
}
