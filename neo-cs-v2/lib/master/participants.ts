// 派遣者 (Participant) のマスタ型 + ロール解決ユーティリティ
// (旧 lib/mock/participants.ts から master へ切り出し)
//
// 型定義・スキーマ・ロール解決関数は本番 (REPO_DRIVER=supabase) でも使うので
// master 配下に置く。seed 配列 (participants / sessions / attendanceRecords) は
// mock 専用なので lib/mock/participants.ts に残す。

import type { ProductCode } from "./products";
import type {
  Contact,
  ContactFunction,
  ContactCommunityTier,
  ContactPersonality,
  ContactRoleLevel,
  ContactRoleScope
} from "@/lib/mock/entities";

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
