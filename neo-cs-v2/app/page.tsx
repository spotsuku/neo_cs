import { TopNavServer } from "@/components/nav/TopNavServer";
import { MyTasksWidget } from "@/components/tasks/MyTasksWidget";
import { ExecutiveDashboard } from "./ExecutiveDashboard";
import { CommunityOverviewSection } from "@/components/community/CommunityOverviewSection";
import {
  computeContinuousKpis,
  computeOneShotKpis,
  computeProductActivity,
  CONTINUOUS_PRODUCTS,
  ONESHOT_PRODUCTS
} from "@/lib/domain/kpi/exec-kpi";
import { detectMissedCompanies } from "@/lib/domain/churn/missed-response";
import {
  vocItemRepo,
  companyJourneyRepo,
  journeyStageDefinitionRepo,
  companyRepo,
  contractRepo,
  stakeholderRepo,
  meetingLogRepo
} from "@/lib/repository/server";
import { DEFAULT_ORG_ID } from "@/lib/repository/types";
import { computeStakeholderEngagement } from "@/lib/domain/community/engagement-builder";
import { buildCommunityOverview } from "@/lib/domain/community/overview";

const ASOF = "2026-04-24";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [
    vocItems,
    companyJourneys,
    journeyStages,
    companies,
    allContracts,
    stakeholders
  ] = await Promise.all([
    vocItemRepo.list(),
    companyJourneyRepo.list(),
    journeyStageDefinitionRepo.list({ journeyType: "company" }),
    companyRepo.list(),
    contractRepo.list(),
    stakeholderRepo.list({ organizationId: DEFAULT_ORG_ID })
  ]);

  // 全社 Inner Rings 総覧用: 企業ごとの meeting logs を集約して
  // computeStakeholderEngagement に渡す (N+1 回避: 全社の meeting_log を
  // IN 句で 1 回取得し、companyId で詰め直す)
  const allMeetings = await meetingLogRepo.listByCompanyIds(
    companies.map((c) => c.id),
    { sort: "date desc" }
  );
  const meetingsByCompanyId = new Map<string, typeof allMeetings>();
  for (const m of allMeetings) {
    const arr = meetingsByCompanyId.get(m.companyId) ?? [];
    arr.push(m);
    meetingsByCompanyId.set(m.companyId, arr);
  }

  const stakeholderEngagementMap: Record<
    string,
    { suggestedTier: "core" | "active" | "casual" | "at_risk"; reasons: string[] }
  > = {};
  for (const s of stakeholders) {
    const meetings = meetingsByCompanyId.get(s.companyId) ?? [];
    const r = computeStakeholderEngagement(s, { meetingLogs: meetings });
    stakeholderEngagementMap[s.id] = {
      suggestedTier: r.suggestedTier,
      reasons: r.reasons
    };
  }

  const communityOverview = buildCommunityOverview({
    companies: companies.map((c) => ({
      id: c.id,
      name: c.name,
      ownerName: c.ownerName
    })),
    stakeholders,
    stakeholderEngagement: stakeholderEngagementMap
  });

  const continuous = computeContinuousKpis(allContracts, ASOF);
  const oneShot = computeOneShotKpis(allContracts, ASOF, 90);
  const productActivity = computeProductActivity(allContracts, ASOF, 90);

  // 全社アクティブ社数 (4 事業のいずれかで稼働中) — ユニーク
  const activeCompanyIds = new Set<string>();
  for (const c of allContracts) {
    const isContinuousActive =
      CONTINUOUS_PRODUCTS.includes(c.product) &&
      ["handoff", "onboarding", "active", "renewal_window"].includes(c.status);
    const fromYmd = (() => {
      const d = new Date(ASOF);
      d.setUTCDate(d.getUTCDate() - 90);
      return d.toISOString().slice(0, 10);
    })();
    const isOneShotRecent =
      ONESHOT_PRODUCTS.includes(c.product) && c.startDate >= fromYmd && c.startDate <= ASOF;
    if (isContinuousActive || isOneShotRecent) activeCompanyIds.add(c.companyId);
  }

  // 戦略資産社数: 企業ジャーニー displayOrder >= 6 (投資対象化以降)
  const strategicStageKeys = new Set(
    journeyStages.filter((s) => s.displayOrder >= 6).map((s) => s.stageKey)
  );
  const strategicAssetCount = companyJourneys.filter((j) =>
    strategicStageKeys.has(j.currentStageKey)
  ).length;

  const missed = detectMissedCompanies(ASOF, companies, companyJourneys, vocItems);

  return (
    <>
      <TopNavServer current="/" />
      <main className="mx-auto max-w-[1720px] px-6 py-8 space-y-10">
        <header className="space-y-1">
          <div className="text-caption text-neutral-500">NEO福岡 カスタマーサクセス</div>
          <h1 className="text-xl font-bold text-neutral-900">経営ダッシュボード</h1>
          <p className="text-caption text-neutral-500">
            数字を見て経営判断が一発でできるビュー — 継続事業 (ACADEMIA / 評議会) と
            単発事業 (AI研修 / コミュマネ) を併記
          </p>
        </header>

        <ExecutiveDashboard
          asOf={ASOF}
          continuous={continuous}
          oneShot={oneShot}
          productActivity={productActivity}
          journeyStages={journeyStages}
          companyJourneys={companyJourneys}
          companies={companies.map((c) => ({
            id: c.id,
            name: c.name,
            ownerName: c.ownerName
          }))}
          missed={missed}
          strategicAssetCount={strategicAssetCount}
          totalActiveCompanies={activeCompanyIds.size}
        />

        <CommunityOverviewSection overview={communityOverview} />

        {/* 現場担当用: 自分のToDo */}
        <section>
          <MyTasksWidget />
        </section>

        <footer className="pt-8 pb-4 text-center text-caption text-neutral-500">
          NEO CS v2 — 経営ダッシュボード
        </footer>
      </main>
    </>
  );
}
