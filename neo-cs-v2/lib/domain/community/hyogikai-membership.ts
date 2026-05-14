// 評議会会員資格の判定 (純関数)
//
// ルール:
//   - アカデミア (academia) 契約があれば、評議会参加権が **必ず** 付帯する
//     (granted_via="academia_bundle")
//   - 評議会 (hyogikai) 単独契約があれば、評議会参加権を持つ
//     (granted_via="standalone")
//   - 両方同時に存在する場合 = データ上の重複 (academia 経由が優先、hyogikai 契約は冗長)
//   - どちらもなければ非会員
//
// 売上: アカデミア経由は academia 契約に内包される。hyogikai は単独時のみ計上。

import type { Contract, ContractStatus } from "@/lib/repository/types";

export type HyogikaiGrantedVia = "academia_bundle" | "standalone";

// 「アクティブ」とみなす契約ステータス (renewed/churned は除外)
const ACTIVE_STATUSES: ContractStatus[] = [
  "handoff",
  "onboarding",
  "active",
  "renewal_window"
];

type ContractLike = {
  id: string;
  companyId: string;
  product: Contract["product"];
  status: ContractStatus;
  startDate: string;
  endDate?: string;
  mrr?: number;
  revenue?: number;
};

export type HyogikaiMembership = {
  /** 会員資格の付与経路 */
  grantedVia: HyogikaiGrantedVia;
  /** 付与元の契約 (アカデミア契約 or 評議会単独契約) */
  sourceContract: ContractLike;
  /** 同会社で academia と hyogikai の両方契約が存在するか (要データ整理) */
  hasRedundantHyogikai: boolean;
  /** 冗長な評議会単独契約 (academia_bundle 時のみ) */
  redundantHyogikaiContract?: ContractLike;
};

/**
 * 「現在アクティブな」評議会会員資格を判定。
 * status が active 系の契約のみを対象にする (renewed/churned は除く)。
 */
export function getHyogikaiMembership(
  contracts: ContractLike[]
): HyogikaiMembership | null {
  const active = contracts.filter((c) => ACTIVE_STATUSES.includes(c.status));
  const academia = active.find((c) => c.product === "academia");
  const hyogikai = active.find((c) => c.product === "hyogikai");

  if (academia) {
    return {
      grantedVia: "academia_bundle",
      sourceContract: academia,
      hasRedundantHyogikai: !!hyogikai,
      redundantHyogikaiContract: hyogikai
    };
  }
  if (hyogikai) {
    return {
      grantedVia: "standalone",
      sourceContract: hyogikai,
      hasRedundantHyogikai: false
    };
  }
  return null;
}

export const grantedViaLabel: Record<HyogikaiGrantedVia, string> = {
  academia_bundle: "アカデミア付帯",
  standalone: "評議会単独"
};

/**
 * MRR 集計時の重複排除用ヘルパー。
 * 「アカデミアと評議会の両方契約があるとき、評議会の MRR は academia に内包されるので 0 として扱う」。
 *
 * 集計側で contracts を回す前にこの関数で MRR を補正する。
 */
/**
 * 評議会参加開始日 (継続期間の起点) を算出。
 * アカデミア契約と評議会契約をまたいだ「評議会としての通算参加開始」を表す。
 *
 * ルール:
 *   - product が academia / hyogikai の契約全部 (status 問わず) の最古 startDate
 *   - 該当なしなら null
 *
 * これにより「アカデミア → 評議会単独に切替」しても、評議会会員としての継続性が
 * 維持される (新規契約の startDate ではなく、最初にアカデミアを契約した日が起点)。
 */
export function getHyogikaiMemberSince(
  contracts: Pick<ContractLike, "product" | "startDate">[]
): string | null {
  const dates = contracts
    .filter((c) => c.product === "academia" || c.product === "hyogikai")
    .map((c) => c.startDate)
    .filter((d) => !!d);
  if (dates.length === 0) return null;
  return dates.reduce((a, b) => (a < b ? a : b));
}

export function effectiveMrr(
  contract: ContractLike,
  allContractsOfSameCompany: Array<Pick<ContractLike, "id" | "product" | "status">>
): number {
  if (contract.product !== "hyogikai") return contract.mrr ?? 0;
  if (!ACTIVE_STATUSES.includes(contract.status)) return contract.mrr ?? 0;
  const hasActiveAcademia = allContractsOfSameCompany.some(
    (c) =>
      c.id !== contract.id &&
      c.product === "academia" &&
      ACTIVE_STATUSES.includes(c.status)
  );
  return hasActiveAcademia ? 0 : (contract.mrr ?? 0);
}
