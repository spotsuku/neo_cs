import { notFound } from "next/navigation";
import { TopNavServer } from "@/components/TopNavServer";
import { CompanyDetail } from "./CompanyDetail";
import { getPermissionContext } from "@/lib/auth/server";
import { products } from "@/lib/mock/data";
import { CompletenessChecklistCard } from "@/components/CompletenessChecklistCard";
import { checkCompanyCompleteness } from "@/lib/domain/completeness";
import { computeStakeholderEngagement } from "@/lib/domain/engagement-builder";
import type { StakeholderEngagementMetrics } from "@/components/StakeholderEngagementCard";
import {
  companyRepo,
  contactRepo,
  meetingLogRepo,
  contractRepo,
  stakeholderRepo,
  accountJourneyRepo,
  onboardingItemRepo,
  successPlanRepo,
  assignmentRepo,
  companyTaskRepo,
  userRepo,
  companyJourneyRepo,
  businessJourneyRepo,
  journeyStageDefinitionRepo,
  renewalMilestoneRepo
} from "@/lib/repository";
import {
  suggestBusinessStage,
  suggestCompanyStage,
  type JourneySuggestion
} from "@/lib/domain/journey";
import type {
  BusinessJourney,
  CompanyJourney,
  JourneyStageDefinition
} from "@/lib/repository/types";

// 「現行サイクル」判定 — lib/mock/onboarding.ts:293 の activeContracts と同じ式。
// repo.listByCompany() 経由で取得した全契約から、画面に渡す active 集合を作る。
const isActiveCycle = (status: string): boolean =>
  status !== "renewed" && status !== "churned";

export default async function CompanyDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const company = await companyRepo.getById(id);
  if (!company) return notFound();

  const ctx = await getPermissionContext();
  const viewerRole = ctx.actor?.role ?? "viewer";
  const accessibleProductCodes =
    viewerRole === "admin"
      ? products.map((p) => p.code as string)
      : ctx.programs.map((p) => p.productCode);

  // ─── 第1段: 親キーで完結する 5 リソースを並列取得 ───────────
  const [
    contacts,
    meetings,
    allCycles,
    stakeholders,
    journeys,
    tasks,
    members,
    companyJourney,
    businessJourneysRaw,
    companyStageDefs,
    businessStageDefs
  ] = await Promise.all([
    contactRepo.listByCompany(id),
    meetingLogRepo.listByCompany(id, { sort: "date desc", limit: 50 }),
    contractRepo.listByCompany(id),
    stakeholderRepo.listByCompany(id),
    accountJourneyRepo.listByCompany(id),
    companyTaskRepo.list({ companyId: id }),
    userRepo.list({ activeOnly: true }),
    companyJourneyRepo.getByCompany(id),
    businessJourneyRepo.listByCompany(id),
    journeyStageDefinitionRepo.list({ journeyType: "company" }),
    journeyStageDefinitionRepo.list({ journeyType: "business" })
  ]);

  // active 集合 (UI デフォルト)。allCycles から派生させて再フェッチを避ける
  const contracts = allCycles.filter((c) => isActiveCycle(c.status));

  // ─── 第2段: 子テーブルを contractIds で一括取得 ─────────────
  // 旧コードの `.filter((i) => contracts.some((c) => c.id === i.contractId))`
  // (★A) と `.filter((sp) => allCycles.some((c) => c.id === sp.contractId))`
  // (★B) を、ID集合での一括取得 + Set lookup に置き換える。
  const activeContractIds = contracts.map((c) => c.id);
  const allContractIds = allCycles.map((c) => c.id);

  const [onboardingItemsAll, plansAll] = await Promise.all([
    onboardingItemRepo.listByContractIds(activeContractIds),
    successPlanRepo.listByContractIds(allContractIds)
  ]);

  // 念のため (リポジトリが ID 厳格でない実装に化けても安全): Set で再フィルタ。
  // O(n) で済むため過剰コストにはならない。
  const activeIdSet = new Set(activeContractIds);
  const allIdSet = new Set(allContractIds);
  const items = onboardingItemsAll.filter((i) => activeIdSet.has(i.contractId));
  const plans = plansAll.filter((sp) => allIdSet.has(sp.contractId));

  // 未入力チェックリスト (純関数 lib/domain/completeness)
  const assignments = await assignmentRepo
    .listByCompany(id, { activeOnly: true })
    .catch(() => []);
  const completeness = checkCompanyCompleteness({
    company: {
      id: company.id,
      name: company.name,
      industry: company.industry
      // size / website / legalNumber は現行 Company 型に未定義 (将来追加予定)
    },
    contacts: contacts.map((c) => ({
      isPrimary: c.isPrimary,
      name: c.name,
      email: c.email,
      title: c.title
      // slackId は将来追加予定
    })),
    contracts: allCycles.map((c) => ({
      status: c.status,
      courseKey: c.courseKey,
      mrr: c.mrr,
      revenue: c.revenue,
      startDate: c.startDate,
      endDate: c.endDate
    })),
    assignments: assignments.map((a) => ({ role: a.role, unassignedAt: a.unassignedAt })),
    fallbackPrimaryOwnerName: company.ownerName,
    onboarding: { taskCount: items.length },
    stakeholders: stakeholders.map((s) => ({ type: s.type })),
    drive: { folderUrl: company.driveFolderUrl ?? null }
  });

  // 顧客側担当者ごとの engagement 指標 (Phase2-#4)
  const engagementByStakeholder: Record<string, StakeholderEngagementMetrics> = {};
  for (const s of stakeholders) {
    const r = computeStakeholderEngagement(s, { meetingLogs: meetings });
    engagementByStakeholder[s.id] = {
      tier: r.tier,
      suggestedTier: r.suggestedTier,
      score: r.score,
      lastTouchAt: r.lastTouchAt,
      touchCount30d: r.touchCount30d,
      touchCount90d: r.touchCount90d
    };
  }

  // ─── 事業ジャーニー: 契約ごとに更新マイルストーン取得 → 推奨算出 ─────
  const milestonesByContract = await Promise.all(
    allContractIds.map((cid) => renewalMilestoneRepo.listByContract(cid))
  );
  const businessSuggestionByContract = new Map<string, JourneySuggestion>();
  allCycles.forEach((c, idx) => {
    businessSuggestionByContract.set(
      c.id,
      suggestBusinessStage({
        contract: c,
        milestones: milestonesByContract[idx],
        current: businessJourneysRaw.find((bj) => bj.contractId === c.id) ?? null,
        stageDefinitions: businessStageDefs
      })
    );
  });

  // ─── 企業ジャーニー: 推奨算出 ─────
  const companySuggestion = suggestCompanyStage({
    contracts: allCycles,
    businessJourneys: businessJourneysRaw,
    current: companyJourney,
    companyStageDefinitions: companyStageDefs,
    businessStageDefinitions: businessStageDefs
  });

  return (
    <>
      <TopNavServer current="/companies" />
      <div className="mx-auto max-w-[1400px] px-6 pt-8">
        <CompletenessChecklistCard result={completeness} />
      </div>
      <CompanyDetail
        viewerRole={viewerRole}
        accessibleProductCodes={accessibleProductCodes}
        company={company}
        contacts={contacts}
        logs={meetings}
        contracts={contracts}
        allCycles={allCycles}
        items={items}
        stakeholders={stakeholders}
        successPlans={plans}
        journeys={journeys}
        tasks={tasks}
        members={members.map((u) => ({ id: u.id, name: u.name }))}
        engagementByStakeholder={engagementByStakeholder}
        companyJourney={companyJourney}
        businessJourneys={businessJourneysRaw}
        companyStageDefs={companyStageDefs}
        businessStageDefs={businessStageDefs}
        companySuggestion={companySuggestion}
        businessSuggestions={Object.fromEntries(
          businessSuggestionByContract.entries()
        )}
      />
    </>
  );
}
