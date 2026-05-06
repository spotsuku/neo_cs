// 派遣者・セッション・出席記録のダミーエンティティ
// 当面は契約に紐づく demo データのみ。画面組込みは Step 7 で行う。

import type { ProductCode } from "./data";
import { allContracts } from "./onboarding";
import { surveyResponses, surveys as allSurveysData } from "./surveys";
import type {
  Contact,
  ContactFunction,
  ContactCommunityTier,
  ContactPersonality,
  ContactRoleLevel,
  ContactRoleScope
} from "./entities";

export type ParticipantSeniority = "young" | "mid" | "senior" | "exec";

// seniority → ロール のヒューリスティック写像（fallback 用）
function inferRoleLevelFromSeniority(
  seniority?: ParticipantSeniority
): ContactRoleLevel {
  switch (seniority) {
    case "exec":
      return "executive";
    case "senior":
      return "lead";
    case "mid":
    case "young":
    default:
      return "member";
  }
}

// 派遣者の組織ロール（顧客企業の組織図ベース・出席対象の属性指定に使う）
// 旧 API: 後方互換のため残置
export function inferRoleLevel(p: {
  seniority?: ParticipantSeniority;
}): ContactRoleLevel {
  return inferRoleLevelFromSeniority(p.seniority);
}

// 役職レベルのスコア（昇順 = 上位）
const ROLE_LEVEL_RANK: Record<ContactRoleLevel, number> = {
  executive: 0,
  approver: 1,
  lead: 2,
  member: 3
};

/**
 * 派遣者の組織ロールを「組織図(Contact.roles)優先」で解決する。
 *
 * 解決順:
 *   1. participant.linkedContactId → Contact.roles[]
 *      - scope === product かつ (cycleNo 未指定 or cycleNo === currentCycle)
 *      - scope === "overall" は事業に依存しないので scope=product と同等扱い（fallback）
 *      - 複数該当する場合は最も上位のレベル（executive > approver > lead > member）を採用
 *   2. fallback: participant.seniority から推定
 */
export function resolveParticipantRole(
  p: { linkedContactId?: string; seniority?: ParticipantSeniority },
  opts: {
    contacts: Contact[];
    productScope: ContactRoleScope; // ProductCode を渡す
    currentCycle?: number;
  }
): ContactRoleLevel {
  if (p.linkedContactId) {
    const c = opts.contacts.find((x) => x.id === p.linkedContactId);
    const roles = c?.roles ?? [];
    const matches = roles.filter((r) => {
      const scopeMatch = r.scope === opts.productScope || r.scope === "overall";
      if (!scopeMatch) return false;
      // 期: 未指定なら全期共通、指定があれば currentCycle と比較
      if (r.cycleNo == null) return true;
      if (opts.currentCycle == null) return true;
      return r.cycleNo === opts.currentCycle;
    });
    if (matches.length > 0) {
      // 最上位のロールを返す
      matches.sort(
        (a, b) => ROLE_LEVEL_RANK[a.level] - ROLE_LEVEL_RANK[b.level]
      );
      return matches[0].level;
    }
  }
  return inferRoleLevelFromSeniority(p.seniority);
}

export const ROLE_LEVEL_LABEL: Record<ContactRoleLevel, string> = {
  executive: "担当役員",
  approver: "決裁者",
  lead: "担当責任者",
  member: "担当者"
};

export const ROLE_LEVEL_ORDER: ContactRoleLevel[] = [
  "executive",
  "approver",
  "lead",
  "member"
];

export type Participant = {
  id: string;
  companyId: string;
  contractId: string;
  name: string;
  email: string;
  /** 役職や肩書 (兼務可) */
  role?: string;
  status: "active" | "inactive" | "dropped";
  joinedAt: string;
  leftAt?: string;
  department?: string;
  seniority?: ParticipantSeniority;
  // ── 顧客プロファイル拡張 (担当者と同等の属性) ──────────
  /** 役職表記 (例: 部長, 課長) — `role` と併用可 */
  title?: string;
  tel?: string;
  /** 機能タグ (契約 / 広報 / 招待 / 連絡) */
  functions?: ContactFunction[];
  /** コミュニティ関与度 (コア / アクティブ / カジュアル / 離脱危機) */
  community?: ContactCommunityTier;
  /** パーソナリティタグ (Playfulシンカー / ナレパン / ガードン) */
  personality?: ContactPersonality[];
  /** 備考 (趣味嗜好・関係性・関係構築のヒントなど) */
  note?: string;
  /** 前期からの継続参加か (true なら 継続バッジを表示) */
  continuingFromPrev?: boolean;
  /** 担当者 (Contact) と同一人物の場合に紐付ける Contact.id (兼任表示用) */
  linkedContactId?: string;
  /** 事業 (商材) ごとに項目が異なるカスタム属性。
   * key は participantFieldSchemas[productCode] の field.key と一致させる */
  customFields?: Record<string, string>;
};

/** 事業 (商材) ごとに参加者カードで表示・編集できる任意項目を定義する */
export type ParticipantFieldType = "text" | "select";
export type ParticipantFieldDef = {
  key: string;
  label: string;
  type: ParticipantFieldType;
  /** select 型のときの選択肢 */
  options?: { value: string; label: string }[];
  hint?: string;
};

/** 商材ごとの「参加者」呼称 */
export const participantTermByProduct: Record<ProductCode, string> = {
  academia: "アカデミア生",
  hyogikai: "評議員",
  aiken: "参加者",
  commu: "参加者"
};

export const participantFieldSchemas: Record<ProductCode, ParticipantFieldDef[]> = {
  academia: [
    {
      key: "course_focus",
      label: "受講テーマ",
      type: "select",
      options: [
        { value: "leadership", label: "リーダーシップ" },
        { value: "strategy", label: "戦略" },
        { value: "dx", label: "DX推進" },
        { value: "newbiz", label: "新規事業" }
      ]
    },
    { key: "career_goal", label: "キャリア目標", type: "text" }
  ],
  hyogikai: [
    {
      key: "stance",
      label: "委員スタンス",
      type: "select",
      options: [
        { value: "leader", label: "牽引役" },
        { value: "contributor", label: "実務貢献" },
        { value: "observer", label: "オブザーブ" }
      ]
    },
    { key: "topic_interest", label: "関心テーマ", type: "text" }
  ],
  aiken: [
    {
      key: "ai_level",
      label: "AI習熟度",
      type: "select",
      options: [
        { value: "beginner", label: "初学者" },
        { value: "user", label: "活用者" },
        { value: "builder", label: "開発者" }
      ]
    },
    { key: "use_case", label: "業務適用先", type: "text" }
  ],
  commu: [
    {
      key: "community_role",
      label: "担当コミュニティ",
      type: "text",
      hint: "例: 社内勉強会, 外部コミュニティ運営"
    },
    {
      key: "engagement_focus",
      label: "重点施策",
      type: "select",
      options: [
        { value: "kickoff", label: "立ち上げ" },
        { value: "growth", label: "活性化" },
        { value: "retention", label: "定着" }
      ]
    }
  ]
};

export type Session = {
  id: string;
  contractId: string;
  sessionNumber: number;
  scheduledAt: string;
  completedAt?: string;
  title: string;
  expectedParticipantIds: string[];
};

export type AttendanceRecord = {
  id: string;
  participantId: string;
  sessionId: string;
  status: "present" | "absent" | "late" | "excused";
  recordedAt: string;
  recordedBy: string;
  note?: string;
};

// ─────────────────────────────────────────────
// 派遣者（主要契約のみ明示）
// ─────────────────────────────────────────────
const handpickedParticipants: Participant[] = [
  // c-aeon ACADEMIA 第3期 (active) — 兼任あり / カスタム項目入り
  {
    id: "pa-aeon-1", companyId: "c-aeon", contractId: "k-c-aeon-academia-3",
    name: "田中 太郎", email: "tanaka@aeon-kyushu.jp",
    role: "人事部長", title: "部長",
    status: "active", joinedAt: "2026-04-01",
    department: "人事部", seniority: "exec",
    linkedContactId: "p-a1",
    continuingFromPrev: true,
    community: "core",
    personality: ["playful_thinker"],
    functions: ["contract", "liaison"],
    note: "1期から継続。社内推進の旗振り役で、案内文作成も自発的に巻き取ってくれる。",
    customFields: { course_focus: "leadership", career_goal: "経営層への登用" }
  },
  {
    id: "pa-aeon-2", companyId: "c-aeon", contractId: "k-c-aeon-academia-3",
    name: "佐藤 直子", email: "sato@aeon-kyushu.jp",
    role: "経営企画課長", title: "課長",
    status: "active", joinedAt: "2026-04-01",
    department: "経営企画部", seniority: "senior",
    community: "casual",
    note: "出張が多く欠席が増えている。同期がフォロー中。",
    customFields: { course_focus: "strategy", career_goal: "中期経営計画担当" }
  },
  {
    id: "pa-aeon-3", companyId: "c-aeon", contractId: "k-c-aeon-academia-3",
    name: "高橋 健", email: "takahashi@aeon-kyushu.jp",
    role: "店舗運営マネージャー",
    status: "active", joinedAt: "2026-04-01",
    department: "店舗運営部", seniority: "mid",
    community: "active",
    personality: ["narepan"],
    customFields: { course_focus: "newbiz", career_goal: "店舗DX推進" }
  },

  // c-aeon ACADEMIA 第2期 (renewed) — 田中太郎は継続
  {
    id: "pa-aeon-prev1-1", companyId: "c-aeon", contractId: "k-c-aeon-academia-2",
    name: "田中 太郎", email: "tanaka@aeon-kyushu.jp",
    role: "人事部長", title: "部長",
    status: "active", joinedAt: "2025-04-01", leftAt: "2026-03-31",
    department: "人事部", seniority: "exec",
    linkedContactId: "p-a1",
    continuingFromPrev: true,
    community: "core",
    customFields: { course_focus: "leadership", career_goal: "経営層への登用" }
  },
  {
    id: "pa-aeon-prev1-2", companyId: "c-aeon", contractId: "k-c-aeon-academia-2",
    name: "佐藤 直子", email: "sato@aeon-kyushu.jp",
    role: "経営企画課長",
    status: "active", joinedAt: "2025-04-01", leftAt: "2026-03-31",
    department: "経営企画部", seniority: "senior",
    customFields: { course_focus: "strategy" }
  },
  {
    id: "pa-aeon-prev1-3", companyId: "c-aeon", contractId: "k-c-aeon-academia-2",
    name: "中村 慎一", email: "nakamura@aeon-kyushu.jp",
    role: "新規事業推進", status: "inactive", joinedAt: "2025-04-01", leftAt: "2026-03-31",
    department: "新規事業室", seniority: "mid",
    note: "2期で人事異動により離脱、3期は不参加。",
    customFields: { course_focus: "newbiz" }
  },

  // c-aeon ACADEMIA 第1期 (renewed) — 田中太郎ここから参加
  {
    id: "pa-aeon-prev2-1", companyId: "c-aeon", contractId: "k-c-aeon-academia-1",
    name: "田中 太郎", email: "tanaka@aeon-kyushu.jp",
    role: "人事課長",
    status: "active", joinedAt: "2024-04-01", leftAt: "2025-03-31",
    department: "人事部", seniority: "senior",
    linkedContactId: "p-a1",
    customFields: { course_focus: "leadership" }
  },
  {
    id: "pa-aeon-prev2-2", companyId: "c-aeon", contractId: "k-c-aeon-academia-1",
    name: "斎藤 一", email: "saito@aeon-kyushu.jp",
    role: "営業課長", status: "dropped", joinedAt: "2024-04-01", leftAt: "2024-09-30",
    department: "営業部", seniority: "senior",
    note: "1期途中で病気休職、その後継続せず。",
    customFields: { course_focus: "strategy" }
  },

  // c-toto ACADEMIA
  { id: "pa-toto-1", companyId: "c-toto", contractId: "k-toto-academia", name: "渡辺 翔", email: "watanabe@toto.co.jp", role: "経営企画", status: "active", joinedAt: "2026-05-20", department: "経営企画部", seniority: "senior" },
  { id: "pa-toto-2", companyId: "c-toto", contractId: "k-toto-academia", name: "中村 美咲", email: "nakamura@toto.co.jp", role: "海外営業", status: "active", joinedAt: "2026-05-20", department: "営業部", seniority: "mid" },
  { id: "pa-toto-3", companyId: "c-toto", contractId: "k-toto-academia", name: "木村 拓海", email: "kimura@toto.co.jp", role: "新規事業", status: "active", joinedAt: "2026-05-20", department: "新規事業室", seniority: "young" },

  // c-fukugin commu
  { id: "pa-fukugin-1", companyId: "c-fukugin", contractId: "k-fukugin-commu", name: "井上 真理", email: "inoue@fukuokabank.co.jp", role: "DX推進", status: "active", joinedAt: "2026-04-28", department: "DX推進室", seniority: "senior" },
  { id: "pa-fukugin-2", companyId: "c-fukugin", contractId: "k-fukugin-commu", name: "森 健司", email: "mori@fukuokabank.co.jp", role: "営業企画", status: "active", joinedAt: "2026-04-28", department: "営業部", seniority: "mid" },
  { id: "pa-fukugin-3", companyId: "c-fukugin", contractId: "k-fukugin-commu", name: "林 由佳", email: "hayashi@fukuokabank.co.jp", role: "人材開発", status: "active", joinedAt: "2026-04-28", department: "人事部", seniority: "mid" },
  { id: "pa-fukugin-4", companyId: "c-fukugin", contractId: "k-fukugin-commu", name: "石田 涼", email: "ishida@fukuokabank.co.jp", role: "支店マネージャー", status: "active", joinedAt: "2026-04-28", department: "営業部", seniority: "senior" },
  { id: "pa-fukugin-5", companyId: "c-fukugin", contractId: "k-fukugin-commu", name: "山口 千夏", email: "yamaguchi@fukuokabank.co.jp", role: "リテール戦略", status: "active", joinedAt: "2026-04-28", department: "経営企画部", seniority: "mid" },
  { id: "pa-fukugin-6", companyId: "c-fukugin", contractId: "k-fukugin-commu", name: "藤田 隆", email: "fujita@fukuokabank.co.jp", role: "法人営業", status: "active", joinedAt: "2026-04-28", department: "営業部", seniority: "young" },
  { id: "pa-fukugin-7", companyId: "c-fukugin", contractId: "k-fukugin-commu", name: "岡田 翼", email: "okada@fukuokabank.co.jp", role: "事業戦略", status: "active", joinedAt: "2026-04-28", department: "経営企画部", seniority: "young" },
  { id: "pa-fukugin-8", companyId: "c-fukugin", contractId: "k-fukugin-commu", name: "近藤 葵", email: "kondo@fukuokabank.co.jp", role: "広報", status: "active", joinedAt: "2026-04-28", department: "広報部", seniority: "young" },

  // c-levias aiken
  { id: "pa-levias-1", companyId: "c-levias", contractId: "k-levias-aiken", name: "西田 拓", email: "nishida@levias.co.jp", role: "PdM", status: "active", joinedAt: "2026-05-15", department: "プロダクト部", seniority: "senior" },
  { id: "pa-levias-2", companyId: "c-levias", contractId: "k-levias-aiken", name: "大塚 悠", email: "otsuka@levias.co.jp", role: "エンジニア", status: "active", joinedAt: "2026-05-15", department: "開発部", seniority: "mid" },
  { id: "pa-levias-3", companyId: "c-levias", contractId: "k-levias-aiken", name: "前田 桜", email: "maeda@levias.co.jp", role: "デザイナー", status: "active", joinedAt: "2026-05-15", department: "デザイン部", seniority: "young" },

  // c-nccb hyogikai
  { id: "pa-nccb-1", companyId: "c-nccb", contractId: "k-nccb-hyogikai", name: "横山 大樹", email: "yokoyama@ncbank.co.jp", role: "経営企画部長", status: "active", joinedAt: "2026-05-10", department: "経営企画部", seniority: "exec" },
  { id: "pa-nccb-2", companyId: "c-nccb", contractId: "k-nccb-hyogikai", name: "原 由紀", email: "hara@ncbank.co.jp", role: "DX推進室長", status: "active", joinedAt: "2026-05-10", department: "DX推進室", seniority: "senior" },
  { id: "pa-nccb-3", companyId: "c-nccb", contractId: "k-nccb-hyogikai", name: "三浦 健太郎", email: "miura@ncbank.co.jp", role: "リスク管理", status: "active", joinedAt: "2026-05-10", department: "リスク管理部", seniority: "mid" },

  // c-aeon hyogikai (ピボット表デモ拡充)
  { id: "pa-aeon-h1", companyId: "c-aeon", contractId: "k-aeon-hyogikai", name: "山本 浩", email: "yamamoto@aeon-kyushu.jp", role: "取締役", status: "active", joinedAt: "2025-08-01", department: "経営", seniority: "exec" },
  { id: "pa-aeon-h2", companyId: "c-aeon", contractId: "k-aeon-hyogikai", name: "黒田 真央", email: "kuroda@aeon-kyushu.jp", role: "経営戦略", status: "active", joinedAt: "2025-08-01", department: "経営企画部", seniority: "senior" },

  // c-toto aiken (ピボット表デモ拡充)
  { id: "pa-toto-a1", companyId: "c-toto", contractId: "k-toto-aiken", name: "上田 健", email: "ueda@toto.co.jp", role: "技術企画", status: "active", joinedAt: "2026-06-03", department: "技術部", seniority: "senior" },
  { id: "pa-toto-a2", companyId: "c-toto", contractId: "k-toto-aiken", name: "古川 美月", email: "furukawa@toto.co.jp", role: "AI推進", status: "active", joinedAt: "2026-06-03", department: "DX推進室", seniority: "mid" },
  { id: "pa-toto-a3", companyId: "c-toto", contractId: "k-toto-aiken", name: "宮本 大", email: "miyamoto@toto.co.jp", role: "データ基盤", status: "active", joinedAt: "2026-06-03", department: "技術部", seniority: "young" }
];

// ─────────────────────────────────────────────
// セッション（productByCode の sessionCount 程度を生成）
// 主要契約に対して 4 回分のみ明示
// ─────────────────────────────────────────────
const baseSessions: Omit<Session, "expectedParticipantIds">[] = [
  // c-aeon academia
  { id: "s-aeon-1", contractId: "k-aeon-academia", sessionNumber: 1, scheduledAt: "2025-09-15", completedAt: "2025-09-15", title: "Kickoff・第1回講義" },
  { id: "s-aeon-2", contractId: "k-aeon-academia", sessionNumber: 2, scheduledAt: "2025-10-15", completedAt: "2025-10-15", title: "第2回講義" },
  { id: "s-aeon-3", contractId: "k-aeon-academia", sessionNumber: 3, scheduledAt: "2025-11-15", completedAt: "2025-11-15", title: "第3回講義" },
  { id: "s-aeon-4", contractId: "k-aeon-academia", sessionNumber: 4, scheduledAt: "2025-12-15", completedAt: "2025-12-15", title: "第4回講義" },
  { id: "s-aeon-5", contractId: "k-aeon-academia", sessionNumber: 5, scheduledAt: "2026-04-22", completedAt: "2026-04-22", title: "第15回講義" },

  // c-fukugin commu
  { id: "s-fukugin-1", contractId: "k-fukugin-commu", sessionNumber: 1, scheduledAt: "2026-05-12", title: "Kickoff" },
  { id: "s-fukugin-2", contractId: "k-fukugin-commu", sessionNumber: 2, scheduledAt: "2026-06-09", title: "第2回" },

  // c-nccb hyogikai
  { id: "s-nccb-1", contractId: "k-nccb-hyogikai", sessionNumber: 1, scheduledAt: "2026-05-25", title: "初回定例会" },

  // c-aeon hyogikai (ピボット表デモ用)
  { id: "s-aeon-h-1", contractId: "k-aeon-hyogikai", sessionNumber: 1, scheduledAt: "2026-04-10", completedAt: "2026-04-10", title: "第1回 評議会" },
  { id: "s-aeon-h-2", contractId: "k-aeon-hyogikai", sessionNumber: 2, scheduledAt: "2026-04-24", completedAt: "2026-04-24", title: "第2回 評議会" },

  // c-levias aiken
  { id: "s-levias-1", contractId: "k-levias-aiken", sessionNumber: 1, scheduledAt: "2026-04-15", completedAt: "2026-04-15", title: "Kickoff" },
  { id: "s-levias-2", contractId: "k-levias-aiken", sessionNumber: 2, scheduledAt: "2026-04-22", completedAt: "2026-04-22", title: "第2回" },
  { id: "s-levias-3", contractId: "k-levias-aiken", sessionNumber: 3, scheduledAt: "2026-04-29", completedAt: "2026-04-29", title: "第3回" },

  // c-toto aiken
  { id: "s-toto-a-1", contractId: "k-toto-aiken", sessionNumber: 1, scheduledAt: "2026-04-17", completedAt: "2026-04-17", title: "Kickoff" },
  { id: "s-toto-a-2", contractId: "k-toto-aiken", sessionNumber: 2, scheduledAt: "2026-04-24", completedAt: "2026-04-24", title: "第2回" }
];

const handpickedSessions = baseSessions;

// ─────────────────────────────────────────────
// 出席記録（c-aeon の佐藤課長は欠席多め）
// ─────────────────────────────────────────────
const handpickedRecords: AttendanceRecord[] = [
  // s-aeon-1
  { id: "ar-1", participantId: "pa-aeon-1", sessionId: "s-aeon-1", status: "present", recordedAt: "2025-09-15", recordedBy: "古野" },
  { id: "ar-2", participantId: "pa-aeon-2", sessionId: "s-aeon-1", status: "present", recordedAt: "2025-09-15", recordedBy: "古野" },
  { id: "ar-3", participantId: "pa-aeon-3", sessionId: "s-aeon-1", status: "present", recordedAt: "2025-09-15", recordedBy: "古野" },
  // s-aeon-2
  { id: "ar-4", participantId: "pa-aeon-1", sessionId: "s-aeon-2", status: "present", recordedAt: "2025-10-15", recordedBy: "古野" },
  { id: "ar-5", participantId: "pa-aeon-2", sessionId: "s-aeon-2", status: "absent", recordedAt: "2025-10-15", recordedBy: "古野", note: "出張のため欠席" },
  { id: "ar-6", participantId: "pa-aeon-3", sessionId: "s-aeon-2", status: "present", recordedAt: "2025-10-15", recordedBy: "古野" },
  // s-aeon-3
  { id: "ar-7", participantId: "pa-aeon-1", sessionId: "s-aeon-3", status: "present", recordedAt: "2025-11-15", recordedBy: "古野" },
  { id: "ar-8", participantId: "pa-aeon-2", sessionId: "s-aeon-3", status: "absent", recordedAt: "2025-11-15", recordedBy: "古野", note: "業務多忙のため欠席" },
  { id: "ar-9", participantId: "pa-aeon-3", sessionId: "s-aeon-3", status: "late", recordedAt: "2025-11-15", recordedBy: "古野" },
  // s-aeon-4
  { id: "ar-10", participantId: "pa-aeon-1", sessionId: "s-aeon-4", status: "present", recordedAt: "2025-12-15", recordedBy: "古野" },
  { id: "ar-11", participantId: "pa-aeon-2", sessionId: "s-aeon-4", status: "absent", recordedAt: "2025-12-15", recordedBy: "古野", note: "代理出席なし" },
  { id: "ar-12", participantId: "pa-aeon-3", sessionId: "s-aeon-4", status: "present", recordedAt: "2025-12-15", recordedBy: "古野" },
  // s-aeon-5（第15回）
  { id: "ar-13", participantId: "pa-aeon-1", sessionId: "s-aeon-5", status: "present", recordedAt: "2026-04-22", recordedBy: "古野" },
  { id: "ar-14", participantId: "pa-aeon-2", sessionId: "s-aeon-5", status: "absent", recordedAt: "2026-04-22", recordedBy: "古野", note: "出張で欠席、代替参加希望" },
  { id: "ar-15", participantId: "pa-aeon-3", sessionId: "s-aeon-5", status: "present", recordedAt: "2026-04-22", recordedBy: "古野" },

  // c-aeon hyogikai
  { id: "ar-h-1", participantId: "pa-aeon-h1", sessionId: "s-aeon-h-1", status: "present", recordedAt: "2026-04-10", recordedBy: "三木" },
  { id: "ar-h-2", participantId: "pa-aeon-h2", sessionId: "s-aeon-h-1", status: "present", recordedAt: "2026-04-10", recordedBy: "三木" },
  { id: "ar-h-3", participantId: "pa-aeon-h1", sessionId: "s-aeon-h-2", status: "absent", recordedAt: "2026-04-24", recordedBy: "三木", note: "海外出張" },
  { id: "ar-h-4", participantId: "pa-aeon-h2", sessionId: "s-aeon-h-2", status: "present", recordedAt: "2026-04-24", recordedBy: "三木" },

  // c-levias aiken
  { id: "ar-l-1", participantId: "pa-levias-1", sessionId: "s-levias-1", status: "present", recordedAt: "2026-04-15", recordedBy: "松田" },
  { id: "ar-l-2", participantId: "pa-levias-2", sessionId: "s-levias-1", status: "present", recordedAt: "2026-04-15", recordedBy: "松田" },
  { id: "ar-l-3", participantId: "pa-levias-3", sessionId: "s-levias-1", status: "late", recordedAt: "2026-04-15", recordedBy: "松田" },
  { id: "ar-l-4", participantId: "pa-levias-1", sessionId: "s-levias-2", status: "present", recordedAt: "2026-04-22", recordedBy: "松田" },
  { id: "ar-l-5", participantId: "pa-levias-2", sessionId: "s-levias-2", status: "absent", recordedAt: "2026-04-22", recordedBy: "松田", note: "体調不良" },
  { id: "ar-l-6", participantId: "pa-levias-3", sessionId: "s-levias-2", status: "present", recordedAt: "2026-04-22", recordedBy: "松田" },
  { id: "ar-l-7", participantId: "pa-levias-1", sessionId: "s-levias-3", status: "present", recordedAt: "2026-04-29", recordedBy: "松田" },
  { id: "ar-l-8", participantId: "pa-levias-2", sessionId: "s-levias-3", status: "present", recordedAt: "2026-04-29", recordedBy: "松田" },
  { id: "ar-l-9", participantId: "pa-levias-3", sessionId: "s-levias-3", status: "present", recordedAt: "2026-04-29", recordedBy: "松田" },

  // c-toto aiken
  { id: "ar-ta-1", participantId: "pa-toto-a1", sessionId: "s-toto-a-1", status: "present", recordedAt: "2026-04-17", recordedBy: "古野" },
  { id: "ar-ta-2", participantId: "pa-toto-a2", sessionId: "s-toto-a-1", status: "present", recordedAt: "2026-04-17", recordedBy: "古野" },
  { id: "ar-ta-3", participantId: "pa-toto-a3", sessionId: "s-toto-a-1", status: "present", recordedAt: "2026-04-17", recordedBy: "古野" },
  { id: "ar-ta-4", participantId: "pa-toto-a1", sessionId: "s-toto-a-2", status: "present", recordedAt: "2026-04-24", recordedBy: "古野" },
  { id: "ar-ta-5", participantId: "pa-toto-a2", sessionId: "s-toto-a-2", status: "absent", recordedAt: "2026-04-24", recordedBy: "古野", note: "プロジェクト対応" },
  { id: "ar-ta-6", participantId: "pa-toto-a3", sessionId: "s-toto-a-2", status: "present", recordedAt: "2026-04-24", recordedBy: "古野" },

  // c-fukugin commu
  { id: "ar-f-1", participantId: "pa-fukugin-1", sessionId: "s-fukugin-1", status: "present", recordedAt: "2026-05-12", recordedBy: "古野" },
  { id: "ar-f-2", participantId: "pa-fukugin-2", sessionId: "s-fukugin-1", status: "present", recordedAt: "2026-05-12", recordedBy: "古野" },
  { id: "ar-f-3", participantId: "pa-fukugin-3", sessionId: "s-fukugin-1", status: "absent", recordedAt: "2026-05-12", recordedBy: "古野", note: "産休前最終出勤" },
  { id: "ar-f-4", participantId: "pa-fukugin-4", sessionId: "s-fukugin-1", status: "present", recordedAt: "2026-05-12", recordedBy: "古野" }
];

// ─────────────────────────────────────────────
// バルクダミーデータ生成
//   - handpicked にない契約に対して participants/sessions/records を機械生成
//   - 生成は契約IDで決定的（同じ contract に対して常に同じ結果）
//   - 生成パラメータは事業ごとに異なる（受講人数・セッション数・進捗）
// ─────────────────────────────────────────────

// 決定的疑似乱数（mulberry32）
function makeRng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const FAMILY_NAMES = [
  "山田", "鈴木", "佐々木", "中島", "野口", "藤本", "杉山", "石川",
  "村上", "松井", "竹内", "新井", "後藤", "三浦", "今井", "矢野",
  "青木", "金子", "小川", "中川", "島田", "原田", "丸山", "田村"
];
const GIVEN_NAMES = [
  "翔太", "美穂", "拓也", "彩", "亮介", "真由美", "和也", "里奈",
  "雄介", "葵", "達也", "千尋", "悠馬", "望", "颯太", "桃子",
  "智樹", "結衣", "健斗", "玲", "蓮", "由佳", "啓介", "麻衣"
];
const DEPTS_BY_INDEX = [
  "経営企画部", "人事部", "営業部", "DX推進室", "経理部",
  "新規事業室", "技術部", "広報部", "店舗運営部", "リスク管理部"
];
const ROLES = ["主任", "係長", "課長", "次長", "部長", "担当", "マネージャー"];
const SENIORITIES: ParticipantSeniority[] = ["young", "mid", "senior", "exec"];

function offsetIso(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const TODAY_ISO = "2026-04-24";

// 事業ごとの生成パラメータ
//   - sessionsToGenerate は最大5回（列が増えすぎないよう抑制）
//   - 同一事業内では基準日を共通化し、生成セッションの開催日が揃う = 列が重複しない
const PRODUCT_GEN: Record<
  ProductCode,
  { participantCount: [number, number]; sessionsToGenerate: number; spacingDays: number }
> = {
  academia:  { participantCount: [3, 3], sessionsToGenerate: 5, spacingDays: 28 },
  hyogikai:  { participantCount: [2, 4], sessionsToGenerate: 4, spacingDays: 30 },
  aiken:     { participantCount: [3, 6], sessionsToGenerate: 2, spacingDays: 14 },
  commu:     { participantCount: [4, 8], sessionsToGenerate: 3, spacingDays: 21 }
};

// 事業ごとに「今日から逆算した固定アンカー日」を生成。
// 全契約が同じ日付セットを共有することで列の重複を抑える。
function productAnchorDates(product: ProductCode): string[] {
  const cfg = PRODUCT_GEN[product];
  const out: string[] = [];
  for (let i = cfg.sessionsToGenerate - 1; i >= 0; i--) {
    out.push(offsetIso(TODAY_ISO, -i * cfg.spacingDays));
  }
  return out;
}
const PRODUCT_ANCHOR_DATES: Record<ProductCode, string[]> = {
  academia: productAnchorDates("academia"),
  hyogikai: productAnchorDates("hyogikai"),
  aiken: productAnchorDates("aiken"),
  commu: productAnchorDates("commu")
};

const generatedParticipants: Participant[] = [];
const generatedSessionsBase: Omit<Session, "expectedParticipantIds">[] = [];
const generatedRecords: AttendanceRecord[] = [];

const handpickedContractIds = new Set(handpickedParticipants.map((p) => p.contractId));

for (const contract of allContracts) {
  if (handpickedContractIds.has(contract.id)) continue;
  // 解約済みは出席記録不要
  if (contract.status === "churned") continue;

  const rng = makeRng(hashStr(contract.id));
  const cfg = PRODUCT_GEN[contract.product];
  const [minP, maxP] = cfg.participantCount;
  const pCount = Math.floor(rng() * (maxP - minP + 1)) + minP;

  // ── 派遣者 ──
  const contractParticipantIds: string[] = [];
  for (let i = 0; i < pCount; i++) {
    const fam = FAMILY_NAMES[Math.floor(rng() * FAMILY_NAMES.length)];
    const giv = GIVEN_NAMES[Math.floor(rng() * GIVEN_NAMES.length)];
    const dept = DEPTS_BY_INDEX[Math.floor(rng() * DEPTS_BY_INDEX.length)];
    const role = ROLES[Math.floor(rng() * ROLES.length)];
    const sn = SENIORITIES[Math.floor(rng() * SENIORITIES.length)];
    const id = `pa-gen-${contract.id}-${i}`;
    contractParticipantIds.push(id);
    generatedParticipants.push({
      id,
      companyId: contract.companyId,
      contractId: contract.id,
      name: `${fam} ${giv}`,
      email: `${fam.toLowerCase()}${i}@example.jp`,
      role,
      status: "active",
      joinedAt: contract.startDate,
      department: dept,
      seniority: sn
    });
  }

  // ── セッション（事業共通のアンカー日に紐付け、契約開始前の日付はスキップ）──
  const anchors = PRODUCT_ANCHOR_DATES[contract.product];
  const sessionIdsForContract: { id: string; date: string; completed: boolean }[] = [];
  let n = 0;
  for (const date of anchors) {
    if (date < contract.startDate) continue; // 契約開始前は除外
    if (contract.endDate && date > contract.endDate) continue;
    n++;
    const completed = date <= TODAY_ISO;
    const sid = `s-gen-${contract.id}-${n}`;
    sessionIdsForContract.push({ id: sid, date, completed });
    generatedSessionsBase.push({
      id: sid,
      contractId: contract.id,
      sessionNumber: n,
      scheduledAt: date,
      completedAt: completed ? date : undefined,
      title: n === 1 ? "Kickoff" : `第${n}回`
    });
  }

  // ── 出席記録（実施済セッションのみ）──
  // 契約のヘルススコアに応じて欠席率を変える: red 25% / yellow 12% / green 5%
  const baseAbsentRate =
    contract.healthScore?.color === "red"
      ? 0.25
      : contract.healthScore?.color === "yellow"
      ? 0.12
      : 0.05;
  for (const s of sessionIdsForContract) {
    if (!s.completed) continue;
    for (const pid of contractParticipantIds) {
      const r = rng();
      let status: AttendanceRecord["status"];
      if (r < baseAbsentRate) status = "absent";
      else if (r < baseAbsentRate + 0.05) status = "late";
      else if (r < baseAbsentRate + 0.07) status = "excused";
      else status = "present";
      generatedRecords.push({
        id: `ar-gen-${s.id}-${pid}`,
        participantId: pid,
        sessionId: s.id,
        status,
        recordedAt: s.date,
        recordedBy: "auto"
      });
    }
  }
}

// ─────────────────────────────────────────────
// 公開エクスポート（手書き + 自動生成のマージ）
// ─────────────────────────────────────────────
export const participants: Participant[] = [
  ...handpickedParticipants,
  ...generatedParticipants
];

const allSessionsBase = [...handpickedSessions, ...generatedSessionsBase];
export const sessions: Session[] = allSessionsBase.map((s) => ({
  ...s,
  expectedParticipantIds: participants
    .filter((p) => p.contractId === s.contractId)
    .map((p) => p.id)
}));

export const attendanceRecords: AttendanceRecord[] = [
  ...handpickedRecords,
  ...generatedRecords
];

// ─────────────────────────────────────────────
// ヘルパー関数
// ─────────────────────────────────────────────

export function participantEngagement(participantId: string): {
  attendanceRate: number;
  totalSessions: number;
  attended: number;
  trend: { sessionDate: string; sessionTitle: string; status: "present" | "absent" | "late" | "not_expected" }[];
} {
  const p = participants.find((x) => x.id === participantId);
  const targetSessions = sessions
    .filter((s) => s.contractId === p?.contractId)
    .filter((s) => !!s.completedAt)
    .sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : 1));

  const trend = targetSessions.map((s) => {
    const expected = s.expectedParticipantIds.includes(participantId);
    if (!expected) {
      return {
        sessionDate: s.scheduledAt,
        sessionTitle: s.title,
        status: "not_expected" as const
      };
    }
    const rec = attendanceRecords.find((r) => r.sessionId === s.id && r.participantId === participantId);
    return {
      sessionDate: s.scheduledAt,
      sessionTitle: s.title,
      status: (rec?.status ?? "absent") as "present" | "absent" | "late"
    };
  });

  const expectedTrend = trend.filter((t) => t.status !== "not_expected");
  const attended = expectedTrend.filter((t) => t.status === "present" || t.status === "late").length;
  const totalSessions = expectedTrend.length;
  const attendanceRate = totalSessions === 0 ? 0 : attended / totalSessions;

  return { attendanceRate, totalSessions, attended, trend };
}

export function contractEngagementSummary(contractId: string): {
  participantCount: number;
  avgAttendanceRate: number;
  participantStats: { participantId: string; name: string; rate: number }[];
} {
  const ps = participants.filter((p) => p.contractId === contractId);
  const stats = ps.map((p) => {
    const eng = participantEngagement(p.id);
    return { participantId: p.id, name: p.name, rate: eng.attendanceRate };
  });
  const avg = stats.length === 0 ? 0 : stats.reduce((s, x) => s + x.rate, 0) / stats.length;
  return {
    participantCount: ps.length,
    avgAttendanceRate: avg,
    participantStats: stats.sort((a, b) => b.rate - a.rate)
  };
}

export function productAttendanceByAttribute(
  product: ProductCode,
  axis: "department" | "seniority"
): {
  axisValue: string;
  totalSessions: number;
  attendanceRate: number;
  participantCount: number;
  trend: { sessionMonth: string; rate: number }[];
}[] {
  const productContractIds = new Set(
    allContracts.filter((c) => c.product === product).map((c) => c.id)
  );
  const productParticipants = participants.filter((p) => productContractIds.has(p.contractId));
  const productSessions = sessions
    .filter((s) => productContractIds.has(s.contractId))
    .filter((s) => !!s.completedAt);

  const groups = new Map<string, Participant[]>();
  productParticipants.forEach((p) => {
    const key = (axis === "department" ? p.department : p.seniority) ?? "未分類";
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  });

  const out: {
    axisValue: string;
    totalSessions: number;
    attendanceRate: number;
    participantCount: number;
    trend: { sessionMonth: string; rate: number }[];
  }[] = [];

  groups.forEach((memberList, axisValue) => {
    const memberIds = new Set(memberList.map((m) => m.id));
    let attended = 0;
    let expectedTotal = 0;
    const monthBuckets = new Map<string, { attended: number; expected: number }>();

    productSessions.forEach((s) => {
      const month = s.scheduledAt.slice(0, 7);
      const expectedHere = s.expectedParticipantIds.filter((id) => memberIds.has(id));
      if (expectedHere.length === 0) return;
      expectedTotal += expectedHere.length;
      const attendedHere = expectedHere.filter((pid) => {
        const rec = attendanceRecords.find((r) => r.sessionId === s.id && r.participantId === pid);
        return rec?.status === "present" || rec?.status === "late";
      }).length;
      attended += attendedHere;
      const bucket = monthBuckets.get(month) ?? { attended: 0, expected: 0 };
      bucket.attended += attendedHere;
      bucket.expected += expectedHere.length;
      monthBuckets.set(month, bucket);
    });

    const trend = Array.from(monthBuckets.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([sessionMonth, b]) => ({
        sessionMonth,
        rate: b.expected === 0 ? 0 : b.attended / b.expected
      }));

    out.push({
      axisValue,
      totalSessions: productSessions.length,
      attendanceRate: expectedTotal === 0 ? 0 : attended / expectedTotal,
      participantCount: memberList.length,
      trend
    });
  });

  return out.sort((a, b) => b.participantCount - a.participantCount);
}

// 参加者のアンケート回答率（その契約のSurvey一覧に対する回答数）
export function participantSurveyResponseRate(participantId: string): {
  rate: number;
  responded: number;
  totalSurveys: number;
} {
  const p = participants.find((x) => x.id === participantId);
  if (!p) return { rate: 0, responded: 0, totalSurveys: 0 };
  const contractSurveys = allSurveysData.filter((s) => s.contractId === p.contractId);
  const responses = surveyResponses.filter((r) => r.participantId === participantId);
  const respondedSurveyIds = new Set(responses.map((r) => r.surveyId));
  const totalSurveys = contractSurveys.length;
  const responded = contractSurveys.filter((s) => respondedSurveyIds.has(s.id)).length;
  return {
    rate: totalSurveys === 0 ? 0 : responded / totalSurveys,
    responded,
    totalSurveys
  };
}
