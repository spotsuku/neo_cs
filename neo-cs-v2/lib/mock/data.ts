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
