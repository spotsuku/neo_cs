// ダミーデータ
// CS観点で整理: スナップショット(今)/期間パフォーマンス(期間)/トレンド(流れ) を分離

export type ProductCode = "academia" | "hyogikai" | "aiken" | "commu";
export type ProductType = "continuous" | "one_shot";

// 期=全社で同期（アカデミア/評議会）、回=顧客ごとに独立（AIKEN/コミュマネ）
export type CycleUnit = "期" | "回";
export type CycleSyncMode = "global" | "per_account";

export const products: {
  code: ProductCode;
  name: string;
  shortName: string;
  type: ProductType;
  billingMonths: number | null;
  sessionCount: number | null;
  participantCap: number | null;
  accent: string;
  cycleUnit: CycleUnit;
  cycleLabelFormat: string; // {n} を連番で置換
  cycleSyncMode: CycleSyncMode;
}[] = [
  {
    code: "academia",
    name: "NEO ACADEMIA",
    shortName: "ACADEMIA",
    type: "continuous",
    billingMonths: 12,
    sessionCount: 21,
    participantCap: 3,
    accent: "#3D9EFF",
    cycleUnit: "期",
    cycleLabelFormat: "第{n}期",
    cycleSyncMode: "global"
  },
  {
    code: "hyogikai",
    name: "九州未来評議会",
    shortName: "評議会",
    type: "continuous",
    billingMonths: 12,
    sessionCount: 10,
    participantCap: null,
    accent: "#8B5CF6",
    cycleUnit: "期",
    cycleLabelFormat: "第{n}期",
    cycleSyncMode: "global"
  },
  {
    code: "aiken",
    name: "AIリスキリングキャンプ",
    shortName: "AIKEN",
    type: "one_shot",
    billingMonths: null,
    sessionCount: 2,
    participantCap: null,
    accent: "#4CD97B",
    cycleUnit: "回",
    cycleLabelFormat: "{n}回目",
    cycleSyncMode: "per_account"
  },
  {
    code: "commu",
    name: "コミュマネの学校",
    shortName: "コミュマネ",
    type: "continuous",
    billingMonths: 3,
    sessionCount: 5,
    participantCap: null,
    accent: "#FF9838",
    cycleUnit: "回",
    cycleLabelFormat: "{n}回目",
    cycleSyncMode: "per_account"
  }
];

export function cycleLabel(code: ProductCode, n: number): string {
  const p = products.find((pp) => pp.code === code);
  if (!p) return `${n}`;
  return p.cycleLabelFormat.replace("{n}", String(n));
}

export const productByCode = Object.fromEntries(products.map((p) => [p.code, p]));

// ─────────────────────────────────────────────
// コース（研修内の区分け）
// ─────────────────────────────────────────────
export type Course = {
  key: string;
  name: string;
  shortName: string;
  description?: string;
};

export const productCourses: Record<ProductCode, Course[]> = {
  academia: [
    { key: "pjt", name: "PJT共創コース", shortName: "PJT共創", description: "事業共創を通じた実践型リーダー育成" },
    { key: "leader", name: "リーダー育成コース", shortName: "リーダー育成", description: "次世代経営幹部候補の体系的育成" }
  ],
  hyogikai: [
    { key: "standard", name: "標準プログラム", shortName: "標準" }
  ],
  commu: [
    { key: "standard", name: "標準コース", shortName: "標準" }
  ],
  aiken: [
    { key: "basic", name: "Basic", shortName: "Basic", description: "AI基礎・業務活用の入門コース" },
    { key: "advance", name: "Advance", shortName: "Advance", description: "実践的なAIプロダクト開発コース" }
  ]
};

// 研修ごとに複数コースあるか
export function hasMultipleCourses(code: ProductCode): boolean {
  return productCourses[code].length > 1;
}

export function courseByKey(code: ProductCode, key: string): Course | undefined {
  return productCourses[code].find((c) => c.key === key);
}

export function courseName(code: ProductCode, key: string): string {
  return courseByKey(code, key)?.name ?? "";
}

export function courseShortName(code: ProductCode, key: string): string {
  return courseByKey(code, key)?.shortName ?? "";
}

// ─────────────────────────────────────────────
// ① スナップショット（今日時点）
// ─────────────────────────────────────────────
export const snapshot = {
  activeCompanies: 42,
  activeContracts: 56,            // 継続型のみ
  activeParticipants: 312,
  mrr: 8_420_000,                 // 継続型のみ
  revenueRunRate: 11_250_000,     // MRR + 単発GMVを月次按分した事業規模
  atRiskCount: 7,
  openRenewalsIn90d: 12
};

// ─────────────────────────────────────────────
// ② Customer Health Score
// ─────────────────────────────────────────────
export const health = {
  green: 27,
  yellow: 8,
  red: 7,
  // 研修別内訳
  byProduct: {
    academia: { green: 10, yellow: 3, red: 1 },
    hyogikai: { green: 11, yellow: 4, red: 3 },
    aiken: { green: 0, yellow: 0, red: 0 },      // 単発はHealth対象外
    commu: { green: 6, yellow: 3, red: 3 }
  } as Record<ProductCode, { green: number; yellow: number; red: number }>
};

// ─────────────────────────────────────────────
// ③ 更新ファネル（今後90日に期末を迎える契約）
// ─────────────────────────────────────────────
export const renewalFunnel: {
  stage: "committed" | "likely" | "at_risk";
  label: string;
  contracts: { id: string; companyName: string; product: ProductCode; endDate: string; mrr: number; note?: string }[];
}[] = [
  {
    stage: "committed",
    label: "Committed",
    contracts: [
      { id: "r1", companyName: "九電工", product: "academia", endDate: "2026-06-30", mrr: 300_000, note: "口頭合意済" },
      { id: "r2", companyName: "ヤマエグループHD", product: "hyogikai", endDate: "2026-07-15", mrr: 150_000 },
      { id: "r3", companyName: "JR九州", product: "academia", endDate: "2026-07-31", mrr: 300_000 }
    ]
  },
  {
    stage: "likely",
    label: "Likely",
    contracts: [
      { id: "r4", companyName: "福岡銀行", product: "commu", endDate: "2026-06-15", mrr: 120_000 },
      { id: "r5", companyName: "西日本シティ銀行", product: "hyogikai", endDate: "2026-06-30", mrr: 150_000 },
      { id: "r6", companyName: "TOTO", product: "academia", endDate: "2026-07-10", mrr: 300_000, note: "予算交渉中" }
    ]
  },
  {
    stage: "at_risk",
    label: "At Risk",
    contracts: [
      { id: "r7", companyName: "イオン九州", product: "academia", endDate: "2026-06-24", mrr: 300_000, note: "反応薄" },
      { id: "r8", companyName: "西日本鉄道", product: "hyogikai", endDate: "2026-07-01", mrr: 150_000, note: "担当変更" },
      { id: "r9", companyName: "ふくおかFG", product: "commu", endDate: "2026-06-20", mrr: 120_000, note: "見送り示唆" }
    ]
  }
];

// ─────────────────────────────────────────────
// ④ 期間パフォーマンス（月次/四半期/年度切替）
// ─────────────────────────────────────────────
export type Period = "thisMonth" | "thisQuarter" | "thisFY";

export const periodPerformance: Record<
  Period,
  {
    label: string;
    newLogos: number;      // 新規獲得企業
    newContracts: number;  // 新規契約
    renewedContracts: number;
    churnedContracts: number;
    grossRevenue: number;  // 継続型MRR増分 + 単発GMV
    oneshotGmv: number;    // 単発GMV
  }
> = {
  thisMonth: {
    label: "今月 (2026年4月)",
    newLogos: 3,
    newContracts: 4,
    renewedContracts: 2,
    churnedContracts: 1,
    grossRevenue: 11_250_000,
    oneshotGmv: 2_830_000
  },
  thisQuarter: {
    label: "今四半期 (Q1 FY26)",
    newLogos: 8,
    newContracts: 11,
    renewedContracts: 6,
    churnedContracts: 2,
    grossRevenue: 33_410_000,
    oneshotGmv: 8_240_000
  },
  thisFY: {
    label: "今年度 (FY2026)",
    newLogos: 8,
    newContracts: 11,
    renewedContracts: 6,
    churnedContracts: 2,
    grossRevenue: 33_410_000,
    oneshotGmv: 8_240_000
  }
};

// ─────────────────────────────────────────────
// ⑤ 継続型の研修別サマリー
// ─────────────────────────────────────────────
export const continuousSummary: Record<
  "academia" | "hyogikai" | "commu",
  {
    activeContracts: number;
    activeParticipants: number;
    mrr: number;
    renewalRate: number;   // 直近90日の更新実績
    nrr: number;           // Net Revenue Retention
    attendance: number;
    nps: number;
    upcomingRenewals: number; // 今後90日期末
    updatedAt: string;
  }
> = {
  academia: {
    activeContracts: 14,
    activeParticipants: 38,
    mrr: 4_200_000,
    renewalRate: 0.92,
    nrr: 1.08,
    attendance: 0.88,
    nps: 54,
    upcomingRenewals: 5,
    updatedAt: "2026-04-22"
  },
  hyogikai: {
    activeContracts: 18,
    activeParticipants: 52,
    mrr: 2_700_000,
    renewalRate: 0.83,
    nrr: 0.96,
    attendance: 0.79,
    nps: 41,
    upcomingRenewals: 4,
    updatedAt: "2026-04-19"
  },
  commu: {
    activeContracts: 12,
    activeParticipants: 36,
    mrr: 1_520_000,
    renewalRate: 0.78,
    nrr: 0.91,
    attendance: 0.85,
    nps: 48,
    upcomingRenewals: 3,
    updatedAt: "2026-04-21"
  }
};

// ─────────────────────────────────────────────
// ⑥ 単発型の研修別サマリー
// ─────────────────────────────────────────────
export const oneShotSummary: Record<
  "aiken",
  {
    activeCourses: number;         // 現在開講中のコース
    currentParticipants: number;   // 現在受講中
    fyGmv: number;                 // 今年度累計売上
    fyGraduates: number;           // 今年度累計修了者
    completionRate: number;        // 修了率
    repeatRate: number;            // リピート率（2コース受講等）
    nps: number;
    nextOpeningDate: string;
    updatedAt: string;
  }
> = {
  aiken: {
    activeCourses: 2,
    currentParticipants: 186,
    fyGmv: 8_240_000,
    fyGraduates: 142,
    completionRate: 0.94,
    repeatRate: 0.42,
    nps: 62,
    nextOpeningDate: "2026-05-15",
    updatedAt: "2026-04-23"
  }
};

// ─────────────────────────────────────────────
// ⑦ 要対応企業（Health: Red + Yellow）
// ─────────────────────────────────────────────
export const alerts: {
  id: string;
  companyName: string;
  product: ProductCode;
  healthColor: "red" | "yellow";
  reason: string;
  daysSinceLastTouch: number;
  owner: string;
  suggestedAction: string;
}[] = [
  {
    id: "a1",
    companyName: "イオン九州株式会社",
    product: "academia",
    healthColor: "red",
    reason: "契約終了60日前・更新未確定",
    daysSinceLastTouch: 18,
    owner: "古野",
    suggestedAction: "更新打診の面談を設定"
  },
  {
    id: "a2",
    companyName: "西日本鉄道株式会社",
    product: "hyogikai",
    healthColor: "red",
    reason: "直近2回の定例が欠席",
    daysSinceLastTouch: 35,
    owner: "三木",
    suggestedAction: "担当役員へ状況ヒアリング"
  },
  {
    id: "a3",
    companyName: "ふくおかフィナンシャルグループ",
    product: "commu",
    healthColor: "red",
    reason: "更新見送り検討中と発言",
    daysSinceLastTouch: 5,
    owner: "古野",
    suggestedAction: "価値再確認のプレゼン準備"
  },
  {
    id: "a4",
    companyName: "九電工",
    product: "commu",
    healthColor: "yellow",
    reason: "NPSが前回比 -15",
    daysSinceLastTouch: 12,
    owner: "松田",
    suggestedAction: "不満要因のヒアリング"
  },
  {
    id: "a5",
    companyName: "JR九州",
    product: "hyogikai",
    healthColor: "yellow",
    reason: "主担当から返信なし（21日）",
    daysSinceLastTouch: 21,
    owner: "三木",
    suggestedAction: "別ルートで接点確保"
  },
  {
    id: "a6",
    companyName: "福岡銀行",
    product: "academia",
    healthColor: "yellow",
    reason: "オンボ期日超過タスク 3件",
    daysSinceLastTouch: 8,
    owner: "古野",
    suggestedAction: "タスク棚卸MTG"
  },
  {
    id: "a7",
    companyName: "ヤマエグループHD",
    product: "academia",
    healthColor: "yellow",
    reason: "中間評価会の日程未確定",
    daysSinceLastTouch: 14,
    owner: "松田",
    suggestedAction: "日程候補を再提案"
  }
];

// ─────────────────────────────────────────────
// ⑧ 直近イベント
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// ⑨ MRR推移（過去12ヶ月）
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// フォーマッタ
// ─────────────────────────────────────────────
export function yen(n: number): string {
  if (n >= 100_000_000) return `¥${(n / 100_000_000).toFixed(2)}億`;
  if (n >= 10_000) return `¥${(n / 10_000).toFixed(0)}万`;
  return `¥${n.toLocaleString()}`;
}

export function pct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${Math.round(n * 100)}%`;
}

export function nrrFormat(n: number): string {
  return `${Math.round(n * 100)}%`;
}
