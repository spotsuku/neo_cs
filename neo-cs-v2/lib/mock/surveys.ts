// アンケート (Survey) の **mock seed** + AI 処理モック。
//
// 型定義 (SurveyQuestion / SurveyTemplate / SurveySchedule / Survey / SurveyResponse /
// SurveyInsight / ColumnMapping / SurveyImport 等) と純粋な集計関数
// (aggregateSurveyFrom / describeTrigger / describeRespondentTarget) は
// `@/lib/master/surveys` に移動済。新規コードはそちらから import すること。
// このファイルには **mock seed** (surveys / surveyResponses / surveyInsights /
// surveyImports / surveyTemplates / surveySchedules / surveyQuestions) と
// 決定論的なダミー AI 実装 (mockAiAnalyzeCsv / mockExtractInsights) が残る。

import type { ProductCode } from "@/lib/master/products";
import {
  parseSurveyCsv,
  summarizeColumns,
  inferQuestionType,
  type ParsedCsv,
  type ColumnSample
} from "@/lib/surveys/csv";
import type {
  SurveyQuestion,
  SurveyQuestionType,
  SurveyTemplate,
  SurveySchedule,
  SurveyScheduleTrigger,
  SurveyRespondentTarget,
  Survey,
  SurveyAnswer,
  SurveyResponse,
  SurveyInsight,
  SurveyInsightCategory,
  SurveyImport,
  ColumnMapping
} from "@/lib/master/surveys";
import { aggregateSurveyFrom } from "@/lib/master/surveys";

// 後方互換 re-export: 旧来 `from "@/lib/mock/surveys"` で type / 集計関数を import
// している箇所のため。新規コードは `@/lib/master/surveys` を使うこと。
export {
  type SurveyQuestion,
  type SurveyQuestionType,
  type SurveyScope,
  type SurveyTemplate,
  type SurveySchedule,
  type SurveyScheduleTrigger,
  type SurveyRespondentTarget,
  type SurveyRespondentType,
  type Survey,
  type SurveyAnswer,
  type SurveyResponse,
  type SurveyInsight,
  type SurveyInsightCategory,
  type SurveyImport,
  type SurveyImportStatus,
  type ColumnMapping,
  aggregateSurveyFrom,
  describeTrigger,
  describeRespondentTarget
} from "@/lib/master/surveys";

// ─────────────────────────────────────────────
// 質問マスタ
// ─────────────────────────────────────────────

const commonQuestions: SurveyQuestion[] = [
  { id: "q-nps", key: "nps", text: "この研修を同僚に推奨する度合いを0-10で教えてください (NPS)", type: "scale", scaleMin: 0, scaleMax: 10, required: true },
  { id: "q-csat", key: "overall_satisfaction", text: "全体満足度を1-5で評価してください", type: "scale", scaleMin: 1, scaleMax: 5, required: true },
  { id: "q-instructor", key: "instructor_quality", text: "講師の質を1-5で評価してください", type: "scale", scaleMin: 1, scaleMax: 5, required: true },
  { id: "q-material", key: "material_quality", text: "教材の質を1-5で評価してください", type: "scale", scaleMin: 1, scaleMax: 5, required: true },
  { id: "q-good", key: "free_good", text: "良かった点を自由にお書きください", type: "long_text", required: false },
  { id: "q-improve", key: "free_improve", text: "改善してほしい点を自由にお書きください", type: "long_text", required: false }
];

const academiaQuestions: SurveyQuestion[] = [
  { id: "qa-1", key: "academia_pjt_progress", text: "PJTテーマの進捗実感度 (1-5)", type: "scale", scaleMin: 1, scaleMax: 5, required: true },
  { id: "qa-2", key: "academia_peer_learning", text: "他社受講者との学び合いは有意義でしたか (1-5)", type: "scale", scaleMin: 1, scaleMax: 5, required: true },
  { id: "qa-3", key: "academia_apply_work", text: "業務への適用イメージはありますか", type: "choice", choices: ["明確にある", "ある程度ある", "あまりない", "まったくない"], required: true },
  { id: "qa-4", key: "academia_mentor", text: "メンター面談の満足度 (1-5)", type: "scale", scaleMin: 1, scaleMax: 5, required: false }
];

const hyogikaiQuestions: SurveyQuestion[] = [
  { id: "qh-1", key: "hyogikai_topic_relevance", text: "今回のテーマは自社経営課題に関連していましたか (1-5)", type: "scale", scaleMin: 1, scaleMax: 5, required: true },
  { id: "qh-2", key: "hyogikai_discussion", text: "ディスカッションの活発さ (1-5)", type: "scale", scaleMin: 1, scaleMax: 5, required: true },
  { id: "qh-3", key: "hyogikai_guest", text: "ゲスト登壇者の質 (1-5)", type: "scale", scaleMin: 1, scaleMax: 5, required: false }
];

const aikenQuestions: SurveyQuestion[] = [
  { id: "qk-1", key: "aiken_handson", text: "ハンズオン演習の満足度 (1-5)", type: "scale", scaleMin: 1, scaleMax: 5, required: true },
  { id: "qk-2", key: "aiken_skill_growth", text: "AIスキルの伸びを実感しましたか (1-5)", type: "scale", scaleMin: 1, scaleMax: 5, required: true },
  { id: "qk-3", key: "aiken_advance_interest", text: "応用コースへの興味", type: "choice", choices: ["強くある", "ある", "ない"], required: false }
];

const commuQuestions: SurveyQuestion[] = [
  { id: "qc-1", key: "commu_facilitation", text: "ファシリテーション技法の理解度 (1-5)", type: "scale", scaleMin: 1, scaleMax: 5, required: true },
  { id: "qc-2", key: "commu_practice", text: "現場での実践イメージ (1-5)", type: "scale", scaleMin: 1, scaleMax: 5, required: true },
  { id: "qc-3", key: "commu_community_size", text: "現在管理しているコミュニティ規模", type: "choice", choices: ["〜50名", "51〜200名", "201〜500名", "501名以上"], required: false }
];

const kickoffQuestions: SurveyQuestion[] = [
  { id: "qs-k1", key: "session_kickoff_clarity", text: "Kickoffで研修目的が明確になりましたか (1-5)", type: "scale", scaleMin: 1, scaleMax: 5, required: true },
  { id: "qs-k2", key: "session_kickoff_expectation", text: "今後の期待度 (1-5)", type: "scale", scaleMin: 1, scaleMax: 5, required: true }
];

const midtermQuestions: SurveyQuestion[] = [
  { id: "qs-m1", key: "session_midterm_progress", text: "中間時点の習熟度 (1-5)", type: "scale", scaleMin: 1, scaleMax: 5, required: true },
  { id: "qs-m2", key: "session_midterm_pace", text: "進行ペースは適切ですか", type: "choice", choices: ["速い", "ちょうど良い", "遅い"], required: true }
];

const finalQuestions: SurveyQuestion[] = [
  { id: "qs-f1", key: "session_final_outcome", text: "最終的な成果実感 (1-5)", type: "scale", scaleMin: 1, scaleMax: 5, required: true },
  { id: "qs-f2", key: "session_final_recommend_topic", text: "次期テーマで扱ってほしい内容を教えてください", type: "long_text", required: false },
  { id: "qs-f3", key: "session_final_continue", text: "次期も継続参加したい意向", type: "choice", choices: ["強くある", "ある", "未定", "ない"], required: true }
];

// 担当者向け固有質問
const stakeholderQuestions: SurveyQuestion[] = [
  { id: "qst-1", key: "stakeholder_business_impact", text: "事業へのインパクト実感 (1-5)", type: "scale", scaleMin: 1, scaleMax: 5, required: true },
  { id: "qst-2", key: "stakeholder_continue", text: "次期も継続したい意向 (1-5)", type: "scale", scaleMin: 1, scaleMax: 5, required: true },
  { id: "qst-3", key: "stakeholder_request", text: "運営面でのご要望", type: "long_text", required: false }
];

export const surveyQuestions: SurveyQuestion[] = [
  ...commonQuestions,
  ...academiaQuestions,
  ...hyogikaiQuestions,
  ...aikenQuestions,
  ...commuQuestions,
  ...kickoffQuestions,
  ...midtermQuestions,
  ...finalQuestions,
  ...stakeholderQuestions
];

// ─────────────────────────────────────────────
// テンプレート
// ─────────────────────────────────────────────

export const surveyTemplates: SurveyTemplate[] = [
  {
    id: "tpl-common",
    name: "共通項目",
    scope: "common",
    questionIds: commonQuestions.map((q) => q.id),
    respondentType: "participant"
  },
  {
    id: "tpl-stakeholder",
    name: "担当者向け共通項目",
    scope: "common",
    questionIds: stakeholderQuestions.map((q) => q.id),
    respondentType: "stakeholder"
  },
  {
    id: "tpl-academia",
    name: "ACADEMIA固有項目",
    scope: "product",
    product: "academia",
    questionIds: academiaQuestions.map((q) => q.id),
    respondentType: "participant"
  },
  {
    id: "tpl-hyogikai",
    name: "評議会固有項目",
    scope: "product",
    product: "hyogikai",
    questionIds: hyogikaiQuestions.map((q) => q.id),
    respondentType: "participant"
  },
  {
    id: "tpl-aiken",
    name: "AIKEN固有項目",
    scope: "product",
    product: "aiken",
    questionIds: aikenQuestions.map((q) => q.id),
    respondentType: "participant"
  },
  {
    id: "tpl-commu",
    name: "コミュマネ固有項目",
    scope: "product",
    product: "commu",
    questionIds: commuQuestions.map((q) => q.id),
    respondentType: "participant"
  },
  {
    id: "tpl-kickoff",
    name: "Kickoff用",
    scope: "session",
    sessionType: "kickoff",
    questionIds: kickoffQuestions.map((q) => q.id),
    respondentType: "participant"
  },
  {
    id: "tpl-midterm",
    name: "中間用",
    scope: "session",
    sessionType: "midterm",
    questionIds: midtermQuestions.map((q) => q.id),
    respondentType: "participant"
  },
  {
    id: "tpl-final",
    name: "最終回用",
    scope: "session",
    sessionType: "final",
    questionIds: finalQuestions.map((q) => q.id),
    respondentType: "participant"
  }
];

// ─────────────────────────────────────────────
// SurveySchedule (研修マスタ x スケジュール)
// 研修ごとに2〜4スケジュール、計10〜15件
// ─────────────────────────────────────────────

export const surveySchedules: SurveySchedule[] = [
  // ── ACADEMIA ──
  {
    id: "sch-academia-stakeholder-yearly",
    product: "academia",
    name: "ACADEMIA 担当者向け定期アンケート（年3回）",
    templateIds: ["tpl-stakeholder"],
    trigger: { type: "periodic_yearly", atMonths: [3, 7, 11] },
    respondentTarget: "all_stakeholders",
    active: true
  },
  {
    id: "sch-academia-participant-kickoff",
    product: "academia",
    name: "ACADEMIA 参加者向け Kickoff後アンケート",
    templateIds: ["tpl-common", "tpl-academia", "tpl-kickoff"],
    trigger: { type: "at_session_type", sessionType: "kickoff" },
    respondentTarget: "all_participants",
    active: true
  },
  {
    id: "sch-academia-participant-midterm",
    product: "academia",
    name: "ACADEMIA 参加者向け 中間アンケート",
    templateIds: ["tpl-common", "tpl-academia", "tpl-midterm"],
    trigger: { type: "at_session_type", sessionType: "midterm" },
    respondentTarget: "all_participants",
    active: true
  },
  {
    id: "sch-academia-participant-final",
    product: "academia",
    name: "ACADEMIA 参加者向け 最終アンケート",
    templateIds: ["tpl-common", "tpl-academia", "tpl-final"],
    trigger: { type: "at_session_type", sessionType: "final" },
    respondentTarget: "all_participants",
    active: true
  },
  {
    id: "sch-academia-participant-session5",
    product: "academia",
    name: "ACADEMIA 第5回講義後アンケート",
    templateIds: ["tpl-common", "tpl-academia"],
    trigger: { type: "after_session", sessionNumber: 5 },
    respondentTarget: "all_participants",
    active: true
  },
  {
    id: "sch-academia-participant-session15",
    product: "academia",
    name: "ACADEMIA 第15回講義後アンケート",
    templateIds: ["tpl-common", "tpl-academia"],
    trigger: { type: "after_session", sessionNumber: 15 },
    respondentTarget: "all_participants",
    active: true
  },

  // ── ACADEMIA 1期 過去アンケート取り込み用（学期×受講者区分）──
  {
    id: "sch-academia-1ki-1q-participant",
    product: "academia",
    name: "ACADEMIA 1期 1学期アンケート（参加者）",
    templateIds: [],
    trigger: { type: "at_session_type", sessionType: "term1" },
    respondentTarget: "all_participants",
    active: true
  },
  {
    id: "sch-academia-1ki-2q-participant",
    product: "academia",
    name: "ACADEMIA 1期 2学期アンケート（参加者）",
    templateIds: [],
    trigger: { type: "at_session_type", sessionType: "term2" },
    respondentTarget: "all_participants",
    active: true
  },
  {
    id: "sch-academia-1ki-3q-participant",
    product: "academia",
    name: "ACADEMIA 1期 1年間振り返りアンケート（参加者）",
    templateIds: [],
    trigger: { type: "at_session_type", sessionType: "final" },
    respondentTarget: "all_participants",
    active: true
  },
  {
    id: "sch-academia-1ki-1q-stakeholder",
    product: "academia",
    name: "ACADEMIA 1期 1学期アンケート（担当者）",
    templateIds: [],
    trigger: { type: "at_session_type", sessionType: "term1" },
    respondentTarget: "all_stakeholders",
    active: true
  },
  {
    id: "sch-academia-1ki-2q-stakeholder",
    product: "academia",
    name: "ACADEMIA 1期 2学期アンケート（担当者）",
    templateIds: [],
    trigger: { type: "at_session_type", sessionType: "term2" },
    respondentTarget: "all_stakeholders",
    active: true
  },
  {
    id: "sch-academia-1ki-3q-stakeholder",
    product: "academia",
    name: "ACADEMIA 1期 3学期アンケート（担当者）",
    templateIds: [],
    trigger: { type: "at_session_type", sessionType: "final" },
    respondentTarget: "all_stakeholders",
    active: true
  },
  {
    id: "sch-academia-1ki-per-lecture",
    product: "academia",
    name: "ACADEMIA 1期 各講義後アンケート",
    templateIds: [],
    trigger: { type: "after_session", sessionNumber: 0 },
    respondentTarget: "all_participants",
    active: true
  },

  // ── 評議会 ──
  {
    id: "sch-hyogikai-stakeholder-yearly",
    product: "hyogikai",
    name: "評議会 担当者向け定期アンケート（年2回）",
    templateIds: ["tpl-stakeholder"],
    trigger: { type: "periodic_yearly", atMonths: [4, 10] },
    respondentTarget: "primary_contact",
    active: true
  },
  {
    id: "sch-hyogikai-participant-session",
    product: "hyogikai",
    name: "評議会 参加者向け 定例後アンケート",
    templateIds: ["tpl-common", "tpl-hyogikai"],
    trigger: { type: "at_session_type", sessionType: "session" },
    respondentTarget: "all_participants",
    active: true
  },
  {
    id: "sch-hyogikai-participant-kickoff",
    product: "hyogikai",
    name: "評議会 参加者向け 初回アンケート",
    templateIds: ["tpl-common", "tpl-hyogikai", "tpl-kickoff"],
    trigger: { type: "at_session_type", sessionType: "kickoff" },
    respondentTarget: "all_participants",
    active: true
  },

  // ── AIKEN ──
  {
    id: "sch-aiken-day1",
    product: "aiken",
    name: "AIKEN Day1後アンケート",
    templateIds: ["tpl-common", "tpl-aiken"],
    trigger: { type: "after_session", sessionNumber: 1 },
    respondentTarget: "all_participants",
    active: true
  },
  {
    id: "sch-aiken-day2",
    product: "aiken",
    name: "AIKEN Day2後アンケート",
    templateIds: ["tpl-common", "tpl-aiken"],
    trigger: { type: "after_session", sessionNumber: 2 },
    respondentTarget: "all_participants",
    active: true
  },
  {
    id: "sch-aiken-final",
    product: "aiken",
    name: "AIKEN 修了アンケート",
    templateIds: ["tpl-common", "tpl-aiken", "tpl-final"],
    trigger: { type: "at_session_type", sessionType: "final" },
    respondentTarget: "all_participants",
    active: true
  },

  // ── コミュマネ ──
  {
    id: "sch-commu-monthly1",
    product: "commu",
    name: "コミュマネ 月次定例1後アンケート",
    templateIds: ["tpl-common", "tpl-commu"],
    trigger: { type: "after_session", sessionNumber: 1 },
    respondentTarget: "all_participants",
    active: true
  },
  {
    id: "sch-commu-monthly2",
    product: "commu",
    name: "コミュマネ 月次定例2後アンケート",
    templateIds: ["tpl-common", "tpl-commu"],
    trigger: { type: "after_session", sessionNumber: 2 },
    respondentTarget: "all_participants",
    active: true
  },
  {
    id: "sch-commu-final",
    product: "commu",
    name: "コミュマネ 更新前アンケート",
    templateIds: ["tpl-common", "tpl-commu", "tpl-final"],
    trigger: { type: "at_session_type", sessionType: "final" },
    respondentTarget: "all_participants",
    active: true
  }
];

export function scheduleById(id: string): SurveySchedule | undefined {
  return surveySchedules.find((s) => s.id === id);
}

// ─────────────────────────────────────────────
// Survey インスタンス
// ─────────────────────────────────────────────

export const surveys: Survey[] = [
  // c-aeon ACADEMIA — Kickoff
  {
    id: "sv-aeon-1",
    scheduleId: "sch-academia-participant-kickoff",
    contractId: "k-aeon-academia",
    sessionId: "s-aeon-1",
    title: "イオン九州 ACADEMIA Kickoff アンケート",
    templateIds: ["tpl-common", "tpl-academia", "tpl-kickoff"],
    productSessionLabel: "Kickoff後",
    respondentType: "participant",
    expectedRespondentCount: 3,
    openedAt: "2025-09-15",
    closedAt: "2025-09-22",
    status: "closed"
  },
  // c-aeon ACADEMIA — 中間
  {
    id: "sv-aeon-2",
    scheduleId: "sch-academia-participant-midterm",
    contractId: "k-aeon-academia",
    sessionId: "s-aeon-3",
    title: "イオン九州 ACADEMIA 中間アンケート",
    templateIds: ["tpl-common", "tpl-academia", "tpl-midterm"],
    productSessionLabel: "中間時点",
    respondentType: "participant",
    expectedRespondentCount: 3,
    openedAt: "2025-11-15",
    closedAt: "2025-11-22",
    status: "closed"
  },
  // c-aeon ACADEMIA — 第15回
  {
    id: "sv-aeon-3",
    scheduleId: "sch-academia-participant-session15",
    contractId: "k-aeon-academia",
    sessionId: "s-aeon-5",
    title: "イオン九州 ACADEMIA 第15回講義後アンケート",
    templateIds: ["tpl-common", "tpl-academia"],
    productSessionLabel: "第15回講義後",
    respondentType: "participant",
    expectedRespondentCount: 3,
    openedAt: "2026-04-22",
    status: "open"
  },
  // 担当者向け定期 — 2026年3月
  {
    id: "sv-stakeholder-academia-202603",
    scheduleId: "sch-academia-stakeholder-yearly",
    title: "ACADEMIA 担当者向け 2026年3月定期アンケート",
    templateIds: ["tpl-stakeholder"],
    productSessionLabel: "2026年3月実施",
    respondentType: "stakeholder",
    expectedRespondentCount: 6,
    openedAt: "2026-03-10",
    closedAt: "2026-03-25",
    status: "closed"
  },
  // 担当者向け定期 — 2025年11月
  {
    id: "sv-stakeholder-academia-202511",
    scheduleId: "sch-academia-stakeholder-yearly",
    title: "ACADEMIA 担当者向け 2025年11月定期アンケート",
    templateIds: ["tpl-stakeholder"],
    productSessionLabel: "2025年11月実施",
    respondentType: "stakeholder",
    expectedRespondentCount: 6,
    openedAt: "2025-11-05",
    closedAt: "2025-11-20",
    status: "closed"
  },

  // c-toto ACADEMIA — Kickoff
  {
    id: "sv-toto-1",
    scheduleId: "sch-academia-participant-kickoff",
    contractId: "k-toto-academia",
    title: "TOTO ACADEMIA 受講前アンケート",
    templateIds: ["tpl-common", "tpl-academia", "tpl-kickoff"],
    productSessionLabel: "Kickoff前",
    respondentType: "participant",
    expectedRespondentCount: 3,
    openedAt: "2026-04-15",
    status: "open"
  },

  // c-fukugin commu — Kickoff
  {
    id: "sv-fukugin-1",
    scheduleId: "sch-commu-monthly1",
    contractId: "k-fukugin-commu",
    sessionId: "s-fukugin-1",
    title: "福岡銀行 コミュマネ 月次定例1後アンケート",
    templateIds: ["tpl-common", "tpl-commu", "tpl-kickoff"],
    productSessionLabel: "月次定例1後",
    respondentType: "participant",
    expectedRespondentCount: 8,
    openedAt: "2026-04-20",
    status: "open"
  },
  {
    id: "sv-fukugin-2",
    scheduleId: "sch-commu-monthly2",
    contractId: "k-fukugin-commu",
    title: "福岡銀行 コミュマネ 月次定例2後アンケート",
    templateIds: ["tpl-common", "tpl-commu"],
    productSessionLabel: "月次定例2後",
    respondentType: "participant",
    expectedRespondentCount: 8,
    openedAt: "2026-04-10",
    closedAt: "2026-04-18",
    status: "closed"
  },

  // c-levias aiken — final
  {
    id: "sv-levias-1",
    scheduleId: "sch-aiken-final",
    contractId: "k-levias-aiken",
    title: "レヴィアス AIKEN 修了アンケート",
    templateIds: ["tpl-common", "tpl-aiken", "tpl-final"],
    productSessionLabel: "修了時",
    respondentType: "participant",
    expectedRespondentCount: 3,
    openedAt: "2026-04-05",
    closedAt: "2026-04-12",
    status: "closed"
  },

  // c-nccb hyogikai — kickoff
  {
    id: "sv-nccb-1",
    scheduleId: "sch-hyogikai-participant-kickoff",
    contractId: "k-nccb-hyogikai",
    sessionId: "s-nccb-1",
    title: "西日本シティ銀行 評議会 初回アンケート",
    templateIds: ["tpl-common", "tpl-hyogikai", "tpl-kickoff"],
    productSessionLabel: "初回",
    respondentType: "participant",
    expectedRespondentCount: 3,
    openedAt: "2026-04-18",
    status: "open"
  },

  // 古いdraft
  {
    id: "sv-draft-1",
    scheduleId: "sch-academia-participant-final",
    contractId: "k-aeon-academia",
    title: "イオン九州 ACADEMIA 最終アンケート（準備中）",
    templateIds: ["tpl-common", "tpl-academia", "tpl-final"],
    productSessionLabel: "最終",
    respondentType: "participant",
    expectedRespondentCount: 3,
    openedAt: "2026-06-01",
    status: "draft"
  }
];

// ─────────────────────────────────────────────
// SurveyResponse （回答）
// ─────────────────────────────────────────────

// 名前リスト（参加者名にラフに合わせる）+ 紐づく企業ID
const respondentsByContract: Record<string, { names: string[]; companyId: string }> = {
  "k-aeon-academia": { names: ["田中 太郎", "佐藤 直子", "高橋 健"], companyId: "c-aeon" },
  "k-toto-academia": { names: ["渡辺 翔", "中村 美咲", "木村 拓海"], companyId: "c-toto" },
  "k-fukugin-commu": {
    names: ["井上 真理", "森 健司", "林 由佳", "石田 涼", "山口 千夏", "藤田 隆", "岡田 翼", "近藤 葵"],
    companyId: "c-fukugin"
  },
  "k-levias-aiken": { names: ["西田 拓", "大塚 悠", "前田 桜"], companyId: "c-levias" },
  "k-nccb-hyogikai": { names: ["横山 大樹", "原 由紀", "三浦 健太郎"], companyId: "c-nccb" }
};

// 担当者向け（複数社にまたがる回答）
const stakeholdersByCompany: Record<string, string[]> = {
  "c-aeon": ["田中 担当", "石原 部長"],
  "c-toto": ["林田 担当"],
  "c-jrq": ["藤本 担当"],
  "c-saibugas": ["山下 担当"]
};

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function rng(seed: string): number {
  return (hashStr(seed) % 10000) / 10000;
}

function scaleAnswer(name: string, q: SurveyQuestion, isAtRisk: boolean): number {
  const min = q.scaleMin ?? 1;
  const max = q.scaleMax ?? 5;
  const r = rng(name + q.key);
  if (isAtRisk) {
    return Math.max(min, Math.round(min + r * (max - min) * 0.45));
  }
  return Math.max(min, Math.round(min + r * (max - min) * 0.7 + (max - min) * 0.25));
}

function choiceAnswer(name: string, q: SurveyQuestion): string {
  const choices = q.choices ?? [];
  if (choices.length === 0) return "";
  const idx = hashStr(name + q.key) % choices.length;
  return choices[idx];
}

const positiveSnippets = [
  "講師の説明が分かりやすく、業務に直結する学びが多かったです。",
  "他社の方とのディスカッションが刺激的で良い体験でした。",
  "教材が体系的で復習しやすい構成です。",
  "ハンズオン演習の比重が大きく、手を動かして理解できました。"
];

const negativeSnippets = [
  "資料の事前配布が遅く、予習に時間が取れませんでした。",
  "進行ペースが速く、初学者にはついていくのが大変でした。",
  "実務との乖離を感じる回もあり、改善してほしいです。",
  "オンライン環境の音声トラブルが頻発していました。"
];

function freeTextAnswer(name: string, q: SurveyQuestion, isAtRisk: boolean): string {
  const pool = q.key === "free_improve" || isAtRisk ? negativeSnippets : positiveSnippets;
  return pool[hashStr(name + q.key) % pool.length];
}

function generateAnswers(
  templateIds: string[],
  name: string,
  isAtRisk: boolean
): SurveyAnswer[] {
  const qIds = new Set<string>();
  templateIds.forEach((tid) => {
    const t = surveyTemplates.find((tt) => tt.id === tid);
    t?.questionIds.forEach((qid) => qIds.add(qid));
  });
  const out: SurveyAnswer[] = [];
  qIds.forEach((qid) => {
    const q = surveyQuestions.find((qq) => qq.id === qid);
    if (!q) return;
    if (q.type === "scale") {
      out.push({ questionId: q.id, value: scaleAnswer(name, q, isAtRisk) });
    } else if (q.type === "choice") {
      out.push({ questionId: q.id, value: choiceAnswer(name, q) });
    } else if (q.type === "multi_choice") {
      out.push({ questionId: q.id, value: [choiceAnswer(name, q)] });
    } else {
      out.push({ questionId: q.id, value: freeTextAnswer(name, q, isAtRisk) });
    }
  });
  return out;
}

function buildResponses(): SurveyResponse[] {
  const out: SurveyResponse[] = [];
  surveys.forEach((sv) => {
    if (sv.status === "draft") return;

    if (sv.respondentType === "stakeholder") {
      // 担当者向け: 複数社の担当者から回答が集まる
      Object.entries(stakeholdersByCompany).forEach(([companyId, names]) => {
        const respondedCount = Math.max(1, Math.round(names.length * 0.85));
        for (let i = 0; i < respondedCount; i++) {
          const name = names[i];
          const isAtRisk = companyId === "c-aeon" && i === 1;
          out.push({
            id: `sr-${sv.id}-${companyId}-${i}`,
            surveyId: sv.id,
            companyId,
            respondentName: name,
            submittedAt: sv.openedAt,
            answers: generateAnswers(sv.templateIds, name, isAtRisk)
          });
        }
      });
      return;
    }

    // 参加者向け: 旧モデルの contractId から名前を取得
    const info = sv.contractId ? respondentsByContract[sv.contractId] : undefined;
    if (!info) return;
    const respondedCount = Math.max(1, Math.round(info.names.length * 0.8));
    for (let i = 0; i < respondedCount; i++) {
      const name = info.names[i];
      const isAtRisk = sv.contractId === "k-aeon-academia" && name === "佐藤 直子";
      out.push({
        id: `sr-${sv.id}-${i}`,
        surveyId: sv.id,
        companyId: info.companyId,
        respondentName: name,
        submittedAt: sv.openedAt,
        answers: generateAnswers(sv.templateIds, name, isAtRisk)
      });
    }
  });
  return out;
}

export const surveyResponses: SurveyResponse[] = buildResponses();

// ─────────────────────────────────────────────
// AIインサイト（モック生成）
// ─────────────────────────────────────────────

const insightTemplates: { category: SurveyInsightCategory; keywords: string[]; template: string }[] = [
  { category: "positive", keywords: ["分かりやすい", "良い", "刺激的", "体系的", "ハンズオン"], template: "受講者は講義の構成と実践演習の質を肯定的に評価している" },
  { category: "concern", keywords: ["乖離", "ついていく", "ペース"], template: "進行ペースと実務との接続に懸念の声がある" },
  { category: "complaint", keywords: ["音声", "トラブル", "遅い"], template: "オンライン環境および資料配布タイミングへの不満が複数挙がっている" },
  { category: "suggestion", keywords: ["改善", "予習", "事前"], template: "事前準備フェーズの強化（資料配布・予習導線）への要望" }
];

function generateInsightsForSurvey(surveyId: string): SurveyInsight[] {
  const responses = surveyResponses.filter((r) => r.surveyId === surveyId);
  if (responses.length === 0) return [];
  const out: SurveyInsight[] = [];
  const freeTextQids = surveyQuestions.filter((q) => q.type === "long_text" || q.type === "text").map((q) => q.id);

  freeTextQids.forEach((qid) => {
    const matchedResponses = responses.filter((r) =>
      r.answers.some((a) => a.questionId === qid)
    );
    if (matchedResponses.length === 0) return;
    insightTemplates.forEach((tpl, idx) => {
      const sources = matchedResponses.filter((r) => {
        const ans = r.answers.find((a) => a.questionId === qid);
        if (!ans || typeof ans.value !== "string") return false;
        return tpl.keywords.some((kw) => (ans.value as string).includes(kw));
      });
      if (sources.length === 0) return;
      out.push({
        id: `si-${surveyId}-${qid}-${idx}`,
        surveyId,
        questionId: qid,
        category: tpl.category,
        summary: tpl.template,
        sourceResponseIds: sources.map((s) => s.id),
        confidence: 0.6 + (rng(surveyId + qid + tpl.category) * 0.35),
        createdAt: "2026-04-24"
      });
    });
  });
  return out;
}

export const surveyInsights: SurveyInsight[] = surveys.flatMap((s) =>
  generateInsightsForSurvey(s.id)
);

// ─────────────────────────────────────────────
// SurveyImport（取込履歴）
// ─────────────────────────────────────────────

export const surveyImports: SurveyImport[] = [
  {
    id: "imp-1",
    fileName: "aeon_academia_q1_responses.csv",
    uploadedAt: "2025-11-22",
    uploadedBy: "古野",
    scheduleId: "sch-academia-participant-midterm",
    surveyId: "sv-aeon-2",
    status: "applied",
    rawCsv: "",
    rowCount: 3,
    columnMappings: [],
    aiSummary: "8列中6列を既存質問にマッチ、2列を新規質問として追加候補。"
  },
  {
    id: "imp-2",
    fileName: "fukugin_commu_pre.csv",
    uploadedAt: "2026-04-18",
    uploadedBy: "古野",
    scheduleId: "sch-commu-monthly2",
    surveyId: "sv-fukugin-2",
    status: "applied",
    rawCsv: "",
    rowCount: 8,
    columnMappings: [],
    aiSummary: "全12列のうち10列を既存質問にマッチ、平均confidence 0.84。"
  },
  {
    id: "imp-3",
    fileName: "levias_aiken_final.csv",
    uploadedAt: "2026-04-12",
    uploadedBy: "松田",
    scheduleId: "sch-aiken-final",
    surveyId: "sv-levias-1",
    status: "applied",
    rawCsv: "",
    rowCount: 3,
    columnMappings: [],
    aiSummary: "AIKEN固有質問3件を新規追加。応用コース興味の選択肢を自動推定。"
  },
  {
    id: "imp-4",
    fileName: "nccb_hyogikai_pilot.csv",
    uploadedAt: "2026-04-20",
    uploadedBy: "三木",
    scheduleId: "sch-hyogikai-participant-kickoff",
    status: "review",
    rawCsv: "",
    rowCount: 3,
    columnMappings: [],
    aiSummary: "レビュー待ち。1列が「氏名カラム」として認識され、企業名列も自動検出済み。"
  },
  {
    id: "imp-5",
    fileName: "toto_academia_pre_broken.csv",
    uploadedAt: "2026-04-15",
    uploadedBy: "古野",
    scheduleId: "sch-academia-participant-kickoff",
    status: "failed",
    rawCsv: "",
    rowCount: 0,
    columnMappings: [],
    aiSummary: "CSVのエンコーディングが不正で読み込めませんでした。"
  }
];

// ─────────────────────────────────────────────
// AIモック関数
// ─────────────────────────────────────────────

// CSV解析: 1行目をヘッダとして読み、各カラムを既存Questionにマッチさせる
// AIモック: 「企業名/会社/Company」「氏名/Name/回答者」も明示的に判定する
// ※ パース自体は lib/surveys/csv.ts の papaparse ベース実装に委譲（引用符内改行対応）
export function mockAiAnalyzeCsv(
  csvText: string,
  knownQuestions: SurveyQuestion[]
): {
  rowCount: number;
  columnMappings: ColumnMapping[];
  aiSummary: string;
  parsed: ParsedCsv;
  samples: ColumnSample[];
} {
  const parsed = parseSurveyCsv(csvText);
  if (parsed.headers.length === 0) {
    return {
      rowCount: 0,
      columnMappings: [],
      aiSummary: "空のCSVです",
      parsed,
      samples: []
    };
  }
  const header = parsed.headers;
  const rowCount = parsed.rowCount;
  const samples = summarizeColumns(parsed);

  const mappings: ColumnMapping[] = header.map((col, colIdx) => {
    const lower = col.toLowerCase();
    const sample = samples[colIdx];

    // 企業名列
    if (
      col.includes("企業") ||
      col.includes("会社") ||
      lower.includes("company")
    ) {
      return { csvColumn: col, matched: "company_name", confidence: 0.96 };
    }

    // 氏名列
    if (
      lower.includes("name") ||
      col.includes("氏名") ||
      col.includes("名前") ||
      col.includes("回答者")
    ) {
      return { csvColumn: col, matched: "respondent_name", confidence: 0.95 };
    }

    // 既存Questionとの部分文字列マッチ
    let best: { q: SurveyQuestion; score: number } | undefined;
    for (const q of knownQuestions) {
      const qText = q.text.toLowerCase();
      const qKey = q.key.toLowerCase();
      let score = 0;
      if (qText.includes(lower) && lower.length >= 2) score = Math.max(score, 0.8);
      if (qKey.includes(lower) && lower.length >= 3) score = Math.max(score, 0.85);
      if (lower.includes(qKey) && qKey.length >= 3) score = Math.max(score, 0.85);
      const tokens = ["nps", "満足", "講師", "教材", "良かった", "改善", "推奨", "進捗", "ペース", "ハンズオン"];
      tokens.forEach((tk) => {
        if (col.includes(tk) && (q.text.includes(tk) || q.key.includes(tk))) score = Math.max(score, 0.78);
      });
      if (score > 0 && (!best || score > best.score)) best = { q, score };
    }

    const baseConfidence = 0.6 + ((hashStr(col) % 39) / 100);

    if (best && best.score >= 0.78) {
      return {
        csvColumn: col,
        matched: "existing",
        questionKey: best.q.key,
        confidence: Math.min(0.98, Math.max(best.score, baseConfidence))
      };
    }

    // 列のサンプル値から質問タイプを推定
    const inferredType = sample
      ? inferQuestionType(sample, rowCount)
      : "text";
    const mappedType: SurveyQuestionType =
      inferredType === "scale"
        ? "scale"
        : inferredType === "multi_choice"
          ? "multi_choice"
          : inferredType === "choice"
            ? "choice"
            : inferredType === "long_text"
              ? "long_text"
              : "text";

    // タイムスタンプ系列はスキップ提案
    const isTimestamp =
      col.includes("タイムスタンプ") ||
      lower.includes("timestamp") ||
      col.includes("回答日時");
    if (isTimestamp) {
      return { csvColumn: col, matched: "skip", confidence: 0.95 };
    }

    const newQ: SurveyQuestion = {
      id: `qnew-${hashStr(col)}`,
      key: `new_${hashStr(col).toString(36)}`,
      text: col,
      type: mappedType,
      // 0-10 の scale なら NPS 系の範囲、1-5 なら satisfaction 系
      ...(mappedType === "scale"
        ? sample && sample.sample.some((v) => Number(v) > 5)
          ? { scaleMin: 0, scaleMax: 10 }
          : { scaleMin: 1, scaleMax: 5 }
        : {}),
      required: false
    };
    return {
      csvColumn: col,
      matched: "new",
      proposedQuestion: newQ,
      confidence: baseConfidence
    };
  });

  const existing = mappings.filter((m) => m.matched === "existing").length;
  const news = mappings.filter((m) => m.matched === "new").length;
  const skips = mappings.filter((m) => m.matched === "skip").length;
  const company = mappings.filter((m) => m.matched === "company_name").length;
  const respondent = mappings.filter((m) => m.matched === "respondent_name").length;
  const avgConf = mappings.length > 0 ? mappings.reduce((s, m) => s + m.confidence, 0) / mappings.length : 0;
  const aiSummary = `全${header.length}列のうち、既存マッチ ${existing} / 新規 ${news} / スキップ ${skips} / 企業列 ${company} / 氏名列 ${respondent}。平均confidence ${avgConf.toFixed(2)}。`;

  return { rowCount, columnMappings: mappings, aiSummary, parsed, samples };
}

export function mockExtractInsights(
  responses: SurveyResponse[],
  questions: SurveyQuestion[]
): SurveyInsight[] {
  const out: SurveyInsight[] = [];
  const freeTextQids = questions.filter((q) => q.type === "long_text" || q.type === "text").map((q) => q.id);
  freeTextQids.forEach((qid) => {
    const matched = responses.filter((r) => r.answers.some((a) => a.questionId === qid));
    insightTemplates.forEach((tpl, idx) => {
      const sources = matched.filter((r) => {
        const ans = r.answers.find((a) => a.questionId === qid);
        if (!ans || typeof ans.value !== "string") return false;
        return tpl.keywords.some((kw) => (ans.value as string).includes(kw));
      });
      if (sources.length === 0) return;
      out.push({
        id: `si-extract-${qid}-${idx}`,
        surveyId: matched[0]?.surveyId ?? "",
        questionId: qid,
        category: tpl.category,
        summary: tpl.template,
        sourceResponseIds: sources.map((s) => s.id),
        confidence: 0.7,
        createdAt: "2026-04-24"
      });
    });
  });
  return out;
}


// 後方互換: seed データ専用のラッパー。新規コードは aggregateSurveyFrom を使う。
export function aggregateSurvey(surveyId: string): ReturnType<typeof aggregateSurveyFrom> {
  const sv = surveys.find((s) => s.id === surveyId);
  if (!sv) return { byQuestion: [], responseCount: 0 };
  const templateQuestionIds: string[] = [];
  sv.templateIds.forEach((tid) => {
    const t = surveyTemplates.find((tt) => tt.id === tid);
    t?.questionIds.forEach((qid) => templateQuestionIds.push(qid));
  });
  return aggregateSurveyFrom(surveyId, {
    responses: surveyResponses.filter((r) => r.surveyId === surveyId),
    questions: surveyQuestions,
    templateQuestionIds
  });
}

// 名前検索ヘルパー
export function questionByKey(key: string): SurveyQuestion | undefined {
  return surveyQuestions.find((q) => q.key === key);
}

export function questionById(id: string): SurveyQuestion | undefined {
  return surveyQuestions.find((q) => q.id === id);
}

// Survey一覧で対象数（分母）を取る
export function targetCountForSurvey(surveyId: string): number {
  const sv = surveys.find((s) => s.id === surveyId);
  if (!sv) return 0;
  return sv.expectedRespondentCount;
}

// 企業別の回答内訳（複数社が回答する想定）
export function responsesByCompany(surveyId: string): { companyId: string; count: number }[] {
  const responses = surveyResponses.filter((r) => r.surveyId === surveyId);
  const map = new Map<string, number>();
  responses.forEach((r) => {
    map.set(r.companyId, (map.get(r.companyId) ?? 0) + 1);
  });
  return Array.from(map.entries()).map(([companyId, count]) => ({ companyId, count }));
}

