// 企業・担当者・契約・参加者・セッション・面談ログ・オンボ・パイプラインの詳細ダミーデータ

import { ProductCode } from "./data";

export type Company = {
  id: string;
  name: string;
  kana: string;
  industry: string;
  address: string;
  group?: string;
  ownerName: string;
  healthColor: "green" | "yellow" | "red";
  contracts: ProductCode[];
  mrr: number;
  lastTouchDays: number;
  memo?: string;
};

export const companies: Company[] = [
  {
    id: "c-aeon",
    name: "イオン九州株式会社",
    kana: "いおんきゅうしゅう",
    industry: "小売",
    address: "福岡市博多区",
    group: "イオンFG",
    ownerName: "古野",
    healthColor: "red",
    contracts: ["academia", "aiken", "hyogikai"],
    mrr: 450_000,
    lastTouchDays: 18,
    memo: "契約終了60日前・更新未確定"
  },
  {
    id: "c-nishitetsu",
    name: "西日本鉄道株式会社",
    kana: "にしにっぽんてつどう",
    industry: "鉄道",
    address: "福岡市博多区",
    ownerName: "三木",
    healthColor: "red",
    contracts: ["hyogikai", "academia"],
    mrr: 450_000,
    lastTouchDays: 35,
    memo: "直近2回の定例が欠席"
  },
  {
    id: "c-ffg",
    name: "ふくおかフィナンシャルグループ",
    kana: "ふくおかふぃなんしゃるぐるーぷ",
    industry: "金融",
    address: "福岡市中央区",
    ownerName: "古野",
    healthColor: "red",
    contracts: ["commu", "academia"],
    mrr: 420_000,
    lastTouchDays: 5,
    memo: "更新見送り検討中と発言"
  },
  {
    id: "c-kyudenko",
    name: "株式会社九電工",
    kana: "きゅうでんこう",
    industry: "建設・電気",
    address: "福岡市南区",
    ownerName: "松田",
    healthColor: "yellow",
    contracts: ["commu", "aiken"],
    mrr: 120_000,
    lastTouchDays: 12,
    memo: "NPSが前回比 -15"
  },
  {
    id: "c-jrq",
    name: "九州旅客鉄道株式会社",
    kana: "きゅうしゅうりょかくてつどう",
    industry: "鉄道",
    address: "福岡市博多区",
    ownerName: "三木",
    healthColor: "yellow",
    contracts: ["academia", "hyogikai"],
    mrr: 450_000,
    lastTouchDays: 21
  },
  {
    id: "c-fukugin",
    name: "株式会社福岡銀行",
    kana: "ふくおかぎんこう",
    industry: "金融",
    address: "福岡市中央区",
    group: "ふくおかFG",
    ownerName: "古野",
    healthColor: "yellow",
    contracts: ["commu", "academia"],
    mrr: 420_000,
    lastTouchDays: 8
  },
  {
    id: "c-yamae",
    name: "ヤマエグループホールディングス",
    kana: "やまえぐるーぷ",
    industry: "卸売",
    address: "福岡市博多区",
    ownerName: "松田",
    healthColor: "yellow",
    contracts: ["academia"],
    mrr: 300_000,
    lastTouchDays: 14
  },
  {
    id: "c-toto",
    name: "TOTO株式会社",
    kana: "とうと",
    industry: "住宅設備",
    address: "北九州市小倉北区",
    ownerName: "古野",
    healthColor: "green",
    contracts: ["academia", "aiken"],
    mrr: 300_000,
    lastTouchDays: 3
  },
  {
    id: "c-nccb",
    name: "株式会社西日本シティ銀行",
    kana: "にしにっぽんしてぃぎんこう",
    industry: "金融",
    address: "福岡市博多区",
    ownerName: "三木",
    healthColor: "green",
    contracts: ["hyogikai", "commu"],
    mrr: 270_000,
    lastTouchDays: 6
  },
  {
    id: "c-saibugas",
    name: "西部ガスホールディングス株式会社",
    kana: "さいぶがす",
    industry: "エネルギー",
    address: "福岡市博多区",
    ownerName: "松田",
    healthColor: "green",
    contracts: ["academia"],
    mrr: 300_000,
    lastTouchDays: 9
  },
  {
    id: "c-fukuokashi",
    name: "福岡市",
    kana: "ふくおかし",
    industry: "自治体",
    address: "福岡市中央区",
    ownerName: "古野",
    healthColor: "green",
    contracts: ["hyogikai"],
    mrr: 150_000,
    lastTouchDays: 11
  },
  {
    id: "c-levias",
    name: "株式会社レヴィアス",
    kana: "れゔぃあす",
    industry: "IT",
    address: "福岡市中央区",
    ownerName: "古野",
    healthColor: "green",
    contracts: ["aiken", "commu"],
    mrr: 120_000,
    lastTouchDays: 2
  }
];

// 企業担当者（企業側の担当）
export type Contact = {
  id: string;
  companyId: string;
  name: string;
  department: string;
  title: string;
  email: string;
  tel?: string;
  isPrimary: boolean;
  products: ProductCode[];
};

export const contacts: Contact[] = [
  { id: "p-a1", companyId: "c-aeon", name: "田中 太郎", department: "人事部", title: "部長", email: "tanaka@aeon-kyushu.jp", isPrimary: true, products: ["academia", "aiken", "hyogikai"] },
  { id: "p-a2", companyId: "c-aeon", name: "佐藤 花子", department: "経営企画", title: "課長", email: "sato@aeon-kyushu.jp", isPrimary: false, products: ["academia"] },
  { id: "p-a3", companyId: "c-aeon", name: "山田 次郎", department: "役員", title: "副社長", email: "yamada@aeon-kyushu.jp", isPrimary: false, products: ["hyogikai"] }
];

// 面談ログ（全研修混在・タグ付き）
export type MeetingLog = {
  id: string;
  companyId: string;
  date: string;
  product: ProductCode | "cross"; // cross = 複数研修にまたがる話題
  type: "mtg" | "mail" | "call";
  title: string;
  summary: string;
  good?: string;
  more?: string;
  next?: string;
  authorName: string;
  aiGenerated?: boolean;
};

export const meetingLogs: MeetingLog[] = [
  {
    id: "m1",
    companyId: "c-aeon",
    date: "2026-04-22",
    product: "academia",
    type: "mail",
    title: "田中部長より：第15回講義の出席について",
    summary: "第15回の講義について、佐藤課長が出張で欠席となる旨の連絡。代替で別スタッフが参加希望。",
    next: "ゲスト参加の可否と手続きをNEO側で確認",
    authorName: "AI要約",
    aiGenerated: true
  },
  {
    id: "m2",
    companyId: "c-aeon",
    date: "2026-04-15",
    product: "cross",
    type: "mtg",
    title: "四半期レビューMTG（人事部長 + 古野）",
    summary: "ACADEMIA受講者3名の学習成果、評議会の議題希望、AIKEN次期派遣者の人選について議論。",
    good: "田中部長が継続意欲を明示。副社長にも取り組みをレポート済み",
    more: "ACADEMIA佐藤課長の稼働逼迫、参加頻度低下。代替要員の検討が必要",
    next: "次期派遣者リスト提案・副社長向けプレゼン資料作成",
    authorName: "古野"
  },
  {
    id: "m3",
    companyId: "c-aeon",
    date: "2026-03-28",
    product: "hyogikai",
    type: "mtg",
    title: "第5回定例会",
    summary: "テーマ「地域経済の未来」。田中部長 + 山田副社長（ゲスト）が出席。積極的な発言あり。",
    next: "第6回のアジェンダ案を5月上旬に提案",
    authorName: "三木"
  },
  {
    id: "m4",
    companyId: "c-aeon",
    date: "2026-03-10",
    product: "aiken",
    type: "call",
    title: "AIKEN派遣者からの質問対応",
    summary: "基礎コース第1回の内容について、佐藤課長が応用コースも受講したい旨の相談",
    next: "応用コース追加受講の見積を提示",
    authorName: "古野"
  }
];

// オンボタスク
export type OnboardingTask = {
  id: string;
  companyId: string;
  product: ProductCode;
  phase: "prep" | "kickoff" | "run" | "close";
  name: string;
  dueDate: string;
  status: "todo" | "doing" | "done" | "overdue";
  assignee: string;
};

export const onboardingTasks: OnboardingTask[] = [
  { id: "t1", companyId: "c-fukugin", product: "commu", phase: "prep", name: "Kickoff日程調整", dueDate: "2026-04-20", status: "overdue", assignee: "古野" },
  { id: "t2", companyId: "c-fukugin", product: "commu", phase: "prep", name: "参加者リスト受領", dueDate: "2026-04-22", status: "overdue", assignee: "古野" },
  { id: "t3", companyId: "c-fukugin", product: "commu", phase: "prep", name: "契約書送付", dueDate: "2026-04-25", status: "overdue", assignee: "古野" },
  { id: "t4", companyId: "c-fukugin", product: "commu", phase: "kickoff", name: "Kickoff MTG実施", dueDate: "2026-04-28", status: "todo", assignee: "古野" },
  { id: "t5", companyId: "c-fukugin", product: "commu", phase: "kickoff", name: "初回アンケート配布", dueDate: "2026-05-02", status: "todo", assignee: "古野" },
  { id: "t6", companyId: "c-levias", product: "aiken", phase: "prep", name: "参加者アカウント発行", dueDate: "2026-05-10", status: "todo", assignee: "松田" },
  { id: "t7", companyId: "c-levias", product: "aiken", phase: "kickoff", name: "教材配布", dueDate: "2026-05-13", status: "todo", assignee: "松田" },
  { id: "t8", companyId: "c-toto", product: "aiken", phase: "prep", name: "派遣者選定", dueDate: "2026-05-01", status: "doing", assignee: "古野" },
  { id: "t9", companyId: "c-toto", product: "academia", phase: "run", name: "中間レビュー準備", dueDate: "2026-06-15", status: "todo", assignee: "古野" },
  { id: "t10", companyId: "c-saibugas", product: "academia", phase: "run", name: "講義資料の事前送付", dueDate: "2026-04-26", status: "done", assignee: "松田" },
  { id: "t11", companyId: "c-kyudenko", product: "commu", phase: "close", name: "契約更新意向確認", dueDate: "2026-05-15", status: "todo", assignee: "松田" },
  { id: "t12", companyId: "c-jrq", product: "academia", phase: "run", name: "中間評価会アジェンダ作成", dueDate: "2026-04-28", status: "doing", assignee: "三木" }
];

// パイプライン（内諾前）
export type Deal = {
  id: string;
  companyName: string;
  product: ProductCode;
  stage: "lead" | "qualified" | "proposal" | "nego" | "verbal";
  expectedMrr: number;
  expectedStart: string;
  ownerName: string;
  nextAction: string;
  updatedDays: number;
};

export const deals: Deal[] = [
  { id: "d1", companyName: "株式会社ホライズン", product: "academia", stage: "lead", expectedMrr: 300_000, expectedStart: "2026-09-01", ownerName: "古野", nextAction: "初回ヒアリング設定", updatedDays: 2 },
  { id: "d2", companyName: "九州電力株式会社", product: "hyogikai", stage: "lead", expectedMrr: 150_000, expectedStart: "2027-04-01", ownerName: "三木", nextAction: "窓口紹介依頼", updatedDays: 5 },
  { id: "d3", companyName: "株式会社ふくや", product: "aiken", stage: "qualified", expectedMrr: 0, expectedStart: "2026-06-01", ownerName: "松田", nextAction: "派遣人数の確認", updatedDays: 3 },
  { id: "d4", companyName: "博多大丸", product: "commu", stage: "qualified", expectedMrr: 120_000, expectedStart: "2026-07-01", ownerName: "古野", nextAction: "カリキュラム説明MTG", updatedDays: 7 },
  { id: "d5", companyName: "株式会社ピエトロ", product: "academia", stage: "proposal", expectedMrr: 300_000, expectedStart: "2026-07-01", ownerName: "古野", nextAction: "提案書提出", updatedDays: 1 },
  { id: "d6", companyName: "九州商船", product: "hyogikai", stage: "proposal", expectedMrr: 150_000, expectedStart: "2026-10-01", ownerName: "三木", nextAction: "役員会向け資料準備", updatedDays: 4 },
  { id: "d7", companyName: "株式会社アステム", product: "commu", stage: "nego", expectedMrr: 120_000, expectedStart: "2026-06-15", ownerName: "松田", nextAction: "契約条件の最終調整", updatedDays: 2 },
  { id: "d8", companyName: "サニックス", product: "academia", stage: "nego", expectedMrr: 300_000, expectedStart: "2026-06-01", ownerName: "古野", nextAction: "価格交渉最終回", updatedDays: 1 },
  { id: "d9", companyName: "MrMax", product: "aiken", stage: "verbal", expectedMrr: 0, expectedStart: "2026-05-20", ownerName: "松田", nextAction: "契約書送付", updatedDays: 0 }
];

export const stageOrder = ["lead", "qualified", "proposal", "nego", "verbal"] as const;
export const stageLabels: Record<(typeof stageOrder)[number], string> = {
  lead: "リード",
  qualified: "ヒアリング済",
  proposal: "提案中",
  nego: "交渉中",
  verbal: "内諾"
};
