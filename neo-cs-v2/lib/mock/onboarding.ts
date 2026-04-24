// オンボーディング＆カスタマージャーニーのデータモデル
// オンボ = 契約ごとに毎回発生するチェックリスト（カテゴリ×項目の階層）
// ジャーニー = 契約開始後の運用フェーズの現在地

import { ProductCode } from "./data";

// ─────────────────────────────────────────────
// オンボテンプレ（研修マスタで編集 / カテゴリは追加・編集・削除可）
// ─────────────────────────────────────────────
export type OnboardingTemplateItem = {
  key: string;
  name: string;
  dueOffsetDays: number; // 契約開始日からの相対日数（負の値 = 開始前）
  required: boolean;
  defaultAssigneeRole?: "cs" | "pr" | "ops" | "finance";
};

export type OnboardingCategory = {
  key: string;
  label: string;
  order: number;
  items: OnboardingTemplateItem[];
};

// 4研修のデフォルトオンボテンプレート（設定画面で編集する前提）
export const productOnboardingTemplates: Record<ProductCode, OnboardingCategory[]> = {
  academia: [
    {
      key: "contract",
      label: "契約系",
      order: 1,
      items: [
        { key: "verbal_record", name: "内諾内容の記録", dueOffsetDays: -30, required: true, defaultAssigneeRole: "cs" },
        { key: "nda", name: "NDA締結", dueOffsetDays: -25, required: true, defaultAssigneeRole: "cs" },
        { key: "contract_send", name: "契約書送付", dueOffsetDays: -20, required: true, defaultAssigneeRole: "cs" },
        { key: "contract_return", name: "契約書回収", dueOffsetDays: -10, required: true, defaultAssigneeRole: "cs" },
        { key: "invoice", name: "請求書発行", dueOffsetDays: -5, required: true, defaultAssigneeRole: "finance" },
        { key: "payment_confirm", name: "入金確認", dueOffsetDays: 30, required: true, defaultAssigneeRole: "finance" }
      ]
    },
    {
      key: "pr",
      label: "広報系",
      order: 2,
      items: [
        { key: "lp_listing", name: "LPへの企業ロゴ掲載", dueOffsetDays: -14, required: false, defaultAssigneeRole: "pr" },
        { key: "pr_release", name: "プレスリリース調整", dueOffsetDays: -10, required: false, defaultAssigneeRole: "pr" },
        { key: "sns_post", name: "SNS告知投稿", dueOffsetDays: -3, required: false, defaultAssigneeRole: "pr" }
      ]
    },
    {
      key: "course_setup",
      label: "講座設定系",
      order: 3,
      items: [
        { key: "venue", name: "開講式会場の予約", dueOffsetDays: -21, required: true, defaultAssigneeRole: "ops" },
        { key: "materials", name: "教材一式の準備", dueOffsetDays: -7, required: true, defaultAssigneeRole: "ops" },
        { key: "lecturer", name: "年間講師のアサイン確定", dueOffsetDays: -14, required: true, defaultAssigneeRole: "ops" },
        { key: "schedule", name: "年間スケジュール確定・共有", dueOffsetDays: -14, required: true, defaultAssigneeRole: "cs" }
      ]
    },
    {
      key: "participant",
      label: "参加者登録系",
      order: 4,
      items: [
        { key: "participant_list", name: "派遣者3名のリスト受領", dueOffsetDays: -21, required: true, defaultAssigneeRole: "cs" },
        { key: "account", name: "参加者アカウント発行", dueOffsetDays: -7, required: true, defaultAssigneeRole: "ops" },
        { key: "welcome_mail", name: "ウェルカムメール配信", dueOffsetDays: -3, required: true, defaultAssigneeRole: "cs" },
        { key: "pre_survey", name: "事前アンケート配布", dueOffsetDays: -3, required: false, defaultAssigneeRole: "cs" }
      ]
    }
  ],

  hyogikai: [
    {
      key: "contract",
      label: "契約系",
      order: 1,
      items: [
        { key: "verbal_record", name: "内諾内容の記録", dueOffsetDays: -30, required: true },
        { key: "contract_send", name: "契約書送付", dueOffsetDays: -15, required: true },
        { key: "contract_return", name: "契約書回収", dueOffsetDays: -7, required: true },
        { key: "invoice", name: "請求書発行", dueOffsetDays: -3, required: true }
      ]
    },
    {
      key: "pr",
      label: "広報系",
      order: 2,
      items: [
        { key: "lp_listing", name: "公式サイトへの掲載", dueOffsetDays: -7, required: false },
        { key: "sns_post", name: "SNS告知", dueOffsetDays: -3, required: false }
      ]
    },
    {
      key: "course_setup",
      label: "運営準備",
      order: 3,
      items: [
        { key: "theme_plan", name: "年間テーマプラン共有", dueOffsetDays: -14, required: true },
        { key: "venue", name: "定例会会場の確保", dueOffsetDays: -21, required: true }
      ]
    },
    {
      key: "participant",
      label: "参加者登録系",
      order: 4,
      items: [
        { key: "regular_members", name: "固定メンバー確定", dueOffsetDays: -14, required: true },
        { key: "welcome_mail", name: "ウェルカムメール配信", dueOffsetDays: -3, required: true }
      ]
    }
  ],

  aiken: [
    {
      key: "contract",
      label: "契約系",
      order: 1,
      items: [
        { key: "verbal_record", name: "申込内容の記録", dueOffsetDays: -14, required: true },
        { key: "contract_send", name: "契約書送付", dueOffsetDays: -10, required: true },
        { key: "contract_return", name: "契約書回収", dueOffsetDays: -5, required: true },
        { key: "invoice", name: "請求書発行", dueOffsetDays: -3, required: true },
        { key: "payment_confirm", name: "入金確認", dueOffsetDays: 0, required: true }
      ]
    },
    {
      key: "pr",
      label: "広報系",
      order: 2,
      items: [
        { key: "lp_listing", name: "受講企業ロゴ掲載", dueOffsetDays: -5, required: false }
      ]
    },
    {
      key: "course_setup",
      label: "講座設定系",
      order: 3,
      items: [
        { key: "venue", name: "Day1/Day2 会場確保", dueOffsetDays: -7, required: true },
        { key: "materials", name: "教材配布", dueOffsetDays: -3, required: true },
        { key: "lecturer_brief", name: "講師との事前打合せ", dueOffsetDays: -3, required: true }
      ]
    },
    {
      key: "participant",
      label: "参加者登録系",
      order: 4,
      items: [
        { key: "participant_list", name: "受講者リスト受領", dueOffsetDays: -7, required: true },
        { key: "account", name: "受講者アカウント発行", dueOffsetDays: -3, required: true },
        { key: "welcome_mail", name: "ウェルカムメール配信", dueOffsetDays: -2, required: true }
      ]
    }
  ],

  commu: [
    {
      key: "contract",
      label: "契約系",
      order: 1,
      items: [
        { key: "verbal_record", name: "内諾内容の記録", dueOffsetDays: -14, required: true },
        { key: "contract_send", name: "契約書送付", dueOffsetDays: -10, required: true },
        { key: "contract_return", name: "契約書回収", dueOffsetDays: -5, required: true },
        { key: "invoice", name: "請求書発行", dueOffsetDays: -3, required: true }
      ]
    },
    {
      key: "pr",
      label: "広報系",
      order: 2,
      items: [
        { key: "lp_listing", name: "LP企業ロゴ掲載", dueOffsetDays: -7, required: false }
      ]
    },
    {
      key: "course_setup",
      label: "講座設定系",
      order: 3,
      items: [
        { key: "schedule", name: "3ヶ月スケジュール確定", dueOffsetDays: -10, required: true },
        { key: "materials", name: "教材準備", dueOffsetDays: -5, required: true }
      ]
    },
    {
      key: "participant",
      label: "参加者登録系",
      order: 4,
      items: [
        { key: "participant_list", name: "受講者リスト受領", dueOffsetDays: -7, required: true },
        { key: "account", name: "受講者アカウント発行", dueOffsetDays: -3, required: true },
        { key: "kickoff_invite", name: "Kickoff招待状配信", dueOffsetDays: -3, required: true }
      ]
    }
  ]
};

// ─────────────────────────────────────────────
// カスタマージャーニー（契約開始後の運用フェーズ）
// ─────────────────────────────────────────────
export type JourneyPhase = {
  key: string;
  label: string;
  description?: string;
  order: number;
};

export const productJourney: Record<ProductCode, JourneyPhase[]> = {
  academia: [
    { key: "intro", label: "導入", description: "Kickoff〜開講直後", order: 1 },
    { key: "q1", label: "前期", description: "第1〜第10回", order: 2 },
    { key: "mid", label: "中間評価", description: "中間発表・個別面談", order: 3 },
    { key: "q2", label: "後期", description: "第11〜第21回", order: 4 },
    { key: "graduate", label: "修了", description: "最終発表・修了式", order: 5 }
  ],
  hyogikai: [
    { key: "intro", label: "導入", description: "初回〜第2回", order: 1 },
    { key: "running", label: "運用中", description: "第3〜第9回", order: 2 },
    { key: "closing", label: "総括", description: "第10回・総括レポート", order: 3 }
  ],
  aiken: [
    { key: "trial", label: "体験", description: "初回コース受講", order: 1 },
    { key: "continue", label: "継続", description: "再受講・応用コース", order: 2 },
    { key: "expand", label: "拡大", description: "複数コース並行・社内展開", order: 3 }
  ],
  commu: [
    { key: "intro", label: "導入", description: "Kickoff〜第1回", order: 1 },
    { key: "running", label: "運用", description: "第2〜第4回", order: 2 },
    { key: "renewal", label: "更新判断", description: "最終回〜継続意向確認", order: 3 }
  ]
};

// ─────────────────────────────────────────────
// 契約インスタンス（企業×研修×プランの開講単位）
// ─────────────────────────────────────────────
export type ActiveContract = {
  id: string;
  companyId: string;
  product: ProductCode;
  planName?: string; // AIKEN: "基礎コース" / "応用コース"
  startDate: string; // 契約開始日（=講座開始日の目安）
  endDate?: string;
  mrr?: number;
  revenue?: number; // 単発の場合の総額
  ownerName: string;
  participants: number;
  // オンボ状態
  onboardingStatus: "in_progress" | "complete";
  // ジャーニー現在地
  currentPhase?: string; // オンボ中はnull, 開始後はphase key
  phaseEnteredAt?: string;
};

export const activeContracts: ActiveContract[] = [
  // オンボ中（契約開始前）
  {
    id: "k-fukugin-commu",
    companyId: "c-fukugin",
    product: "commu",
    startDate: "2026-04-28",
    endDate: "2026-07-28",
    mrr: 120_000,
    ownerName: "古野",
    participants: 8,
    onboardingStatus: "in_progress"
  },
  {
    id: "k-levias-aiken",
    companyId: "c-levias",
    product: "aiken",
    planName: "基礎コース",
    startDate: "2026-05-15",
    revenue: 450_000,
    ownerName: "松田",
    participants: 12,
    onboardingStatus: "in_progress"
  },
  {
    id: "k-toto-academia",
    companyId: "c-toto",
    product: "academia",
    startDate: "2026-05-20",
    endDate: "2027-05-19",
    mrr: 300_000,
    ownerName: "古野",
    participants: 3,
    onboardingStatus: "in_progress"
  },
  {
    id: "k-nccb-hyogikai",
    companyId: "c-nccb",
    product: "hyogikai",
    startDate: "2026-05-10",
    endDate: "2027-05-09",
    mrr: 150_000,
    ownerName: "三木",
    participants: 3,
    onboardingStatus: "in_progress"
  },
  {
    id: "k-toto-aiken",
    companyId: "c-toto",
    product: "aiken",
    planName: "応用コース",
    startDate: "2026-06-03",
    revenue: 450_000,
    ownerName: "古野",
    participants: 5,
    onboardingStatus: "in_progress"
  },

  // 運用中（オンボ完了済、ジャーニー進行中）
  {
    id: "k-aeon-academia",
    companyId: "c-aeon",
    product: "academia",
    startDate: "2025-09-01",
    endDate: "2026-08-31",
    mrr: 300_000,
    ownerName: "古野",
    participants: 3,
    onboardingStatus: "complete",
    currentPhase: "q2",
    phaseEnteredAt: "2026-02-01"
  },
  {
    id: "k-aeon-hyogikai",
    companyId: "c-aeon",
    product: "hyogikai",
    startDate: "2025-08-01",
    endDate: "2026-07-31",
    mrr: 150_000,
    ownerName: "三木",
    participants: 3,
    onboardingStatus: "complete",
    currentPhase: "running",
    phaseEnteredAt: "2025-10-01"
  },
  {
    id: "k-jrq-academia",
    companyId: "c-jrq",
    product: "academia",
    startDate: "2025-08-01",
    endDate: "2026-07-31",
    mrr: 300_000,
    ownerName: "三木",
    participants: 3,
    onboardingStatus: "complete",
    currentPhase: "mid",
    phaseEnteredAt: "2026-03-01"
  },
  {
    id: "k-saibugas-academia",
    companyId: "c-saibugas",
    product: "academia",
    startDate: "2025-10-01",
    endDate: "2026-09-30",
    mrr: 300_000,
    ownerName: "松田",
    participants: 3,
    onboardingStatus: "complete",
    currentPhase: "q1",
    phaseEnteredAt: "2025-11-01"
  },
  {
    id: "k-kyudenko-commu",
    companyId: "c-kyudenko",
    product: "commu",
    startDate: "2026-02-15",
    endDate: "2026-05-14",
    mrr: 120_000,
    ownerName: "松田",
    participants: 6,
    onboardingStatus: "complete",
    currentPhase: "renewal",
    phaseEnteredAt: "2026-04-15"
  }
];

// ─────────────────────────────────────────────
// 契約ごとのオンボチェックリスト（テンプレから展開したインスタンス）
// ─────────────────────────────────────────────
export type ContractOnboardingItem = {
  id: string;
  contractId: string;
  categoryKey: string;
  itemKey: string;
  name: string;
  dueDate: string;
  assignee: string;
  status: "todo" | "doing" | "done" | "overdue";
  required: boolean;
  completedAt?: string;
  note?: string;
};

// 日付算術
function offsetDate(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// 契約ごとにテンプレから展開（実データはデモのため一部のみstatusバリエーション）
// 今日は 2026-04-24 とする
const TODAY = "2026-04-24";

function isOverdue(dueDate: string, status: "todo" | "doing" | "done"): "todo" | "doing" | "done" | "overdue" {
  if (status === "done") return "done";
  return new Date(dueDate) < new Date(TODAY) ? "overdue" : status;
}

function generateItems(
  contract: ActiveContract,
  statusOverrides: Record<string, { status: "todo" | "doing" | "done"; assignee?: string; completedAt?: string }> = {}
): ContractOnboardingItem[] {
  const template = productOnboardingTemplates[contract.product];
  const defaultAssignee = contract.ownerName;

  return template.flatMap((cat) =>
    cat.items.map((item) => {
      const override = statusOverrides[`${cat.key}:${item.key}`];
      const baseStatus: "todo" | "doing" | "done" = override?.status ?? "todo";
      const dueDate = offsetDate(contract.startDate, item.dueOffsetDays);
      return {
        id: `${contract.id}-${cat.key}-${item.key}`,
        contractId: contract.id,
        categoryKey: cat.key,
        itemKey: item.key,
        name: item.name,
        dueDate,
        assignee: override?.assignee ?? defaultAssignee,
        status: isOverdue(dueDate, baseStatus),
        required: item.required,
        completedAt: override?.completedAt
      };
    })
  );
}

export const contractOnboardingItems: ContractOnboardingItem[] = [
  // 福岡銀行 × コミュマネ（オンボ中・遅延多い）
  ...generateItems(activeContracts[0], {
    "contract:verbal_record": { status: "done", completedAt: "2026-04-10" },
    "contract:contract_send": { status: "todo" },
    "contract:contract_return": { status: "todo" },
    "pr:lp_listing": { status: "done", completedAt: "2026-04-18" },
    "course_setup:schedule": { status: "doing" },
    "participant:participant_list": { status: "todo" }
  }),
  // レヴィアス × AIKEN基礎コース
  ...generateItems(activeContracts[1], {
    "contract:verbal_record": { status: "done", completedAt: "2026-04-20" },
    "contract:contract_send": { status: "done", completedAt: "2026-04-22" },
    "contract:contract_return": { status: "doing" },
    "course_setup:venue": { status: "done", completedAt: "2026-04-20" },
    "participant:participant_list": { status: "doing" }
  }),
  // TOTO × ACADEMIA
  ...generateItems(activeContracts[2], {
    "contract:verbal_record": { status: "done", completedAt: "2026-04-15" },
    "contract:nda": { status: "done", completedAt: "2026-04-18" },
    "contract:contract_send": { status: "doing" },
    "course_setup:venue": { status: "done", completedAt: "2026-04-20" },
    "course_setup:lecturer": { status: "doing" },
    "participant:participant_list": { status: "doing" }
  }),
  // 西日本シティ銀行 × 評議会
  ...generateItems(activeContracts[3], {
    "contract:verbal_record": { status: "done", completedAt: "2026-04-08" },
    "contract:contract_send": { status: "done", completedAt: "2026-04-15" },
    "contract:contract_return": { status: "doing" },
    "course_setup:theme_plan": { status: "doing" },
    "participant:regular_members": { status: "done", completedAt: "2026-04-20" }
  }),
  // TOTO × AIKEN応用コース
  ...generateItems(activeContracts[4], {
    "contract:verbal_record": { status: "done", completedAt: "2026-04-22" },
    "contract:contract_send": { status: "todo" }
  })
  // 運用中(complete)契約はオンボ項目すべてdoneにする
];

// 運用中契約: すべてdoneで埋める
activeContracts
  .filter((c) => c.onboardingStatus === "complete")
  .forEach((c) => {
    const items = generateItems(c);
    items.forEach((i) => {
      contractOnboardingItems.push({
        ...i,
        status: "done",
        completedAt: offsetDate(c.startDate, -1)
      });
    });
  });

// ─────────────────────────────────────────────
// ヘルパー
// ─────────────────────────────────────────────
export function categoryProgress(contractId: string, categoryKey: string) {
  const items = contractOnboardingItems.filter(
    (i) => i.contractId === contractId && i.categoryKey === categoryKey
  );
  const done = items.filter((i) => i.status === "done").length;
  return { done, total: items.length };
}

export function contractProgress(contractId: string) {
  const items = contractOnboardingItems.filter((i) => i.contractId === contractId);
  const done = items.filter((i) => i.status === "done").length;
  const overdue = items.filter((i) => i.status === "overdue").length;
  return { done, total: items.length, overdue };
}

export function daysUntilStart(startDate: string): number {
  const diff = (new Date(startDate).getTime() - new Date(TODAY).getTime()) / (1000 * 60 * 60 * 24);
  return Math.ceil(diff);
}
