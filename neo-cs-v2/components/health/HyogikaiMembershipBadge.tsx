// 評議会会員資格バッジ
// 「評議会会員: アカデミア付帯」または「評議会会員: 単独契約」を小さく表示
// 両方契約が存在する重複時は警告色で「⚠ 評議会単独契約は冗長」を出す

import type { HyogikaiMembership } from "@/lib/domain/hyogikai-membership";
import { grantedViaLabel } from "@/lib/domain/hyogikai-membership";

export function HyogikaiMembershipBadge({
  membership,
  memberSince
}: {
  membership: HyogikaiMembership | null;
  /** 評議会としての通算参加開始日 (アカデミア時代も含む) */
  memberSince?: string | null;
}) {
  if (!membership) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-ink-50 text-ink-500 border border-ink-100"
        title="評議会の参加権を持たない"
      >
        評議会非会員
      </span>
    );
  }
  const isBundle = membership.grantedVia === "academia_bundle";
  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <span
        className={[
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border",
          isBundle
            ? "bg-violet-50 text-violet-700 border-violet-200"
            : "bg-violet-100 text-violet-800 border-violet-300"
        ].join(" ")}
        title={
          isBundle
            ? "アカデミア契約に評議会参加権が付帯しています"
            : "評議会単独契約で参加しています"
        }
      >
        評議会会員 / {grantedViaLabel[membership.grantedVia]}
      </span>
      {memberSince && (
        <span
          className="text-[10px] text-ink-500"
          title="評議会としての通算参加開始日 (アカデミア時代を含む)"
        >
          {memberSince} から
        </span>
      )}
      {membership.hasRedundantHyogikai && (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-300"
          title="アカデミアに評議会が含まれているため、評議会単独契約は冗長です。整理推奨"
        >
          ⚠ 評議会単独契約と重複
        </span>
      )}
    </span>
  );
}
