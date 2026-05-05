// 通知の配信先ロール制御
//
// 設計方針:
//   - external ユーザーには内部運営向けの通知（横断アラート、週次未提出、
//     チーム稼働、KPI 異常など）を送らない
//   - external ユーザーが受け取ってよいのは「自身の閲覧可能企業に関する
//     業務連絡」のみ（例: 進捗更新依頼、契約更新リマインダー等）
//   - 現状の Slack はチャンネル webhook 配信のみで個人宛は無いが、将来の
//     メール / in-app 通知に向けて配信先フィルタの起点を本モジュールに集約する。
//
// 真のセキュリティ境界は RLS（0023/0024）にあり、本モジュールは「誤って
// 内部情報を含む通知を external に送ってしまう事故」を防ぐための一次防衛。

import type { AppUser, AppUserRole } from "@/lib/repository/types";

/**
 * 通知の種別
 *   - internal_ops    : 内部運営向け（KPI異常、未提出、チーム稼働など）
 *   - cross_business  : 横断系（事業跨ぎのアラート / レポート）
 *   - assigned_company: 担当企業に関する業務連絡（external も対象になり得る）
 *   - personal        : 自分自身宛（タスク期限、メンション等）
 */
export type NotificationKind =
  | "internal_ops"
  | "cross_business"
  | "assigned_company"
  | "personal";

/**
 * 指定ロールが当該種別の通知を受信できるか
 */
export function canReceiveNotification(
  role: AppUserRole | undefined,
  kind: NotificationKind
): boolean {
  if (!role) return false;

  switch (kind) {
    case "internal_ops":
    case "cross_business":
      // external 以外なら可。viewer は受信できるが UI 上の操作はできない
      return role !== "external";

    case "assigned_company":
      // 全ロール可。external は user_company_access による絞り込みで対象企業のみ
      return true;

    case "personal":
      // 全ロール可（自分宛は誰でも受け取れる）
      return true;
  }
}

/**
 * 受信者リストを通知種別でフィルタする
 * external など対象外ロールを除外し、誤配信を防ぐ
 */
export function filterRecipientsByRole<U extends Pick<AppUser, "role">>(
  recipients: U[],
  kind: NotificationKind
): U[] {
  return recipients.filter((u) => canReceiveNotification(u.role, kind));
}

/**
 * external ユーザーへの通知時、対象企業がアクセス可能かを検証する
 * （`assigned_company` 種別で external にも届けたい場合の事故防止）
 *
 * @param accessibleCompanyIds external ユーザーがアクセス可能な企業 ID
 * @param targetCompanyId      通知対象の企業 ID
 */
export function externalCanReceiveCompanyNotification(
  accessibleCompanyIds: string[],
  targetCompanyId: string
): boolean {
  return accessibleCompanyIds.includes(targetCompanyId);
}
