// アンケート CSV 取り込み実行 API
//
// 入力:  { scheduleId, fileName, executedAt, csvText, mappings, uploadedBy? }
// 処理:  parseSurveyCsv → buildImportPayload → surveyRepo.createSurveyWithResponses
//        → extractInsights (mock or claude) → surveyRepo.saveInsights
// 出力:  { surveyId, importId, createdQuestionCount, responseCount, insightCount }

import { NextRequest, NextResponse } from "next/server";
import { surveyRepo, companyRepo } from "@/lib/repository/server";
import {
  parseSurveyCsv,
  buildImportPayload
} from "@/lib/surveys/pipeline";
import { summarizeColumns } from "@/lib/surveys/csv";
import { extractInsights } from "@/lib/surveys/insights";
import { surveyQuestions } from "@/lib/mock/surveys";
import type { ColumnMapping } from "@/lib/mock/surveys";

export const runtime = "nodejs";

type ApplyBody = {
  scheduleId: string;
  fileName: string;
  executedAt: string;
  csvText: string;
  mappings: ColumnMapping[];
  uploadedBy?: string;
  aiSummary?: string;
};

export async function POST(req: NextRequest) {
  let body: ApplyBody;
  try {
    body = (await req.json()) as ApplyBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { scheduleId, fileName, executedAt, csvText, mappings } = body;
  if (!scheduleId || !csvText || !mappings) {
    return NextResponse.json(
      { error: "missing_required_fields" },
      { status: 400 }
    );
  }

  const schedule = await surveyRepo.getScheduleById(scheduleId);
  if (!schedule) {
    return NextResponse.json({ error: "schedule_not_found" }, { status: 404 });
  }

  // STEP 2: parse + summarize
  const parsed = parseSurveyCsv(csvText);
  if (parsed.headers.length === 0) {
    return NextResponse.json({ error: "empty_csv" }, { status: 400 });
  }
  const samples = summarizeColumns(parsed);

  // STEP 3: build payload
  const respondentType =
    schedule.respondentTarget === "all_stakeholders" ||
    schedule.respondentTarget === "primary_contact"
      ? "stakeholder"
      : "participant";

  const companies = await companyRepo.list();
  const payload = buildImportPayload({
    parsed,
    mappings,
    scheduleId,
    scheduleName: schedule.name,
    fileName,
    executedAt,
    uploadedBy: body.uploadedBy,
    rawCsv: csvText,
    respondentType,
    companies,
    knownQuestions: surveyQuestions,
    aiSummary: body.aiSummary
  });

  // STEP 4: persist
  const result = await surveyRepo.createSurveyWithResponses(payload);

  // STEP 5: AI 分析（モック / Claude）
  // 既存質問の questionId を解決した上で extractInsights に渡す
  const allQuestions = [
    ...surveyQuestions,
    ...payload.newQuestions
  ];
  const responses = await surveyRepo.listResponses(result.surveyId);
  const { insights, summary } = await extractInsights({
    surveyId: result.surveyId,
    questions: allQuestions,
    responses: responses.map((r) => ({
      id: r.id,
      respondentName: r.respondentName,
      answers: r.answers
    }))
  });
  await surveyRepo.saveInsights(result.surveyId, insights);

  return NextResponse.json({
    ...result,
    insightCount: insights.length,
    insightSummary: summary
  });
}

// 自動マッピング再計算用（UI から「再解析」する場合に使用予定）
export async function GET() {
  return NextResponse.json({ ok: true });
}
