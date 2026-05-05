import Link from "next/link";
import { TopNavServer } from "@/components/TopNavServer";
import { journeyStageDefinitionRepo } from "@/lib/repository";
import type { JourneyType } from "@/lib/repository/types";
import { JourneyStagesEditor } from "./JourneyStagesEditor";

export default async function JourneyStagesSettingsPage({
  searchParams
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const journeyType: JourneyType = type === "business" ? "business" : "company";

  const [companyStages, businessStages] = await Promise.all([
    journeyStageDefinitionRepo.list({ journeyType: "company" }),
    journeyStageDefinitionRepo.list({ journeyType: "business" })
  ]);

  return (
    <>
      <TopNavServer current="/settings" />
      <main className="mx-auto max-w-[1100px] px-6 py-8 space-y-6">
        <section>
          <div className="flex items-center gap-2 text-xs text-ink-500 font-medium">
            <Link href="/settings" className="hover:text-ink-700">
              設定
            </Link>
            <span>/</span>
            <span>ジャーニーステージ</span>
          </div>
          <div className="mt-1">
            <h1 className="text-3xl font-bold tracking-tight">
              ジャーニーステージ
            </h1>
            <div className="mt-1 text-sm text-ink-500">
              企業ジャーニー (会社単位) と事業ジャーニー (商材×期) のステージを編集します
            </div>
          </div>
        </section>

        <nav className="flex items-center gap-1 border-b border-ink-100">
          <Link
            href="/settings/journey-stages?type=company"
            className={[
              "px-4 py-2.5 text-sm transition relative -mb-px",
              journeyType === "company"
                ? "text-ink-900 font-semibold border-b-2 border-ink-900"
                : "text-ink-500 hover:text-ink-700"
            ].join(" ")}
          >
            企業ジャーニー
          </Link>
          <Link
            href="/settings/journey-stages?type=business"
            className={[
              "px-4 py-2.5 text-sm transition relative -mb-px",
              journeyType === "business"
                ? "text-ink-900 font-semibold border-b-2 border-ink-900"
                : "text-ink-500 hover:text-ink-700"
            ].join(" ")}
          >
            事業ジャーニー
          </Link>
        </nav>

        <JourneyStagesEditor
          journeyType={journeyType}
          initialStages={
            journeyType === "company" ? companyStages : businessStages
          }
        />
      </main>
    </>
  );
}
