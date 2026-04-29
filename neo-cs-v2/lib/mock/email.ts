// メールスレッド・メッセージ・AI抽出のダミーエンティティ
// Gmail × AI で進捗を自動抽出するコア機能のモックデータ
//
// ⚠️ 重要: AI処理はすべてモックです。実装時は Claude API 呼び出しに差し替えてください。
//   - mockExtractFromEmail: 受信メールからAI抽出を生成（キーワード辞書ベース）
//   - mockGenerateReplyDraft: AI返信下書き生成（固定テンプレ）

import type { Company } from "./entities";
import type { Contract } from "./contracts";
import type { ContractOnboardingItem } from "./onboarding";
import type { Stakeholder } from "./cycles";

export type EmailThreadStatus =
  | "new"
  | "in_progress"
  | "replied"
  | "waiting"
  | "closed";

export type EmailThread = {
  id: string;
  companyId: string;
  contractId?: string;
  subject: string;
  status: EmailThreadStatus;
  assignee: string;
  slaDeadline?: string;
  lastMessageAt: string;
  messageIds: string[];
};

export type EmailMessage = {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  cc: string[];
  sentAt: string;
  body: string;
  direction: "inbound" | "outbound";
};

export type AiExtractionType =
  | "onboarding_task_done"
  | "stakeholder_change"
  | "negative_signal"
  | "next_action"
  | "renewal_signal";

export type AiExtraction = {
  id: string;
  threadId: string;
  messageId: string;
  type: AiExtractionType;
  targetId?: string;
  suggestion: string;
  confidence: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

// ─────────────────────────────────────────────
// メールスレッド（拡張: 16件、古野担当を10件以上、SLA超過2〜3件）
// ─────────────────────────────────────────────
// 今日 = 2026-04-24（金）。SLA超過は slaDeadline が今日より過去のもの。
export const emailThreads: EmailThread[] = [
  {
    id: "et-1",
    companyId: "c-aeon",
    contractId: "k-aeon-academia",
    subject: "第15回講義の出席について",
    status: "new",
    assignee: "古野",
    slaDeadline: "2026-04-22", // SLA超過
    lastMessageAt: "2026-04-22",
    messageIds: ["em-1", "em-2"]
  },
  {
    id: "et-2",
    companyId: "c-fukugin",
    contractId: "k-fukugin-commu",
    subject: "契約書の押印について",
    status: "in_progress",
    assignee: "古野",
    slaDeadline: "2026-04-28",
    lastMessageAt: "2026-04-23",
    messageIds: ["em-3", "em-4"]
  },
  {
    id: "et-3",
    companyId: "c-toto",
    contractId: "k-toto-academia",
    subject: "派遣者リストの確定",
    status: "replied",
    assignee: "古野",
    lastMessageAt: "2026-04-21",
    messageIds: ["em-5", "em-6"]
  },
  {
    id: "et-4",
    companyId: "c-levias",
    contractId: "k-levias-aiken",
    subject: "Day1 会場のWi-Fi仕様確認",
    status: "waiting",
    assignee: "松田",
    lastMessageAt: "2026-04-20",
    messageIds: ["em-7"]
  },
  {
    id: "et-5",
    companyId: "c-saibugas",
    contractId: "k-saibugas-academia",
    subject: "第6回講義のフィードバック",
    status: "closed",
    assignee: "松田",
    lastMessageAt: "2026-04-18",
    messageIds: ["em-8", "em-9"]
  },
  {
    id: "et-6",
    companyId: "c-nccb",
    contractId: "k-nccb-hyogikai",
    subject: "固定メンバーの差し替え相談",
    status: "in_progress",
    assignee: "三木",
    slaDeadline: "2026-04-30",
    lastMessageAt: "2026-04-22",
    messageIds: ["em-10"]
  },
  {
    id: "et-7",
    companyId: "c-jrq",
    contractId: "k-jrq-academia",
    subject: "中間評価会の日程調整",
    status: "replied",
    assignee: "三木",
    lastMessageAt: "2026-04-19",
    messageIds: ["em-11", "em-12"]
  },
  {
    id: "et-8",
    companyId: "c-fukugin",
    contractId: "k-fukugin-commu",
    subject: "Kickoff資料の確認依頼",
    status: "new",
    assignee: "古野",
    slaDeadline: "2026-04-26",
    lastMessageAt: "2026-04-23",
    messageIds: ["em-13"]
  },
  {
    id: "et-9",
    companyId: "c-ffg",
    subject: "更新条件のご相談",
    status: "new",
    assignee: "古野",
    slaDeadline: "2026-04-23", // SLA超過
    lastMessageAt: "2026-04-23",
    messageIds: ["em-14"]
  },
  {
    id: "et-10",
    companyId: "c-aeon",
    contractId: "k-aeon-academia",
    subject: "第15回キックオフ完了のご報告",
    status: "in_progress",
    assignee: "古野",
    slaDeadline: "2026-04-27",
    lastMessageAt: "2026-04-24",
    messageIds: ["em-15", "em-16"]
  },
  {
    id: "et-11",
    companyId: "c-toto",
    contractId: "k-toto-aiken",
    subject: "担当者変更のお知らせ",
    status: "new",
    assignee: "古野",
    slaDeadline: "2026-04-21", // SLA超過
    lastMessageAt: "2026-04-20",
    messageIds: ["em-17"]
  },
  {
    id: "et-12",
    companyId: "c-yamae",
    subject: "次回定例のリスケのお願い",
    status: "in_progress",
    assignee: "松田",
    slaDeadline: "2026-04-29",
    lastMessageAt: "2026-04-23",
    messageIds: ["em-18", "em-19"]
  },
  {
    id: "et-13",
    companyId: "c-fukuokashi",
    contractId: "k-fukuokashi-hyogikai",
    subject: "次年度予算の見送りについて",
    status: "new",
    assignee: "古野",
    slaDeadline: "2026-04-30",
    lastMessageAt: "2026-04-24",
    messageIds: ["em-20"]
  },
  {
    id: "et-14",
    companyId: "c-kyudenko",
    contractId: "k-kyudenko-commu",
    subject: "事前アンケート回答状況",
    status: "in_progress",
    assignee: "古野",
    slaDeadline: "2026-04-28",
    lastMessageAt: "2026-04-22",
    messageIds: ["em-21", "em-22"]
  },
  {
    id: "et-15",
    companyId: "c-fukugin",
    contractId: "k-fukugin-academia",
    subject: "受講者からのフィードバック共有",
    status: "replied",
    assignee: "古野",
    lastMessageAt: "2026-04-21",
    messageIds: ["em-23"]
  },
  {
    id: "et-16",
    companyId: "c-jrq",
    contractId: "k-jrq-hyogikai",
    subject: "テーマ案へのコメント",
    status: "in_progress",
    assignee: "古野",
    slaDeadline: "2026-04-29",
    lastMessageAt: "2026-04-23",
    messageIds: ["em-24"]
  }
];

// ─────────────────────────────────────────────
// メッセージ
// ─────────────────────────────────────────────
export const emailMessages: EmailMessage[] = [
  {
    id: "em-1",
    threadId: "et-1",
    from: "tanaka@aeon-kyushu.jp",
    to: ["furuno@neo.example.com"],
    cc: [],
    sentAt: "2026-04-22T10:12:00+09:00",
    body: "古野様\n\nお世話になっております。第15回講義について、佐藤課長が出張のため欠席となります。代替で別スタッフが参加できればと考えておりますが可否をご確認いただけますでしょうか。\n\n田中",
    direction: "inbound"
  },
  {
    id: "em-2",
    threadId: "et-1",
    from: "furuno@neo.example.com",
    to: ["tanaka@aeon-kyushu.jp"],
    cc: [],
    sentAt: "2026-04-22T14:30:00+09:00",
    body: "田中様\n\nご連絡ありがとうございます。代替参加可能か講師に確認の上、明日中にご返信いたします。\n\n古野",
    direction: "outbound"
  },
  {
    id: "em-3",
    threadId: "et-2",
    from: "inoue@fukuokabank.co.jp",
    to: ["furuno@neo.example.com"],
    cc: [],
    sentAt: "2026-04-21T09:00:00+09:00",
    body: "契約書の押印が完了しました。本日中に郵送いたします。",
    direction: "inbound"
  },
  {
    id: "em-4",
    threadId: "et-2",
    from: "furuno@neo.example.com",
    to: ["inoue@fukuokabank.co.jp"],
    cc: [],
    sentAt: "2026-04-23T16:00:00+09:00",
    body: "ご連絡ありがとうございます。受領後、入金スケジュールについて改めてご案内します。",
    direction: "outbound"
  },
  {
    id: "em-5",
    threadId: "et-3",
    from: "watanabe@toto.co.jp",
    to: ["furuno@neo.example.com"],
    cc: [],
    sentAt: "2026-04-20T13:00:00+09:00",
    body: "派遣者3名のリストをお送りします。添付ファイルをご確認ください。",
    direction: "inbound"
  },
  {
    id: "em-6",
    threadId: "et-3",
    from: "furuno@neo.example.com",
    to: ["watanabe@toto.co.jp"],
    cc: [],
    sentAt: "2026-04-21T10:00:00+09:00",
    body: "リスト受領しました。ありがとうございます。",
    direction: "outbound"
  },
  {
    id: "em-7",
    threadId: "et-4",
    from: "matsuda@neo.example.com",
    to: ["nishida@levias.co.jp"],
    cc: [],
    sentAt: "2026-04-20T15:30:00+09:00",
    body: "Day1の会場でWi-Fi仕様についてご確認お願いします。",
    direction: "outbound"
  },
  {
    id: "em-8",
    threadId: "et-5",
    from: "matsuda@neo.example.com",
    to: ["saibugas-staff@saibugas.co.jp"],
    cc: [],
    sentAt: "2026-04-17T11:00:00+09:00",
    body: "第6回講義のフィードバックシートを共有します。",
    direction: "outbound"
  },
  {
    id: "em-9",
    threadId: "et-5",
    from: "saibugas-staff@saibugas.co.jp",
    to: ["matsuda@neo.example.com"],
    cc: [],
    sentAt: "2026-04-18T09:30:00+09:00",
    body: "確認しました。問題ございません。",
    direction: "inbound"
  },
  {
    id: "em-10",
    threadId: "et-6",
    from: "yokoyama@ncbank.co.jp",
    to: ["miki@neo.example.com"],
    cc: [],
    sentAt: "2026-04-22T17:00:00+09:00",
    body: "固定メンバーの1名が異動となりまして、後任を立てる形で進めたくご相談です。",
    direction: "inbound"
  },
  {
    id: "em-11",
    threadId: "et-7",
    from: "miki@neo.example.com",
    to: ["jrq-staff@jrkyushu.co.jp"],
    cc: [],
    sentAt: "2026-04-18T14:00:00+09:00",
    body: "中間評価会の候補日を3つお送りします。",
    direction: "outbound"
  },
  {
    id: "em-12",
    threadId: "et-7",
    from: "jrq-staff@jrkyushu.co.jp",
    to: ["miki@neo.example.com"],
    cc: [],
    sentAt: "2026-04-19T10:00:00+09:00",
    body: "5月10日でお願いします。",
    direction: "inbound"
  },
  {
    id: "em-13",
    threadId: "et-8",
    from: "inoue@fukuokabank.co.jp",
    to: ["furuno@neo.example.com"],
    cc: ["mori@fukuokabank.co.jp"],
    sentAt: "2026-04-23T18:00:00+09:00",
    body: "Kickoff資料の最新版を共有いただけますか。社内回覧に必要です。",
    direction: "inbound"
  },
  {
    id: "em-14",
    threadId: "et-9",
    from: "tanaka@ffg.co.jp",
    to: ["furuno@neo.example.com"],
    cc: [],
    sentAt: "2026-04-23T11:00:00+09:00",
    body: "古野様\n\n来期の更新について、現状の予算では継続が難しく、見送りも検討しているところです。一度ご相談の場をいただけますでしょうか。\n\n田中",
    direction: "inbound"
  },
  {
    id: "em-15",
    threadId: "et-10",
    from: "tanaka@aeon-kyushu.jp",
    to: ["furuno@neo.example.com"],
    cc: [],
    sentAt: "2026-04-24T10:00:00+09:00",
    body: "第15回のキックオフを実施しました。事前準備のおかげで滞りなく進行できました。",
    direction: "inbound"
  },
  {
    id: "em-16",
    threadId: "et-10",
    from: "furuno@neo.example.com",
    to: ["tanaka@aeon-kyushu.jp"],
    cc: [],
    sentAt: "2026-04-24T11:30:00+09:00",
    body: "実施完了のご連絡ありがとうございます。次回の準備を進めます。",
    direction: "outbound"
  },
  {
    id: "em-17",
    threadId: "et-11",
    from: "watanabe@toto.co.jp",
    to: ["furuno@neo.example.com"],
    cc: [],
    sentAt: "2026-04-20T09:00:00+09:00",
    body: "古野様\n\n弊社の窓口担当である渡辺が5月より別部署へ異動となります。後任は同部の伊藤が引き継ぎますので、改めてご紹介の場を設けさせていただきます。\n\n渡辺",
    direction: "inbound"
  },
  {
    id: "em-18",
    threadId: "et-12",
    from: "yamae-mgr@yamae.co.jp",
    to: ["matsuda@neo.example.com"],
    cc: [],
    sentAt: "2026-04-23T08:30:00+09:00",
    body: "次回の定例ですが、社内会議とぶつかってしまい、来週まで日程を再調整させていただきたく。",
    direction: "inbound"
  },
  {
    id: "em-19",
    threadId: "et-12",
    from: "matsuda@neo.example.com",
    to: ["yamae-mgr@yamae.co.jp"],
    cc: [],
    sentAt: "2026-04-23T09:30:00+09:00",
    body: "承知いたしました。候補日を改めてご連絡いたします。",
    direction: "outbound"
  },
  {
    id: "em-20",
    threadId: "et-13",
    from: "city-staff@city.fukuoka.lg.jp",
    to: ["furuno@neo.example.com"],
    cc: [],
    sentAt: "2026-04-24T13:00:00+09:00",
    body: "古野様\n\n次年度予算の編成過程で、評議会の継続が困難になりました。キャンセル相当の取り扱いとなる可能性があり、苦慮しております。改めてご相談させてください。",
    direction: "inbound"
  },
  {
    id: "em-21",
    threadId: "et-14",
    from: "kyudenko-cs@kyudenko.co.jp",
    to: ["furuno@neo.example.com"],
    cc: [],
    sentAt: "2026-04-22T15:00:00+09:00",
    body: "事前アンケートですが、参加者から「設問が抽象的で困っている」との声が上がっております。",
    direction: "inbound"
  },
  {
    id: "em-22",
    threadId: "et-14",
    from: "furuno@neo.example.com",
    to: ["kyudenko-cs@kyudenko.co.jp"],
    cc: [],
    sentAt: "2026-04-22T17:00:00+09:00",
    body: "ご共有ありがとうございます。来週までに設問の見直し案をお送りします。",
    direction: "outbound"
  },
  {
    id: "em-23",
    threadId: "et-15",
    from: "inoue@fukuokabank.co.jp",
    to: ["furuno@neo.example.com"],
    cc: [],
    sentAt: "2026-04-21T16:00:00+09:00",
    body: "受講者から「ケーススタディが業務に直結する」との好意的なフィードバックが多く寄せられました。",
    direction: "inbound"
  },
  {
    id: "em-24",
    threadId: "et-16",
    from: "jrq-staff@jrkyushu.co.jp",
    to: ["furuno@neo.example.com"],
    cc: [],
    sentAt: "2026-04-23T14:00:00+09:00",
    body: "次回テーマの方向性について、来週までにフィードバックをお戻しします。",
    direction: "inbound"
  }
];

// ─────────────────────────────────────────────
// AI抽出（pending 8件、approved 2件、rejected 2件）
// ─────────────────────────────────────────────
export const aiExtractions: AiExtraction[] = [
  {
    id: "ax-1",
    threadId: "et-2",
    messageId: "em-3",
    type: "onboarding_task_done",
    targetId: "k-fukugin-commu-contract-contract_return",
    suggestion: "「契約書回収」を完了に更新（押印完了の連絡あり）",
    confidence: 0.92,
    status: "pending",
    createdAt: "2026-04-21T09:30:00+09:00"
  },
  {
    id: "ax-2",
    threadId: "et-1",
    messageId: "em-1",
    type: "negative_signal",
    targetId: "k-aeon-academia",
    suggestion: "佐藤課長の欠席が継続。出席率の悪化リスクあり",
    confidence: 0.78,
    status: "pending",
    createdAt: "2026-04-22T10:30:00+09:00"
  },
  {
    id: "ax-3",
    threadId: "et-1",
    messageId: "em-1",
    type: "next_action",
    targetId: "k-aeon-academia",
    suggestion: "ゲスト参加可否を講師に確認し、明日までに返信",
    confidence: 0.88,
    status: "pending",
    createdAt: "2026-04-22T10:35:00+09:00"
  },
  {
    id: "ax-4",
    threadId: "et-6",
    messageId: "em-10",
    type: "stakeholder_change",
    targetId: "c-nccb",
    suggestion: "固定メンバー1名が異動・後任への差し替え",
    confidence: 0.85,
    status: "pending",
    createdAt: "2026-04-22T17:30:00+09:00"
  },
  {
    id: "ax-5",
    threadId: "et-3",
    messageId: "em-5",
    type: "onboarding_task_done",
    targetId: "k-toto-academia-participant-participant_list",
    suggestion: "「派遣者リスト受領」を完了に更新",
    confidence: 0.95,
    status: "approved",
    createdAt: "2026-04-20T13:30:00+09:00"
  },
  {
    id: "ax-6",
    threadId: "et-5",
    messageId: "em-9",
    type: "next_action",
    targetId: "k-saibugas-academia",
    suggestion: "第7回講義のスケジュール案を5月初旬に共有",
    confidence: 0.62,
    status: "rejected",
    createdAt: "2026-04-18T10:00:00+09:00"
  },
  {
    id: "ax-7",
    threadId: "et-9",
    messageId: "em-14",
    type: "negative_signal",
    targetId: "c-ffg",
    suggestion: "「更新見送り検討中」の発言。Red化候補",
    confidence: 0.91,
    status: "pending",
    createdAt: "2026-04-23T11:30:00+09:00"
  },
  {
    id: "ax-8",
    threadId: "et-10",
    messageId: "em-15",
    type: "onboarding_task_done",
    targetId: "k-aeon-academia-course_setup-schedule",
    suggestion: "「第15回キックオフ」を実施済みとして完了化",
    confidence: 0.93,
    status: "pending",
    createdAt: "2026-04-24T10:30:00+09:00"
  },
  {
    id: "ax-9",
    threadId: "et-11",
    messageId: "em-17",
    type: "stakeholder_change",
    targetId: "c-toto",
    suggestion: "窓口担当・渡辺氏が異動。後任伊藤氏への引き継ぎ",
    confidence: 0.94,
    status: "pending",
    createdAt: "2026-04-20T09:30:00+09:00"
  },
  {
    id: "ax-10",
    threadId: "et-13",
    messageId: "em-20",
    type: "negative_signal",
    targetId: "c-fukuokashi",
    suggestion: "次年度予算でのキャンセル示唆。Red化判断が必要",
    confidence: 0.89,
    status: "pending",
    createdAt: "2026-04-24T13:30:00+09:00"
  },
  {
    id: "ax-11",
    threadId: "et-14",
    messageId: "em-21",
    type: "negative_signal",
    targetId: "c-kyudenko",
    suggestion: "事前アンケートに対し参加者が不満。設計見直し要",
    confidence: 0.74,
    status: "pending",
    createdAt: "2026-04-22T15:30:00+09:00"
  },
  {
    id: "ax-12",
    threadId: "et-16",
    messageId: "em-24",
    type: "next_action",
    targetId: "k-jrq-hyogikai",
    suggestion: "テーマ案フィードバックを来週まで待つ・リマインド予約",
    confidence: 0.81,
    status: "pending",
    createdAt: "2026-04-23T14:30:00+09:00"
  },
  {
    id: "ax-13",
    threadId: "et-7",
    messageId: "em-12",
    type: "next_action",
    targetId: "k-jrq-academia",
    suggestion: "中間評価会を5月10日で確定。社内アサインを進める",
    confidence: 0.96,
    status: "approved",
    createdAt: "2026-04-19T10:30:00+09:00"
  },
  {
    id: "ax-14",
    threadId: "et-12",
    messageId: "em-18",
    type: "next_action",
    targetId: "c-yamae",
    suggestion: "次回定例の候補日を再提示",
    confidence: 0.55,
    status: "rejected",
    createdAt: "2026-04-23T08:45:00+09:00"
  }
];

// ─────────────────────────────────────────────
// AIモック関数
// ─────────────────────────────────────────────
// ⚠️ AI処理はすべてモックです。実装時は Claude API 呼び出しに差し替えてください。

const KEYWORDS: { type: AiExtractionType; words: string[] }[] = [
  { type: "onboarding_task_done", words: ["キックオフ", "日程確定", "実施しました", "完了しました", "押印が完了", "受領しました"] },
  { type: "stakeholder_change", words: ["異動", "退職", "離任", "後任", "担当が変わ"] },
  { type: "negative_signal", words: ["不満", "困っている", "見送り", "キャンセル", "難しく", "解約"] },
  { type: "next_action", words: ["来週まで", "次回", "期限", "までに", "リスケ"] },
  { type: "renewal_signal", words: ["更新", "継続", "来年度", "見送り", "解約"] }
];

// 決定論的な擬似ランダム（confidence 用）
function pseudoConfidence(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  // 0.60 〜 0.95
  return Math.round((0.6 + (Math.abs(h) % 1000) / 1000 * 0.35) * 100) / 100;
}

/**
 * 受信メールから AI 抽出を生成（モック）。
 * 実装時は Claude API でメッセージ本文を解析して抽出してください。
 * - キーワード辞書で type を仮判定
 * - 確信度は 0.6〜0.95 の決定論的擬似ランダム
 */
export function mockExtractFromEmail(
  message: EmailMessage,
  context: {
    thread: EmailThread;
    company?: Company;
    contract?: Contract;
    onboardingTasks?: ContractOnboardingItem[];
    stakeholders?: Stakeholder[];
  }
): AiExtraction[] {
  if (message.direction !== "inbound") return [];
  const results: AiExtraction[] = [];
  const body = message.body;
  KEYWORDS.forEach((rule, ruleIdx) => {
    const hit = rule.words.find((w) => body.includes(w));
    if (!hit) return;
    const seed = `${message.id}-${rule.type}-${hit}`;
    const confidence = pseudoConfidence(seed);
    let suggestion = "";
    let targetId: string | undefined;
    switch (rule.type) {
      case "onboarding_task_done":
        suggestion = `「${hit}」の文言からタスク完了を検知`;
        targetId = context.contract?.id;
        break;
      case "stakeholder_change":
        suggestion = `関係者の変更（${hit}）を検知。Stakeholder更新を提案`;
        targetId = context.company?.id;
        break;
      case "negative_signal":
        suggestion = `ネガティブシグナル（${hit}）を検出。Red化判定を要検討`;
        targetId = context.company?.id;
        break;
      case "next_action":
        suggestion = `次アクションキーワード（${hit}）を検出。タスク化候補`;
        targetId = context.contract?.id;
        break;
      case "renewal_signal":
        suggestion = `更新シグナル（${hit}）を検出。更新ウォッチリスト候補`;
        targetId = context.contract?.id;
        break;
    }
    results.push({
      id: `ax-mock-${message.id}-${ruleIdx}`,
      threadId: context.thread.id,
      messageId: message.id,
      type: rule.type,
      targetId,
      suggestion,
      confidence,
      status: "pending",
      createdAt: message.sentAt
    });
  });
  return results;
}

/**
 * AI 返信下書きを生成（モック）。
 * 実装時は Claude API でスレッドコンテキスト込みのドラフトに差し替えてください。
 */
export function mockGenerateReplyDraft(
  thread: EmailThread,
  lastMessage: EmailMessage
): string {
  const fromName = lastMessage.from.split("@")[0];
  return [
    `${fromName} 様`,
    "",
    "お世話になっております。NEO の " + thread.assignee + " です。",
    `「${thread.subject}」につきましてご連絡ありがとうございます。`,
    "",
    "内容を社内で確認の上、改めてご返信差し上げます。",
    "今しばらくお待ちいただけますと幸いです。",
    "",
    "引き続きどうぞよろしくお願いいたします。",
    "",
    thread.assignee
  ].join("\n");
}
