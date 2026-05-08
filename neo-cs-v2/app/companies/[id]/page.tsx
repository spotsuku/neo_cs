import { notFound } from "next/navigation";
import { TopNavServer } from "@/components/TopNavServer";
import { CompanyDetail } from "./CompanyDetail";
import { getPermissionContext } from "@/lib/auth/server";
import { canPerform } from "@/lib/auth/role-permissions";
import { products } from "@/lib/mock/data";
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
  weeklyReviewRepo,
  programRepo,
  journeyStageDefinitionRepo,
  journeyCheckpointRepo,
  contractLifecycleRepo,
  companyWeatherRepo,
  companyVisionRepo,
  emailRepo,
  participantRepo
} from "@/lib/repository/server";
import { DEFAULT_ORG_ID } from "@/lib/repository/types";
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
  // 契約 CRUD の操作可否 (role_permissions.contract_manage)
  const canManageContracts = await canPerform(ctx, "contract_manage");

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
      // size / website は現行 Company 型に未定義 (将来追加予定)
    },
    contacts: [],
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

  // ─── 事業ジャーニー: 契約ごとの推奨算出 (旧 RenewalMilestone は廃止) ─────
  const businessSuggestionByContract = new Map<string, JourneySuggestion>();
  allCycles.forEach((c) => {
    businessSuggestionByContract.set(
      c.id,
      suggestBusinessStage({
        contract: c,
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

  // チェックポイント完了状態 (各契約) と過去契約スナップショット
  const checkpointStatusesByContract: Record<string, Awaited<ReturnType<typeof journeyCheckpointRepo.list>>> = {};
  await Promise.all(
    allCycles.map(async (c) => {
      checkpointStatusesByContract[c.id] = await journeyCheckpointRepo.list({
        organizationId: DEFAULT_ORG_ID,
        journeyType: "business",
        subjectId: c.id
      });
    })
  );
  const lifecycleSnapshots = await contractLifecycleRepo.listByCompany(company.id);

  // 企業天気は手動制御。未設定なら undefined
  const weatherOverride = await companyWeatherRepo.get(company.id);
  // 企業ビジョン (NEO参画動機 / 目標 / 活用方針) + 改訂ログ
  const companyVision = await companyVisionRepo.get(company.id);
  const companyVisionLogs = await companyVisionRepo.listLogs(company.id);
  // 週次レビュー (概要タブ「直近の動き」に使用)
  const weeklyReviews = (await weeklyReviewRepo.list({ companyId: company.id }))
    .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));

  // 事業別ToDo (program_company_tasks) をこの企業に絞って読込み。
  // この企業がセルを持つ term のみを対象とする
  const allTerms = await programRepo.listTerms();
  const programBundles = await Promise.all(
    allTerms.map(async (term) => {
      const cells = (await programRepo.listCells(term.id)).filter(
        (c) => c.companyId === company.id
      );
      if (cells.length === 0) return null;
      const templates = await programRepo.listTemplates(term.id);
      return { term, templates, cells };
    })
  );
  const programData = programBundles.filter(
    (b): b is NonNullable<typeof b> => b !== null
  );

  // 派遣社員 (アカデミア生 / AIKEN受講者 等): contract 単位で取得
  const participantsNested = await Promise.all(
    allCycles.map((c) => participantRepo.listByContract(c.id).catch(() => []))
  );
  const participantList = participantsNested.flat();

  // メールタブ用: この企業に紐づく全スレッドとそのメッセージ
  const emailThreads = await emailRepo.listThreads({ companyId: company.id });
  const emailMessagesNested = await Promise.all(
    emailThreads.map((t) => emailRepo.listMessages(t.id))
  );
  const emailMessages = emailMessagesNested.flat();

  return (
    <>
      <TopNavServer current="/companies" />
      <CompanyDetail
        viewerRole={viewerRole}
        accessibleProductCodes={accessibleProductCodes}
        canManageContracts={canManageContracts}
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
        assignments={assignments.map((a) => ({
          userId: a.userId,
          role: a.role
        }))}
        completeness={completeness}
        engagementByStakeholder={engagementByStakeholder}
        companyJourney={companyJourney}
        businessJourneys={businessJourneysRaw}
        companyStageDefs={companyStageDefs}
        businessStageDefs={businessStageDefs}
        companySuggestion={companySuggestion}
        businessSuggestions={Object.fromEntries(
          businessSuggestionByContract.entries()
        )}
        checkpointStatusesByContract={checkpointStatusesByContract}
        lifecycleSnapshots={lifecycleSnapshots}
        weatherOverride={weatherOverride?.weather}
        companyVision={companyVision}
        companyVisionLogs={companyVisionLogs}
        weeklyReviews={weeklyReviews}
        programData={programData}
        emailThreads={emailThreads}
        emailMessages={emailMessages}
        initialParticipants={participantList}
      />
    </>
  );
}
