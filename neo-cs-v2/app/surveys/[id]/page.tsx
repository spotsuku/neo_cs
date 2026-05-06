import { notFound } from "next/navigation";
import { TopNavServer } from "@/components/TopNavServer";
import { SurveyDetail } from "./SurveyDetail";
import {
  aggregateSurvey,
  targetCountForSurvey,
  scheduleById,
  responsesByCompany
} from "@/lib/mock/surveys";
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

  const responses = await surveyRepo.listResponses(id);

  const schedule = scheduleById(survey.scheduleId);
  const contract = survey.contractId
    ? allContracts.find((c) => c.id === survey.contractId)
    : undefined;
  const company = contract
    ? companies.find((co) => co.id === contract.companyId)
    : undefined;

  // TODO(supabase): survey_insights / survey_imports は repo 未実装のため空配列で返す。
  // AI 集計派生・インポート履歴で本番データ未投入。実装後に repo 経由に切替。
  const insights: never[] = [];
  const imports: never[] = [];

  // aggregateSurvey / targetCountForSurvey / responsesByCompany は mock データを
  // 内部参照する純関数。supabase 駆動時は集計値が空となるが、本番データ投入後に
  // repo 派生計算へ移行予定 (上記 TODO と一括対応)。
  const agg = aggregateSurvey(id);
  const target = targetCountForSurvey(id);
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
