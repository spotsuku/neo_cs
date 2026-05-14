// /onboarding 一覧 (server component)
//
// 全進行中契約のオンボ項目 + ユーザーを repo から取得し、client view へ渡す。
// インライン展開で各契約の ChecklistView (事業内ToDo と同 UX) を表示する。

import { TopNavServer } from "@/components/TopNavServer";
import { SectionSubNav, TODO_SUBNAV } from "@/components/SectionSubNav";
import {
  onboardingItemRepo,
  userRepo,
  companyRepo,
  contractRepo
} from "@/lib/repository/server";
import { OnboardingView } from "./OnboardingView";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const today = new Date().toISOString().slice(0, 10);

  // 全契約を repo から取得 (過去サイクル含む — 完了済セクションで参照する)
  const allContractsFromRepo = await contractRepo.list();
  const [items, users, companies] = await Promise.all([
    onboardingItemRepo.listByContractIds(allContractsFromRepo.map((c) => c.id)),
    userRepo.list({ activeOnly: true }),
    companyRepo.list()
  ]);

  // contractId → items
  const itemsByContract: Record<string, typeof items> = {};
  for (const it of items) {
    (itemsByContract[it.contractId] ??= []).push(it);
  }

  // karuteNo をソート鍵として渡す (undefined は末尾扱い)
  const karuteNoMap = Object.fromEntries(
    companies.map((c) => [c.id, c.karuteNo ?? Number.MAX_SAFE_INTEGER])
  );

  return (
    <>
      <TopNavServer current="/onboarding" />
      <SectionSubNav items={TODO_SUBNAV} />
      <OnboardingView
        activeContracts={allContractsFromRepo}
        itemsByContract={itemsByContract}
        companyMap={Object.fromEntries(companies.map((c) => [c.id, c.name]))}
        karuteNoMap={karuteNoMap}
        users={users.map((u) => ({ id: u.id, name: u.name }))}
        today={today}
      />
    </>
  );
}
