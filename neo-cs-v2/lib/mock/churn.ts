// 解約レコードのダミーエンティティ
// 過去サイクルに紐づけて demo データを少量保持

export type ChurnRecord = {
  contractId: string;
  churnedAt: string;
  reasonCategory:
    | "budget"
    | "low_engagement"
    | "internal_change"
    | "competitor"
    | "value_unfit"
    | "other";
  reasonNote: string;
  nextActionDate?: string;
  nextActionNote?: string;
  notified: boolean;
};

export const reasonCategoryLabels: Record<ChurnRecord["reasonCategory"], string> = {
  budget: "予算カット",
  low_engagement: "活用度低迷",
  internal_change: "組織変更",
  competitor: "他社移行",
  value_unfit: "効果実感乏しい",
  other: "その他"
};

export const reasonCategoryOrder: ChurnRecord["reasonCategory"][] = [
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
    nextActionDate: "2026-09-01",
    nextActionNote: "新任の人事部長に再提案のアポを取る",
    notified: true
  },
  {
    contractId: "k-jrq-academia-1",
    churnedAt: "2025-07-31",
    reasonCategory: "low_engagement",
    reasonNote: "受講者の出席率が低迷、社内成果報告が薄く更新可決が得られなかった",
    nextActionDate: "2026-06-15",
    nextActionNote: "新任部長との関係構築。新コース構成で再アプローチ",
    notified: false
  }
];
