import { notFound } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { SurveyDetail } from "./SurveyDetail";
import {
  surveys,
  surveyResponses,
  surveyInsights,
  surveyImports,
  aggregateSurvey,
  targetCountForSurvey,
  scheduleById,
  responsesByCompany
} from "@/lib/mock/surveys";
import { allContracts } from "@/lib/mock/onboarding";
import { companies } from "@/lib/mock/entities";

export default async function SurveyDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const survey = surveys.find((s) => s.id === id);
  if (!survey) return notFound();

  const schedule = scheduleById(survey.scheduleId);
  const contract = survey.contractId
    ? allContracts.find((c) => c.id === survey.contractId)
    : undefined;
  const company = contract
    ? companies.find((co) => co.id === contract.companyId)
    : undefined;
  const responses = surveyResponses.filter((r) => r.surveyId === id);
  const insights = surveyInsights.filter((i) => i.surveyId === id);
  const imports = surveyImports.filter((imp) => imp.surveyId === id);
  const agg = aggregateSurvey(id);
  const target = targetCountForSurvey(id);
  const byCompany = responsesByCompany(id).map((entry) => ({
    ...entry,
    companyName: companies.find((c) => c.id === entry.companyId)?.name ?? entry.companyId
  }));

  return (
    <>
      <TopNav current="/surveys" />
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
