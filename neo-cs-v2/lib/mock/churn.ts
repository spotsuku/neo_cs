// 解約レコードのダミーエンティティ
// 過去サイクルに紐づけて demo データを少量保持

// 解約理由の事前カテゴリ (顧客に確認可能な選択肢)
// reviews/10_顧客.md の「解約理由非開示記録」指摘を解消するため、
// CS側の推測値 (reasonCategory) と顧客に開示・確認した内容 (verifiedByCustomer) を分離
export type ChurnReasonCategory =
  | "budget"
  | "low_engagement"
  | "internal_change"
  | "competitor"
  | "value_unfit"
  | "other";

export type ChurnRecord = {
  contractId: string;
  churnedAt: string;
  reasonCategory: ChurnReasonCategory;
  reasonNote: string;
  /** 顧客本人に確認 (合意) 済みの理由かどうか。falseの場合はCS側の推測値 */
  verifiedByCustomer: boolean;
  /** 顧客確認の日時 (verifiedByCustomer=true の場合に埋まる) */
  verifiedAt?: string;
  /** 顧客確認時のメモ (差分や補足) */
  verificationNote?: string;
  nextActionDate?: string;
  nextActionNote?: string;
  notified: boolean;
};

export const reasonCategoryLabels: Record<ChurnReasonCategory, string> = {
  budget: "予算カット",
  low_engagement: "活用度低迷",
  internal_change: "組織変更",
  competitor: "他社移行",
  value_unfit: "効果実感乏しい",
  other: "その他"
};

export const reasonCategoryOrder: ChurnReasonCategory[] = [
  "budget",
  "low_engagement",
  "internal_change",
  "competitor",
  "value_unfit",
  "other"
];

export const churnRecords: ChurnRecord[] = [
  {
    contractId: "k-aeon-hyogikai-1",
    churnedAt: "2025-07-31",
    reasonCategory: "internal_change",
    reasonNote: "事務局担当の異動に伴い一旦休止判断、後任体制が固まり次第再開検討",
    verifiedByCustomer: true,
    verifiedAt: "2025-07-15",
    verificationNote: "新任部長との面談で「組織変更による休止」と顧客側で明示確認済",
    nextActionDate: "2026-09-01",
    nextActionNote: "新任の人事部長に再提案のアポを取る",
    notified: true
  },
  {
    contractId: "k-jrq-academia-1",
    churnedAt: "2025-07-31",
    reasonCategory: "low_engagement",
    reasonNote: "受講者の出席率が低迷、社内成果報告が薄く更新可決が得られなかった",
    verifiedByCustomer: false,
    nextActionDate: "2026-06-15",
    nextActionNote: "新任部長との関係構築。新コース構成で再アプローチ",
    notified: false
  }
];
