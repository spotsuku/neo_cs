import { surveyRepo } from "@/lib/repository/server";
import ImportClient from "./ImportClient";

export const dynamic = "force-dynamic";

export default async function SurveyImportPage() {
  const schedules = await surveyRepo
    .listSchedules({ activeOnly: true })
    .catch(() => []);
  return <ImportClient schedules={schedules} />;
}
