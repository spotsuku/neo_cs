// 派遣者・セッション・出席記録のダミーエンティティ
// 当面は契約に紐づく demo データのみ。画面組込みは Step 7 で行う。

import type { ProductCode } from "./data";
import { allContracts } from "./onboarding";
import { surveyResponses, surveys as allSurveysData } from "./surveys";

export type ParticipantSeniority = "young" | "mid" | "senior" | "exec";

export type Participant = {
  id: string;
  companyId: string;
  contractId: string;
  name: string;
  email: string;
  role?: string;
  status: "active" | "inactive" | "dropped";
  joinedAt: string;
  leftAt?: string;
  department?: string;
  seniority?: ParticipantSeniority;
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
export const participants: Participant[] = [
  // c-aeon ACADEMIA（佐藤課長は欠席多め）
  { id: "pa-aeon-1", companyId: "c-aeon", contractId: "k-aeon-academia", name: "田中 太郎", email: "tanaka@aeon-kyushu.jp", role: "人事部長", status: "active", joinedAt: "2025-09-01", department: "人事部", seniority: "exec" },
  { id: "pa-aeon-2", companyId: "c-aeon", contractId: "k-aeon-academia", name: "佐藤 直子", email: "sato@aeon-kyushu.jp", role: "経営企画課長", status: "active", joinedAt: "2025-09-01", department: "経営企画部", seniority: "senior" },
  { id: "pa-aeon-3", companyId: "c-aeon", contractId: "k-aeon-academia", name: "高橋 健", email: "takahashi@aeon-kyushu.jp", role: "店舗運営マネージャー", status: "active", joinedAt: "2025-09-01", department: "店舗運営部", seniority: "mid" },

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

export const sessions: Session[] = baseSessions.map((s) => ({
  ...s,
  expectedParticipantIds: participants
    .filter((p) => p.contractId === s.contractId)
    .map((p) => p.id)
}));

// ─────────────────────────────────────────────
// 出席記録（c-aeon の佐藤課長は欠席多め）
// ─────────────────────────────────────────────
export const attendanceRecords: AttendanceRecord[] = [
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
