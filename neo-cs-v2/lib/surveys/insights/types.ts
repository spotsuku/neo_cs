// 分析関数の I/F。mock / claude 両実装で共通。

import type { SurveyQuestion } from "@/lib/mock/surveys";
import type { SurveyInsightRecord } from "@/lib/repository/types";

export type InsightInput = {
  surveyId: string;
  questions: SurveyQuestion[];
  responses: Array<{
    id: string;
    respondentName: string;
    answers: Array<{ questionId: string; value: number | string | string[] }>;
  }>;
};

export type InsightOutput = {
  insights: SurveyInsightRecord[];
  summary: string;
};
