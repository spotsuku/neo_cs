// 企業・担当者・契約・参加者・セッション・面談ログ・オンボ・パイプラインの詳細ダミーデータ

import { ProductCode } from "./data";
import { extraCompanies } from "./bulk-data";

export type Company = {
  id: string;
  name: string;
  kana: string;
  industry: string;
  address: string;
  group?: string;
  ownerName: string;
  contracts: ProductCode[];
  mrr: number;
  lastTouchDays: number;
  memo?: string;
  // Phase4-#5: Google Drive 自動連携 (テンプレフォルダ複製で生成された顧客フォルダ)
  driveFolderId?: string | null;
  driveFolderUrl?: string | null;
  driveFolderCreatedAt?: string | null;
};

const baseCompanies: Company[] = [
  {
    id: "c-aeon",
    name: "イオン九州株式会社",
    kana: "いおんきゅうしゅう",
    industry: "小売",
    address: "福岡市博多区",
    group: "イオンFG",
    ownerName: "古野",
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
    contracts: ["aiken", "commu"],
    mrr: 120_000,
    lastTouchDays: 2
  }
];

export const companies: Company[] = [...baseCompanies, ...extraCompanies];

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

// オンボタスク（研修ごとにフェーズ構成が違う）
export type OnboardingTask = {
  id: string;
  companyId: string;
  product: ProductCode;
  phase: string; // 研修ごとのphase key
  name: string;
  dueDate: string;
  status: "todo" | "doing" | "done" | "overdue";
  assignee: string;
};

// 研修ごとのフェーズ定義（設定画面で編集される想定）
export const productPhases: Record<ProductCode, { key: string; label: string; description?: string }[]> = {
  academia: [
    { key: "prep", label: "準備", description: "契約締結〜派遣者確定" },
    { key: "kickoff", label: "Kickoff", description: "開講式・初回講義" },
    { key: "q1", label: "Q1", description: "第1〜第5回講義" },
    { key: "mid", label: "中間評価", description: "中間発表・個別面談" },
    { key: "q2", label: "Q2", description: "第6〜第15回講義" },
    { key: "final", label: "最終発表", description: "最終報告会・修了式" }
  ],
  hyogikai: [
    { key: "prep", label: "準備", description: "契約〜固定メンバー確定" },
    { key: "q1", label: "Q1定例", description: "第1〜第3回" },
    { key: "q2", label: "Q2定例", description: "第4〜第6回" },
    { key: "q3", label: "Q3定例", description: "第7〜第9回" },
    { key: "closing", label: "総括", description: "第10回・総括レポート" }
  ],
  aiken: [
    { key: "prep", label: "事前準備", description: "派遣者選定・教材配布" },
    { key: "day1", label: "Day 1", description: "第1講義" },
    { key: "day2", label: "Day 2", description: "第2講義" },
    { key: "followup", label: "フォローアップ", description: "修了後アンケート・応用コース案内" }
  ],
  commu: [
    { key: "prep", label: "準備", description: "契約〜参加者確定" },
    { key: "m1", label: "1ヶ月目", description: "初回〜第2回講義" },
    { key: "m2", label: "2ヶ月目", description: "第3〜第4回講義" },
    { key: "m3", label: "3ヶ月目", description: "最終回〜更新判断" }
  ]
};

export const onboardingTasks: OnboardingTask[] = [
  // ACADEMIA
  { id: "t-a1", companyId: "c-toto", product: "academia", phase: "prep", name: "派遣者3名の確定", dueDate: "2026-05-01", status: "doing", assignee: "古野" },
  { id: "t-a2", companyId: "c-toto", product: "academia", phase: "prep", name: "開講式招待状の送付", dueDate: "2026-05-08", status: "todo", assignee: "古野" },
  { id: "t-a3", companyId: "c-saibugas", product: "academia", phase: "kickoff", name: "開講式の準備", dueDate: "2026-04-26", status: "done", assignee: "松田" },
  { id: "t-a4", companyId: "c-aeon", product: "academia", phase: "q1", name: "第5回講義の資料配布", dueDate: "2026-04-22", status: "done", assignee: "古野" },
  { id: "t-a5", companyId: "c-jrq", product: "academia", phase: "mid", name: "中間評価会アジェンダ作成", dueDate: "2026-04-28", status: "doing", assignee: "三木" },
  { id: "t-a6", companyId: "c-jrq", product: "academia", phase: "mid", name: "個別面談の日程調整", dueDate: "2026-05-10", status: "todo", assignee: "三木" },
  { id: "t-a7", companyId: "c-fukugin", product: "academia", phase: "q2", name: "第10回講義のゲスト調整", dueDate: "2026-05-15", status: "todo", assignee: "古野" },
  { id: "t-a8", companyId: "c-yamae", product: "academia", phase: "final", name: "最終発表会の会場手配", dueDate: "2026-04-30", status: "overdue", assignee: "松田" },

  // 評議会
  { id: "t-h1", companyId: "c-nccb", product: "hyogikai", phase: "prep", name: "固定メンバー3名の確定", dueDate: "2026-05-05", status: "doing", assignee: "三木" },
  { id: "t-h2", companyId: "c-fukuokashi", product: "hyogikai", phase: "q1", name: "第2回テーマ決定", dueDate: "2026-04-28", status: "doing", assignee: "三木" },
  { id: "t-h3", companyId: "c-aeon", product: "hyogikai", phase: "q2", name: "第6回ゲスト招聘", dueDate: "2026-05-10", status: "todo", assignee: "古野" },
  { id: "t-h4", companyId: "c-nishitetsu", product: "hyogikai", phase: "q2", name: "欠席フォローアップMTG", dueDate: "2026-04-22", status: "overdue", assignee: "三木" },
  { id: "t-h5", companyId: "c-jrq", product: "hyogikai", phase: "q3", name: "第7回アジェンダ共有", dueDate: "2026-05-20", status: "todo", assignee: "三木" },
  { id: "t-h6", companyId: "c-fukuokashi", product: "hyogikai", phase: "closing", name: "総括レポート作成", dueDate: "2026-06-25", status: "todo", assignee: "三木" },

  // AIKEN
  { id: "t-k1", companyId: "c-levias", product: "aiken", phase: "prep", name: "参加者アカウント発行", dueDate: "2026-05-10", status: "todo", assignee: "松田" },
  { id: "t-k2", companyId: "c-levias", product: "aiken", phase: "prep", name: "教材配布", dueDate: "2026-05-13", status: "todo", assignee: "松田" },
  { id: "t-k3", companyId: "c-toto", product: "aiken", phase: "prep", name: "派遣者選定", dueDate: "2026-05-01", status: "doing", assignee: "古野" },
  { id: "t-k4", companyId: "c-kyudenko", product: "aiken", phase: "day1", name: "Day1 会場準備", dueDate: "2026-05-02", status: "todo", assignee: "松田" },
  { id: "t-k5", companyId: "c-kyudenko", product: "aiken", phase: "day2", name: "Day2 課題提出確認", dueDate: "2026-05-09", status: "todo", assignee: "松田" },
  { id: "t-k6", companyId: "c-aeon", product: "aiken", phase: "followup", name: "修了後アンケート送付", dueDate: "2026-04-28", status: "doing", assignee: "古野" },
  { id: "t-k7", companyId: "c-aeon", product: "aiken", phase: "followup", name: "応用コース案内", dueDate: "2026-05-05", status: "todo", assignee: "古野" },

  // コミュマネ
  { id: "t-c1", companyId: "c-fukugin", product: "commu", phase: "prep", name: "Kickoff日程調整", dueDate: "2026-04-20", status: "overdue", assignee: "古野" },
  { id: "t-c2", companyId: "c-fukugin", product: "commu", phase: "prep", name: "参加者リスト受領", dueDate: "2026-04-22", status: "overdue", assignee: "古野" },
  { id: "t-c3", companyId: "c-fukugin", product: "commu", phase: "prep", name: "契約書送付", dueDate: "2026-04-25", status: "overdue", assignee: "古野" },
  { id: "t-c4", companyId: "c-fukugin", product: "commu", phase: "m1", name: "Kickoff MTG実施", dueDate: "2026-04-28", status: "todo", assignee: "古野" },
  { id: "t-c5", companyId: "c-fukugin", product: "commu", phase: "m1", name: "初回アンケート配布", dueDate: "2026-05-02", status: "todo", assignee: "古野" },
  { id: "t-c6", companyId: "c-levias", product: "commu", phase: "m2", name: "第3回講義の予習課題送付", dueDate: "2026-05-20", status: "todo", assignee: "松田" },
  { id: "t-c7", companyId: "c-kyudenko", product: "commu", phase: "m3", name: "契約更新意向確認", dueDate: "2026-05-15", status: "todo", assignee: "松田" },
  { id: "t-c8", companyId: "c-nccb", product: "commu", phase: "m3", name: "3ヶ月目サマリー作成", dueDate: "2026-06-10", status: "todo", assignee: "三木" }
];

