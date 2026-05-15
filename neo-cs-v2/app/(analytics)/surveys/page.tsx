import { surveyRepo } from "@/lib/repository/server";
import { aggregateSurveyFrom } from "@/lib/master/surveys";
import SurveysClient from "./SurveysClient";

export const dynamic = "force-dynamic";

export default async function SurveysPage() {
  const [surveys, schedules] = await Promise.all([
    surveyRepo.list(),
    surveyRepo.listSchedules({ activeOnly: true }).catch(() => [])
  ]);

  // 各 survey の回答数 / NPS を Server 側で集計
  const npsBySurvey: Record<string, number | undefined> = {};
  const responseCountBySurvey: Record<string, number> = {};
  await Promise.all(
    surveys.map(async (sv) => {
      const [responses, questions] = await Promise.all([
        surveyRepo.listResponses(sv.id),
        surveyRepo.listQuestionsForSurvey(sv.id)
      ]);
      const agg = aggregateSurveyFrom(sv.id, { responses, questions });
      responseCountBySurvey[sv.id] = responses.length;
      npsBySurvey[sv.id] = agg.npsScore;
    })
  );

  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <SurveysClient
      schedules={schedules}
      surveys={surveys}
      npsBySurvey={npsBySurvey}
      responseCountBySurvey={responseCountBySurvey}
      todayISO={todayISO}
    />
  );
}
