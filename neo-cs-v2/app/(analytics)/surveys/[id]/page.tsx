import { notFound } from "next/navigation";
import { TopNavServer } from "@/components/nav/TopNavServer";
import { SurveyDetail } from "./SurveyDetail";
import { aggregateSurveyFrom } from "@/lib/master/surveys";
import {
  aggregateSurvey,
  targetCountForSurvey,
  responsesByCompany
} from "@/lib/master/surveys";
import {
  surveyRepo,
  contractRepo,
  companyRepo
} from "@/lib/repository/server";

export const dynamic = "force-dynamic";

export default async function SurveyDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [survey, allContracts, companies] = await Promise.all([
    surveyRepo.getById(id),
    contractRepo.list(),
    companyRepo.list()
  ]);

  if (!survey) return notFound();

  const [responses, insightRecords, importRecords, surveyQuestionsForThis] = await Promise.all([
    surveyRepo.listResponses(id),
    surveyRepo.listInsights(id),
    surveyRepo.listImports({ surveyId: id }),
    surveyRepo.listQuestionsForSurvey(id)
  ]);

  const schedule = survey.scheduleId
    ? (await surveyRepo.getScheduleById(survey.scheduleId)) ?? undefined
    : undefined;
  const contract = survey.contractId
    ? allContracts.find((c) => c.id === survey.contractId)
    : undefined;
  const company = contract
    ? companies.find((co) => co.id === contract.companyId)
    : undefined;

  // SurveyDetail コンポーネントは mock 由来の SurveyInsight / SurveyImport 型を期待するため変換する
  const insights = insightRecords.map((i) => ({
    id: i.id,
    surveyId: i.surveyId,
    questionId: i.questionId ?? "",
    category: (i.category === "strength" || i.category === "weakness" ? "positive" : i.category) as
      | "positive"
      | "concern"
      | "suggestion"
      | "complaint",
    summary: i.summary,
    sourceResponseIds: i.sourceResponseIds,
    confidence: i.confidence,
    createdAt: i.createdAt
  }));
  const imports = importRecords.map((rec) => ({
    id: rec.id,
    fileName: rec.fileName,
    uploadedAt: rec.uploadedAt,
    uploadedBy: rec.uploadedBy ?? "",
    scheduleId: rec.scheduleId,
    surveyId: rec.surveyId,
    status: rec.status,
    rawCsv: "",
    rowCount: rec.rowCount,
    columnMappings: [],
    aiSummary: rec.aiSummary
  }));

  // 集計：取り込みデータを含む survey は aggregateSurveyFrom（responses + questions を直接渡す）。
  // seed のみの survey は従来の aggregateSurvey で OK。
  const agg = surveyQuestionsForThis.length > 0
    ? aggregateSurveyFrom(id, {
        responses,
        questions: surveyQuestionsForThis,
        templateQuestionIds: surveyQuestionsForThis.map((q) => q.id)
      })
    : aggregateSurvey(id);
  const target = survey.expectedRespondentCount || targetCountForSurvey(id);
  const byCompany = responsesByCompany(id).map((entry) => ({
    ...entry,
    companyName: companies.find((c) => c.id === entry.companyId)?.name ?? entry.companyId
  }));

  return (
    <>
      <TopNavServer current="/surveys" />
      <SurveyDetail
        survey={survey}
        schedule={schedule}
        product={contract?.product ?? schedule?.product}
        companyName={company?.name}
        companyId={company?.id}
        responses={responses}
        insights={insights}
        imports={imports}
        aggregation={agg}
        targetCount={target}
        byCompany={byCompany}
      />
    </>
  );
}
