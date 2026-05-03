import { notFound } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { CompanyDetail } from "./CompanyDetail";
import {
  companyRepo,
  contactRepo,
  meetingLogRepo,
  contractRepo,
  stakeholderRepo,
  accountJourneyRepo,
  onboardingItemRepo,
  successPlanRepo
} from "@/lib/repository";

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

  // ─── 第1段: 親キーで完結する 5 リソースを並列取得 ───────────
  const [
    contacts,
    meetings,
    allCycles,
    stakeholders,
    journeys
  ] = await Promise.all([
    contactRepo.listByCompany(id),
    meetingLogRepo.listByCompany(id, { sort: "date desc", limit: 50 }),
    contractRepo.listByCompany(id),
    stakeholderRepo.listByCompany(id),
    accountJourneyRepo.listByCompany(id)
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

  return (
    <>
      <TopNav current="/companies" />
      <CompanyDetail
        company={company}
        contacts={contacts}
        logs={meetings}
        contracts={contracts}
        allCycles={allCycles}
        items={items}
        stakeholders={stakeholders}
        successPlans={plans}
        journeys={journeys}
      />
    </>
  );
}
