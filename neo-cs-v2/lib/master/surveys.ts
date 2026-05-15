// アンケート関連の型定義 + 集計ユーティリティ
// (旧 lib/mock/surveys.ts から master へ切り出し)
//
// テンプレ・質問・スケジュール・回答などの「型」と純粋な集計関数は本番でも
// 使うので master 配下に置く。seed 配列・モック AI 実装は lib/mock/surveys.ts に残す。

import type { ProductCode } from "./products";

export type SurveyQuestionType = "scale" | "choice" | "multi_choice" | "text" | "long_text";
export type SurveyScope = "common" | "product" | "session";

export type SurveyQuestion = {
  id: string;
  key: string;
  text: string;
  type: SurveyQuestionType;
  scaleMin?: number;
  scaleMax?: number;
  choices?: string[];
  required: boolean;
};

// 「担当者向け」か「参加者向け」かの粒度
export type SurveyRespondentType = "stakeholder" | "participant";

export type SurveyTemplate = {
  id: string;
  name: string;
  scope: SurveyScope;
  product?: ProductCode;
  sessionType?: string;
  questionIds: string[];
  // 担当者向け / 参加者向けの粒度。共通テンプレ(tpl-common)はどちらにも使えるが、
  // 既定値は participant 寄り。実利用時は schedule 側で確定する。
  respondentType: SurveyRespondentType;
};

// 研修マスタに紐づくアンケート発生スケジュール
export type SurveyScheduleTrigger =
  | { type: "after_session"; sessionNumber: number }
  | { type: "at_session_type"; sessionType: string } // "kickoff" | "midterm" | "final" 等
  | { type: "periodic_yearly"; atMonths: number[] }; // 例: [3, 7, 11]

export type SurveyRespondentTarget =
  | "all_stakeholders"
  | "primary_contact"
  | "all_participants"
  | "custom";

export type SurveySchedule = {
  id: string;
  product: ProductCode;
  name: string;
  templateIds: string[];
  trigger: SurveyScheduleTrigger;
  respondentTarget: SurveyRespondentTarget;
  expectedRespondentIds?: string[];
  active: boolean;
};

export type Survey = {
  id: string;
  scheduleId: string;
  contractId?: string;
  sessionId?: string;
  title: string;
  templateIds: string[];
  productSessionLabel?: string;
  respondentType: SurveyRespondentType;
  expectedRespondentCount: number;
  openedAt: string;
  closedAt?: string;
  status: "draft" | "open" | "closed";
};

export type SurveyAnswer = {
  questionId: string;
  value: number | string | string[];
};

export type SurveyResponse = {
  id: string;
  surveyId: string;
  companyId: string;
  respondentName: string;
  participantId?: string;
  submittedAt: string;
  answers: SurveyAnswer[];
};

export type SurveyInsightCategory = "positive" | "concern" | "suggestion" | "complaint";

export type SurveyInsight = {
  id: string;
  surveyId: string;
  questionId: string;
  category: SurveyInsightCategory;
  summary: string;
  sourceResponseIds: string[];
  confidence: number;
  createdAt: string;
};

export type SurveyImportStatus = "parsing" | "mapping" | "review" | "applied" | "failed";

export type ColumnMapping = {
  csvColumn: string;
  matched: "existing" | "new" | "skip" | "company_name" | "respondent_name";
  questionKey?: string;
  proposedQuestion?: SurveyQuestion;
  confidence: number;
  approvedBy?: string;
};

export type SurveyImport = {
  id: string;
  fileName: string;
  uploadedAt: string;
  uploadedBy: string;
  scheduleId: string;
  surveyId?: string;
  sessionId?: string;
  status: SurveyImportStatus;
  rawCsv: string;
  rowCount: number;
  columnMappings: ColumnMapping[];
  aiSummary?: string;
};

// ─────────────────────────────────────────────
// 集計関数 (純粋関数なので master 側に置く)
// ─────────────────────────────────────────────

// templateIds に紐づく質問だけを対象にする場合に渡す。未指定なら responses.answers から推定
export function aggregateSurveyFrom(
  _surveyId: string,
  opts: {
    responses: SurveyResponse[];
    questions: SurveyQuestion[];
    templateQuestionIds?: string[];
  }
): {
  byQuestion: { questionKey: string; questionText: string; type: SurveyQuestionType; mean?: number; distribution?: Record<string, number>; respondedCount: number }[];
  npsScore?: number;
  satisfactionMean?: number;
  responseCount: number;
} {
  const responses = opts.responses;
  const qIds = new Set<string>();
  if (opts.templateQuestionIds && opts.templateQuestionIds.length > 0) {
    opts.templateQuestionIds.forEach((qid) => qIds.add(qid));
  } else {
    responses.forEach((r) => r.answers.forEach((a) => qIds.add(a.questionId)));
  }

  const byQuestion: { questionKey: string; questionText: string; type: SurveyQuestionType; mean?: number; distribution?: Record<string, number>; respondedCount: number }[] = [];
  qIds.forEach((qid) => {
    const q = opts.questions.find((qq) => qq.id === qid);
    if (!q) return;
    const answers = responses
      .map((r) => r.answers.find((a) => a.questionId === qid))
      .filter((a): a is SurveyAnswer => Boolean(a));
    const respondedCount = answers.length;
    if (q.type === "scale") {
      const sum = answers.reduce((s, a) => s + (typeof a.value === "number" ? a.value : 0), 0);
      const mean = respondedCount > 0 ? sum / respondedCount : undefined;
      const distribution: Record<string, number> = {};
      const min = q.scaleMin ?? 1;
      const max = q.scaleMax ?? 5;
      for (let v = min; v <= max; v++) distribution[String(v)] = 0;
      answers.forEach((a) => {
        if (typeof a.value === "number") distribution[String(a.value)] = (distribution[String(a.value)] ?? 0) + 1;
      });
      byQuestion.push({ questionKey: q.key, questionText: q.text, type: q.type, mean, distribution, respondedCount });
    } else if (q.type === "choice" || q.type === "multi_choice") {
      const distribution: Record<string, number> = {};
      (q.choices ?? []).forEach((c) => (distribution[c] = 0));
      answers.forEach((a) => {
        if (typeof a.value === "string") distribution[a.value] = (distribution[a.value] ?? 0) + 1;
        if (Array.isArray(a.value)) a.value.forEach((v) => (distribution[v] = (distribution[v] ?? 0) + 1));
      });
      byQuestion.push({ questionKey: q.key, questionText: q.text, type: q.type, distribution, respondedCount });
    } else {
      byQuestion.push({ questionKey: q.key, questionText: q.text, type: q.type, respondedCount });
    }
  });

  const npsAgg = byQuestion.find((b) => b.questionKey === "nps");
  let npsScore: number | undefined;
  if (npsAgg && npsAgg.distribution) {
    const total = Object.values(npsAgg.distribution).reduce((s, v) => s + v, 0);
    if (total > 0) {
      let promoters = 0;
      let detractors = 0;
      Object.entries(npsAgg.distribution).forEach(([k, v]) => {
        const n = Number(k);
        if (n >= 9) promoters += v;
        if (n <= 6) detractors += v;
      });
      npsScore = Math.round(((promoters - detractors) / total) * 100);
    }
  }
  const satAgg = byQuestion.find((b) => b.questionKey === "overall_satisfaction");
  return {
    byQuestion,
    npsScore,
    satisfactionMean: satAgg?.mean,
    responseCount: responses.length
  };
}

// SurveyScheduleTrigger を人間可読なラベルに
export function describeTrigger(trigger: SurveyScheduleTrigger): string {
  if (trigger.type === "after_session") return `第${trigger.sessionNumber}回後`;
  if (trigger.type === "at_session_type") {
    const map: Record<string, string> = {
      kickoff: "Kickoff時",
      midterm: "中間",
      final: "最終回",
      session: "各セッション後"
    };
    return map[trigger.sessionType] ?? trigger.sessionType;
  }
  return `年${trigger.atMonths.length}回 (${trigger.atMonths.map((m) => `${m}月`).join(",")})`;
}

export function describeRespondentTarget(t: SurveyRespondentTarget): string {
  switch (t) {
    case "all_stakeholders":
      return "全担当者";
    case "primary_contact":
      return "主担当のみ";
    case "all_participants":
      return "全参加者";
    case "custom":
      return "カスタム";
  }
}
