// オンボーディング seed データ (mock 専用) + 既存 export の後方互換 re-export。
//
// テンプレ・カテゴリ型 / journey master / filterTemplateBy* は `@/lib/master/onboarding`
// に移動済。新規コードはそちらから import すること。
// このファイルには **mock seed** (allContracts / activeContracts / contractOnboardingItems
// など) のみが残る。

import type { ProductCode } from "@/lib/master/products";
import {
  filterTemplateByCourse,
  productOnboardingTemplates
} from "@/lib/master/onboarding";
import type { ActiveContract } from "@/lib/master/onboarding";
import { Contract, deriveStatus, deriveHealthScore } from "./contracts";

// 後方互換 re-export: 旧来 `from "@/lib/mock/onboarding"` で type / filter / template を
// import している箇所のため。新規コードは `@/lib/master/onboarding` を使うこと。
export {
  type OnboardingTemplateItem,
  type OnboardingCategory,
  type JourneyPhase,
  type ActiveContract,
  filterTemplateByCourse,
  filterTemplateByCourses,
  productOnboardingTemplates,
  productJourney
} from "@/lib/master/onboarding";


import { bulkActiveContracts } from "./bulk-data";

// 今日の基準日
const TODAY = "2026-04-24";

// レガシーシード形式（mockデータの可読性のため status を派生するための入力）
type ContractSeed = Omit<Contract, "status" | "healthScore"> & {
  onboardingStatus?: "in_progress" | "complete";
  cycleStatus?: "active" | "renewed" | "churned";
  renewalStatus?: "green" | "yellow" | "red";
};
function withStatus(c: ContractSeed): Contract {
  const { onboardingStatus, cycleStatus, renewalStatus, ...rest } = c;
  const status = deriveStatus({ onboardingStatus, cycleStatus, endDate: c.endDate });
  const healthScore = deriveHealthScore(renewalStatus, TODAY);
  return { ...rest, status, healthScore };
}

// ─────────────────────────────────────────────
// 契約 seed (再整理版)
// 各カテゴリを programmatic に展開
//   - 期構造: term1 (2024-04〜2025-03), term2 (2025-04〜2026-03), term3 (2026-04〜2027-03)
//   - 現在は 2026-05-05 想定 → term3 が 1ヶ月経過した active
// ─────────────────────────────────────────────

type AcademiaCourse = "leader" | "pjt";

const TERM_DATES = [
  { startDate: "2024-04-01", endDate: "2025-03-31" }, // term 1
  { startDate: "2025-04-01", endDate: "2026-03-31" }, // term 2
  { startDate: "2026-04-01", endDate: "2027-03-31" }  // term 3
];

const ACADEMIA_LEADERS: { id: string; ownerName: string; participants: number }[] = [
  { id: "c-aeon",       ownerName: "古野", participants: 3 },
  { id: "c-nishitetsu", ownerName: "三木", participants: 3 },
  { id: "c-jrq",        ownerName: "三木", participants: 3 },
  { id: "c-ffg",        ownerName: "古野", participants: 3 },
  { id: "c-fukugin",    ownerName: "古野", participants: 3 },
  { id: "c-toto",       ownerName: "古野", participants: 3 },
  { id: "c-yamae",      ownerName: "松田", participants: 3 },
  { id: "c-kyuden",     ownerName: "三木", participants: 3 },
  { id: "c-yasukawa",   ownerName: "古野", participants: 3 },
  { id: "c-toyota9",    ownerName: "古野", participants: 3 },
  { id: "c-nissan9",    ownerName: "三木", participants: 3 },
  { id: "c-saibugas",   ownerName: "松田", participants: 3 },
  { id: "c-japanet",    ownerName: "古野", participants: 3 },
  { id: "c-trial",      ownerName: "松田", participants: 3 },
  { id: "c-cosmos",     ownerName: "古野", participants: 3 },
  { id: "c-mitsuimatsu",ownerName: "古野", participants: 3 },
  { id: "c-cocacola",   ownerName: "三木", participants: 3 },
  { id: "c-shinnippon", ownerName: "松田", participants: 3 }
];

const ACADEMIA_PJT: { id: string; ownerName: string; participants: number }[] = [
  { id: "c-pietro",     ownerName: "古野", participants: 3 },
  { id: "c-fukuya",     ownerName: "古野", participants: 3 },
  { id: "c-kuhara",     ownerName: "古野", participants: 3 },
  { id: "c-fukuokashi", ownerName: "古野", participants: 3 },
  { id: "c-rkb",        ownerName: "三木", participants: 3 },
  { id: "c-nbc",        ownerName: "三木", participants: 3 },
  { id: "c-airport",    ownerName: "松田", participants: 3 },
  { id: "c-asakura",    ownerName: "松田", participants: 3 }
];

// アカデミア 1期のみで解約 (3社)
const ACADEMIA_CHURNED: { id: string; ownerName: string; participants: number; courseKey: AcademiaCourse }[] = [
  { id: "c-ippudo",     ownerName: "三木", participants: 3, courseKey: "leader" },
  { id: "c-suke",       ownerName: "松田", participants: 3, courseKey: "leader" },
  { id: "c-mrmax",      ownerName: "古野", participants: 3, courseKey: "pjt" }
];

// アカデミア → 評議会移行 (1社)
const ACADEMIA_TO_HYOGIKAI: { id: string; ownerName: string; participants: number }[] = [
  { id: "c-daimaru",    ownerName: "三木", participants: 3 }
];

const HYOGIKAI_ONLY: { id: string; ownerName: string; participants: number }[] = [
  { id: "c-nccb",       ownerName: "三木", participants: 3 },
  { id: "c-higo",       ownerName: "三木", participants: 3 },
  { id: "c-kagoshima",  ownerName: "三木", participants: 3 },
  { id: "c-oita",       ownerName: "古野", participants: 3 },
  { id: "c-miyazaki",   ownerName: "松田", participants: 3 },
  { id: "c-kitaq",      ownerName: "古野", participants: 3 },
  { id: "c-fukushoko",  ownerName: "三木", participants: 3 },
  { id: "c-saibu",      ownerName: "松田", participants: 3 },
  { id: "c-bunka9",     ownerName: "三木", participants: 3 }
];

// AI研修 4回 (3社/回)
const AIKEN_BATCHES: {
  batchNo: 1 | 2 | 3 | 4;
  startDate: string;
  endDate: string;
  status: "renewed" | "active";
  companies: { id: string; ownerName: string; courseKey: "basic" | "advance"; participants: number; revenue: number }[];
}[] = [
  {
    batchNo: 1, startDate: "2024-09-01", endDate: "2024-12-31", status: "renewed",
    companies: [
      { id: "c-saibu-st", ownerName: "古野", courseKey: "basic", participants: 8, revenue: 380_000 },
      { id: "c-hakata-d", ownerName: "三木", courseKey: "basic", participants: 8, revenue: 380_000 },
      { id: "c-kyuko",    ownerName: "松田", courseKey: "advance", participants: 6, revenue: 520_000 }
    ]
  },
  {
    batchNo: 2, startDate: "2025-04-01", endDate: "2025-07-31", status: "renewed",
    companies: [
      { id: "c-hawks",    ownerName: "古野", courseKey: "basic", participants: 10, revenue: 380_000 },
      { id: "c-avispa",   ownerName: "三木", courseKey: "basic", participants: 8, revenue: 380_000 },
      { id: "c-gu",       ownerName: "松田", courseKey: "advance", participants: 6, revenue: 520_000 }
    ]
  },
  {
    batchNo: 3, startDate: "2025-10-01", endDate: "2026-01-31", status: "renewed",
    companies: [
      { id: "c-kyudenko", ownerName: "松田", courseKey: "basic", participants: 8, revenue: 380_000 },
      { id: "c-astem",    ownerName: "松田", courseKey: "basic", participants: 8, revenue: 380_000 },
      { id: "c-daihatsu", ownerName: "松田", courseKey: "advance", participants: 6, revenue: 520_000 }
    ]
  },
  {
    batchNo: 4, startDate: "2026-04-01", endDate: "2026-07-31", status: "active",
    companies: [
      { id: "c-levias",   ownerName: "古野", courseKey: "basic", participants: 12, revenue: 380_000 },
      { id: "c-aikido",   ownerName: "古野", courseKey: "basic", participants: 8, revenue: 380_000 },
      { id: "c-zenrin",   ownerName: "松田", courseKey: "advance", participants: 6, revenue: 520_000 }
    ]
  }
];

// コミュマネ 第1回 active
const COMMU_BATCH_1: { id: string; ownerName: string; participants: number }[] = [
  { id: "c-fukugin-mati", ownerName: "古野", participants: 8 },
  { id: "c-kitaq-shoko",  ownerName: "三木", participants: 8 },
  { id: "c-omuta",        ownerName: "松田", participants: 8 }
];

// ─────────────────────────────────────────────
// 契約データ生成
// ─────────────────────────────────────────────
const generated: ContractSeed[] = [];

// アカデミア (3期 active) - リーダー育成 / PJT共創
function buildAcademia3Cycles(
  list: { id: string; ownerName: string; participants: number }[],
  courseKey: AcademiaCourse
) {
  for (const c of list) {
    for (let i = 0; i < 3; i++) {
      const t = TERM_DATES[i];
      const cycleNumber = i + 1;
      const isLast = i === 2;
      generated.push({
        id: `k-${c.id}-academia-${cycleNumber}`,
        companyId: c.id,
        product: "academia",
        courseKey,
        startDate: t.startDate,
        endDate: t.endDate,
        mrr: 300_000,
        ownerName: c.ownerName,
        participants: c.participants,
        cycleNumber,
        previousContractId:
          i > 0 ? `k-${c.id}-academia-${cycleNumber - 1}` : undefined,
        cycleStatus: isLast ? "active" : "renewed",
        onboardingStatus: isLast ? "in_progress" : "complete",
        renewalStatus: isLast ? "green" : undefined,
        currentPhase: isLast ? "intro" : undefined,
        phaseEnteredAt: isLast ? t.startDate : undefined
      });
    }
  }
}
buildAcademia3Cycles(ACADEMIA_LEADERS, "leader");
buildAcademia3Cycles(ACADEMIA_PJT, "pjt");

// アカデミア 1期で解約
for (const c of ACADEMIA_CHURNED) {
  const t = TERM_DATES[0];
  generated.push({
    id: `k-${c.id}-academia-1`,
    companyId: c.id,
    product: "academia",
    courseKey: c.courseKey,
    startDate: t.startDate,
    endDate: t.endDate,
    mrr: 300_000,
    ownerName: c.ownerName,
    participants: c.participants,
    cycleNumber: 1,
    cycleStatus: "churned",
    onboardingStatus: "complete"
  });
}

// アカデミア → 評議会移行 (1社)
//   academia cycle1 (term1) churned
//   hyogikai cycle1 (term2) renewed → cycle2 (term3) active
for (const c of ACADEMIA_TO_HYOGIKAI) {
  const t1 = TERM_DATES[0];
  generated.push({
    id: `k-${c.id}-academia-1`,
    companyId: c.id,
    product: "academia",
    courseKey: "leader",
    startDate: t1.startDate,
    endDate: t1.endDate,
    mrr: 300_000,
    ownerName: c.ownerName,
    participants: c.participants,
    cycleNumber: 1,
    cycleStatus: "churned",
    onboardingStatus: "complete"
  });
  // hyogikai cycle1 (term2) renewed
  const t2 = TERM_DATES[1];
  generated.push({
    id: `k-${c.id}-hyogikai-1`,
    companyId: c.id,
    product: "hyogikai",
    courseKey: "standard",
    startDate: t2.startDate,
    endDate: t2.endDate,
    mrr: 150_000,
    ownerName: c.ownerName,
    participants: c.participants,
    cycleNumber: 1,
    previousContractId: `k-${c.id}-academia-1`,
    cycleStatus: "renewed",
    onboardingStatus: "complete"
  });
  // hyogikai cycle2 (term3) active
  const t3 = TERM_DATES[2];
  generated.push({
    id: `k-${c.id}-hyogikai-2`,
    companyId: c.id,
    product: "hyogikai",
    courseKey: "standard",
    startDate: t3.startDate,
    endDate: t3.endDate,
    mrr: 150_000,
    ownerName: c.ownerName,
    participants: c.participants,
    cycleNumber: 2,
    previousContractId: `k-${c.id}-hyogikai-1`,
    cycleStatus: "active",
    onboardingStatus: "in_progress",
    renewalStatus: "green",
    currentPhase: "intro",
    phaseEnteredAt: t3.startDate
  });
}

// 評議会単独 (3期 active)
for (const c of HYOGIKAI_ONLY) {
  for (let i = 0; i < 3; i++) {
    const t = TERM_DATES[i];
    const cycleNumber = i + 1;
    const isLast = i === 2;
    generated.push({
      id: `k-${c.id}-hyogikai-${cycleNumber}`,
      companyId: c.id,
      product: "hyogikai",
      courseKey: "standard",
      startDate: t.startDate,
      endDate: t.endDate,
      mrr: 150_000,
      ownerName: c.ownerName,
      participants: c.participants,
      cycleNumber,
      previousContractId:
        i > 0 ? `k-${c.id}-hyogikai-${cycleNumber - 1}` : undefined,
      cycleStatus: isLast ? "active" : "renewed",
      onboardingStatus: isLast ? "in_progress" : "complete",
      renewalStatus: isLast ? "green" : undefined,
      currentPhase: isLast ? "intro" : undefined,
      phaseEnteredAt: isLast ? t.startDate : undefined
    });
  }
}

// AI研修 4回×3社
for (const batch of AIKEN_BATCHES) {
  for (const c of batch.companies) {
    generated.push({
      id: `k-${c.id}-aiken-${batch.batchNo}`,
      companyId: c.id,
      product: "aiken",
      courseKey: c.courseKey,
      startDate: batch.startDate,
      endDate: batch.endDate,
      revenue: c.revenue,
      ownerName: c.ownerName,
      participants: c.participants,
      cycleNumber: batch.batchNo,
      cycleStatus: batch.status,
      onboardingStatus: batch.status === "active" ? "in_progress" : "complete"
    });
  }
}

// コミュマネ 第1回 active
for (const c of COMMU_BATCH_1) {
  generated.push({
    id: `k-${c.id}-commu-1`,
    companyId: c.id,
    product: "commu",
    courseKey: "standard",
    startDate: "2026-04-01",
    endDate: "2026-06-30",
    mrr: 120_000,
    ownerName: c.ownerName,
    participants: c.participants,
    cycleNumber: 1,
    cycleStatus: "active",
    onboardingStatus: "in_progress"
  });
}

// ─────────────────────────────────────────────
// 更新ウィンドウデモデータ
//   全アカデミア契約は term3 (期末 2027-03-31) で renewal_window (90日) 外。
//   /renewal 画面と RenewalMilestoneList の動作確認のため、5社の term3
//   契約 endDate を TODAY (2026-04-24) から 90日以内に前倒しする。
//   healthScore (renewalStatus) も多様化させ、Green/Yellow/Red を揃える。
// ─────────────────────────────────────────────
const RENEWAL_WINDOW_OVERRIDES: Record<
  string,
  { endDate: string; renewalStatus: "green" | "yellow" | "red" }
> = {
  // 期末6日後・Red — クロージング迫る危機案件
  "k-c-aeon-academia-3":     { endDate: "2026-04-30", renewalStatus: "red" },
  // 期末30日後・Yellow — T-30 が今日
  "k-c-ffg-academia-3":      { endDate: "2026-05-24", renewalStatus: "yellow" },
  // 期末52日後・Yellow — T-60 を最近通過
  "k-c-yamae-academia-3":    { endDate: "2026-06-15", renewalStatus: "yellow" },
  // 期末82日後・Green — T-90 を最近通過、順調
  "k-c-fukuya-academia-3":   { endDate: "2026-07-15", renewalStatus: "green" },
  // 期末87日後・Green — 更新ウィンドウ突入直後
  "k-c-airport-academia-3":  { endDate: "2026-07-20", renewalStatus: "green" }
};

for (const seed of generated) {
  const ov = RENEWAL_WINDOW_OVERRIDES[seed.id];
  if (!ov) continue;
  seed.endDate = ov.endDate;
  seed.renewalStatus = ov.renewalStatus;
  // deriveStatus は onboardingStatus="in_progress" を先に評価するため、
  // 更新ウィンドウに乗せるには complete に切替必須（オンボ完了済の前提）
  seed.onboardingStatus = "complete";
}

const handPickedContracts: ActiveContract[] = generated.map(withStatus);

/** /renewal デモで意図的に renewal_window に乗せた契約ID集合 */
export const renewalWindowDemoContractIds: ReadonlySet<string> = new Set(
  Object.keys(RENEWAL_WINDOW_OVERRIDES)
);

// 全契約（過去サイクル含む）
export const allContracts: ActiveContract[] = [...handPickedContracts, ...bulkActiveContracts];

// 現行サイクルのみ（UI デフォルトで使う）
export const activeContracts: ActiveContract[] = allContracts.filter(
  (c) => c.status !== "renewed" && c.status !== "churned"
);

// ヘルパー: アカウント×プロダクトの現行契約
export function currentContractOf(companyId: string, product: ProductCode): ActiveContract | undefined {
  return activeContracts.find((c) => c.companyId === companyId && c.product === product);
}

// ヘルパー: アカウント×プロダクトの全サイクル履歴（古い順）
export function cycleHistoryOf(companyId: string, product: ProductCode): ActiveContract[] {
  return allContracts
    .filter((c) => c.companyId === companyId && c.product === product)
    .sort((a, b) => a.cycleNumber - b.cycleNumber);
}

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
  status: "todo" | "doing" | "done" | "not_applicable" | "overdue";
  required: boolean;
  completedAt?: string;
  note?: string;
  carriedOverFrom?: string;  // 前サイクルから引き継がれた場合、旧契約ID
};

// 日付算術
function offsetDate(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// 契約ごとにテンプレから展開（実データはデモのため一部のみstatusバリエーション）
function isOverdue(dueDate: string, status: "todo" | "doing" | "done"): "todo" | "doing" | "done" | "overdue" {
  if (status === "done") return "done";
  return new Date(dueDate) < new Date(TODAY) ? "overdue" : status;
}

function generateItems(
  contract: ActiveContract,
  statusOverrides: Record<string, { status: "todo" | "doing" | "done"; assignee?: string; completedAt?: string }> = {}
): ContractOnboardingItem[] {
  const template = filterTemplateByCourse(
    productOnboardingTemplates[contract.product],
    contract.courseKey
  );
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

// ハンドピック契約のオーバーライド（デモ用の具体的状態）
const handPickedOverrides: Record<
  string,
  Record<string, { status: "todo" | "doing" | "done"; completedAt?: string }>
> = {
  "k-fukugin-commu": {
    "contract:verbal_record": { status: "done", completedAt: "2026-04-10" },
    "contract:contract_send": { status: "todo" },
    "contract:contract_return": { status: "todo" },
    "pr:lp_listing": { status: "done", completedAt: "2026-04-18" },
    "course_setup:schedule": { status: "doing" },
    "participant:participant_list": { status: "todo" }
  },
  "k-levias-aiken": {
    "contract:verbal_record": { status: "done", completedAt: "2026-04-20" },
    "contract:contract_send": { status: "done", completedAt: "2026-04-22" },
    "contract:contract_return": { status: "doing" },
    "course_setup:venue": { status: "done", completedAt: "2026-04-20" },
    "participant:participant_list": { status: "doing" }
  },
  "k-toto-academia": {
    "contract:verbal_record": { status: "done", completedAt: "2026-04-15" },
    "contract:nda": { status: "done", completedAt: "2026-04-18" },
    "contract:contract_send": { status: "doing" },
    "course_setup:venue": { status: "done", completedAt: "2026-04-20" },
    "course_setup:lecturer": { status: "doing" },
    "participant:participant_list": { status: "doing" }
  },
  "k-nccb-hyogikai": {
    "contract:verbal_record": { status: "done", completedAt: "2026-04-08" },
    "contract:contract_send": { status: "done", completedAt: "2026-04-15" },
    "contract:contract_return": { status: "doing" },
    "course_setup:theme_plan": { status: "doing" },
    "participant:regular_members": { status: "done", completedAt: "2026-04-20" }
  },
  "k-toto-aiken": {
    "contract:verbal_record": { status: "done", completedAt: "2026-04-22" },
    "contract:contract_send": { status: "todo" }
  }
};

// 決定論的な擬似ランダム
function pseudoRand(seedStr: string, n: number): number {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = (h * 31 + seedStr.charCodeAt(i)) | 0;
  }
  h = (h + n * 2654435761) | 0;
  return (Math.abs(h) % 10000) / 10000;
}

// バルク契約(in_progress)のstatusを半ランダムに生成
function bulkOverrides(contract: ActiveContract): Record<string, { status: "todo" | "doing" | "done"; completedAt?: string }> {
  const overrides: Record<string, { status: "todo" | "doing" | "done"; completedAt?: string }> = {};
  const template = filterTemplateByCourse(
    productOnboardingTemplates[contract.product],
    contract.courseKey
  );
  let idx = 0;
  for (const cat of template) {
    for (const item of cat.items) {
      const key = `${cat.key}:${item.key}`;
      const r = pseudoRand(contract.id, idx++);
      // 期日オフセットがマイナス（開始前タスク）ほど進んでいる傾向
      const timeWeight = Math.max(0, Math.min(1, (-item.dueOffsetDays + 30) / 60));
      const p = r * 0.5 + timeWeight * 0.5;
      if (p > 0.75) {
        overrides[key] = { status: "done", completedAt: offsetDate(contract.startDate, item.dueOffsetDays - 2) };
      } else if (p > 0.55) {
        overrides[key] = { status: "doing" };
      } else {
        overrides[key] = { status: "todo" };
      }
    }
  }
  return overrides;
}

export const contractOnboardingItems: ContractOnboardingItem[] = [];

// すべての契約に対しチェックリスト項目を展開（過去サイクルの履歴も含む）
allContracts.forEach((c) => {
  if (c.status !== "onboarding" && c.status !== "handoff") {
    // 運用中契約: すべてdone
    const items = generateItems(c);
    items.forEach((i) => {
      contractOnboardingItems.push({
        ...i,
        status: "done",
        completedAt: offsetDate(c.startDate, -1)
      });
    });
  } else {
    // オンボ中契約: ハンドピックはそのオーバーライド、バルクは擬似ランダム
    const overrides = handPickedOverrides[c.id] ?? bulkOverrides(c);
    const items = generateItems(c, overrides);
    items.forEach((i) => contractOnboardingItems.push(i));
  }
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

// daysUntilStart は master/date に移動済。後方互換 re-export を残す。
export { daysUntilStart } from "@/lib/master/date";
