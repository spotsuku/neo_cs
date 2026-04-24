// ダミーデータ: 4研修・企業・参加者・セッション
// 仕様ディスカッション用の画面確認専用

export type ProductCode = "academia" | "hyogikai" | "aiken" | "commu";

export const products: {
  code: ProductCode;
  name: string;
  shortName: string;
  billingMonths: number | null;
  sessionCount: number | null;
  participantCap: number | null;
  accent: string;
}[] = [
  {
    code: "academia",
    name: "NEO ACADEMIA",
    shortName: "ACADEMIA",
    billingMonths: 12,
    sessionCount: 21,
    participantCap: 3,
    accent: "#3D9EFF"
  },
  {
    code: "hyogikai",
    name: "九州未来評議会",
    shortName: "評議会",
    billingMonths: 12,
    sessionCount: 10,
    participantCap: null,
    accent: "#8B5CF6"
  },
  {
    code: "aiken",
    name: "AIリスキリングキャンプ",
    shortName: "AIKEN",
    billingMonths: null,
    sessionCount: 2,
    participantCap: null,
    accent: "#4CD97B"
  },
  {
    code: "commu",
    name: "コミュマネの学校",
    shortName: "コミュマネ",
    billingMonths: 3,
    sessionCount: 5,
    participantCap: null,
    accent: "#FF9838"
  }
];

export const productByCode = Object.fromEntries(products.map((p) => [p.code, p]));

// 全体KPI
export const globalKpi = {
  totalCompanies: 42,
  totalContracts: 68,
  totalParticipants: 312,
  mrr: 8_420_000,
  arr: 101_040_000,
  renewalRate: 0.87,
  alertCount: 7,
  upcomingEvents: 14
};

// 研修別サマリー
export const productSummary: Record<
  ProductCode,
  {
    contracts: number;
    participants: number;
    mrr: number;
    renewalRate: number | null;
    attendance: number;
    nps: number;
    alertCount: number;
    updatedAt: string;
  }
> = {
  academia: {
    contracts: 14,
    participants: 38,
    mrr: 4_200_000,
    renewalRate: 0.92,
    attendance: 0.88,
    nps: 54,
    alertCount: 2,
    updatedAt: "2026-04-22"
  },
  hyogikai: {
    contracts: 18,
    participants: 52,
    mrr: 2_700_000,
    renewalRate: 0.83,
    attendance: 0.79,
    nps: 41,
    alertCount: 3,
    updatedAt: "2026-04-19"
  },
  aiken: {
    contracts: 24,
    participants: 186,
    mrr: 0,
    renewalRate: null,
    attendance: 0.94,
    nps: 62,
    alertCount: 0,
    updatedAt: "2026-04-23"
  },
  commu: {
    contracts: 12,
    participants: 36,
    mrr: 1_520_000,
    renewalRate: 0.78,
    attendance: 0.85,
    nps: 48,
    alertCount: 2,
    updatedAt: "2026-04-21"
  }
};

// 要対応企業リスト
export const alerts: {
  id: string;
  companyName: string;
  product: ProductCode;
  reason: string;
  severity: "high" | "mid" | "low";
  daysSinceLastTouch: number;
}[] = [
  {
    id: "a1",
    companyName: "イオン九州株式会社",
    product: "academia",
    reason: "契約終了まで60日・更新未確定",
    severity: "high",
    daysSinceLastTouch: 18
  },
  {
    id: "a2",
    companyName: "西日本鉄道株式会社",
    product: "hyogikai",
    reason: "直近2回の定例が欠席",
    severity: "high",
    daysSinceLastTouch: 35
  },
  {
    id: "a3",
    companyName: "九電工",
    product: "commu",
    reason: "NPSが前回比 -15",
    severity: "mid",
    daysSinceLastTouch: 12
  },
  {
    id: "a4",
    companyName: "JR九州",
    product: "hyogikai",
    reason: "主担当から返信なし（21日）",
    severity: "mid",
    daysSinceLastTouch: 21
  },
  {
    id: "a5",
    companyName: "福岡銀行",
    product: "academia",
    reason: "オンボ期日超過タスク 3件",
    severity: "mid",
    daysSinceLastTouch: 8
  },
  {
    id: "a6",
    companyName: "ふくおかフィナンシャルグループ",
    product: "commu",
    reason: "更新見送り検討中と発言",
    severity: "high",
    daysSinceLastTouch: 5
  },
  {
    id: "a7",
    companyName: "ヤマエグループHD",
    product: "academia",
    reason: "中間評価会の日程未確定",
    severity: "low",
    daysSinceLastTouch: 14
  }
];

// 直近イベント
export const upcoming: {
  id: string;
  date: string;
  companyName: string;
  product: ProductCode;
  title: string;
  type: "lecture" | "event" | "meeting" | "evaluation";
}[] = [
  { id: "e1", date: "2026-04-25", companyName: "イオン九州", product: "academia", title: "第15回 講義「組織変革のリアル」", type: "lecture" },
  { id: "e2", date: "2026-04-26", companyName: "西鉄", product: "hyogikai", title: "第6回 定例会", type: "meeting" },
  { id: "e3", date: "2026-04-28", companyName: "福岡銀行", product: "commu", title: "Kickoff MTG", type: "meeting" },
  { id: "e4", date: "2026-04-30", companyName: "JR九州", product: "academia", title: "中間評価会", type: "evaluation" },
  { id: "e5", date: "2026-05-02", companyName: "九電工", product: "aiken", title: "基礎コース 第2回", type: "lecture" },
  { id: "e6", date: "2026-05-07", companyName: "ふくおかFG", product: "commu", title: "第3回 講義", type: "lecture" }
];

// 月次MRR推移（過去12ヶ月）
export const mrrTrend: { month: string; mrr: number }[] = [
  { month: "2025-05", mrr: 5_600_000 },
  { month: "2025-06", mrr: 5_900_000 },
  { month: "2025-07", mrr: 6_300_000 },
  { month: "2025-08", mrr: 6_500_000 },
  { month: "2025-09", mrr: 6_900_000 },
  { month: "2025-10", mrr: 7_200_000 },
  { month: "2025-11", mrr: 7_400_000 },
  { month: "2025-12", mrr: 7_600_000 },
  { month: "2026-01", mrr: 7_900_000 },
  { month: "2026-02", mrr: 8_100_000 },
  { month: "2026-03", mrr: 8_300_000 },
  { month: "2026-04", mrr: 8_420_000 }
];

export function yen(n: number): string {
  if (n >= 100_000_000) return `¥${(n / 100_000_000).toFixed(2)}億`;
  if (n >= 10_000) return `¥${(n / 10_000).toFixed(0)}万`;
  return `¥${n.toLocaleString()}`;
}

export function pct(n: number | null): string {
  if (n === null) return "—";
  return `${Math.round(n * 100)}%`;
}
