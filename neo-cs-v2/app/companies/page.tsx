// /companies — Server Component ラッパ
//   本番 (REPO_DRIVER=supabase) で実 DB を読むため、企業一覧表示に必要な
//   関連データ (active 契約 / 企業ジャーニー / オンボ項目 / 業務 ToDo / 天気
//   オーバーライド) を Repository 経由で並列 fetch し、CompaniesView (client)
//   に props として渡す。
//
//   client 単体では mock データに直接アクセスしてしまい本番 DB が引けない
//   ため、データ取得は必ずこの Server Component 側に閉じる。

import {
  companyRepo,
  contractRepo,
  companyJourneyRepo,
  onboardingItemRepo,
  companyTaskRepo,
  companyWeatherRepo,
  healthSnapshotRepo
} from "@/lib/repository/server";
import { DEFAULT_ORG_ID } from "@/lib/repository/types";
import type { ProductCode } from "@/lib/repository/types";
import CompaniesView from "./CompaniesView";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  // ─── 第1段: 親キー単独で取れるリソースを並列取得 ───────────
  const [companies, allContracts, journeys, weatherOverrides, openTasks, latestHealthSnapshots] =
    await Promise.all([
      companyRepo.list(),
      contractRepo.list(),
      companyJourneyRepo.list(),
      companyWeatherRepo.getAll(),
      companyTaskRepo.list({ openOnly: true }),
      healthSnapshotRepo.latestAll({ organizationId: DEFAULT_ORG_ID })
    ]);

  // active 集合 (UI デフォルト) を派生 — companies/[id]/page.tsx と同じ式
  const activeContracts = allContracts.filter(
    (c) => c.status !== "renewed" && c.status !== "churned"
  );

  // ─── 第2段: active 契約 ID を使ってオンボ項目を一括取得 ────
  const activeContractIds = activeContracts.map((c) => c.id);
  const onboardingItems =
    activeContractIds.length > 0
      ? await onboardingItemRepo.listByContractIds(activeContractIds)
      : [];

  // ─── サーバ側でしか算出できない派生データを計算して渡す ───
  // 1) 企業ごとの contracts (ProductCode[]): supabase の companyRepo は
  //    contracts: [] を返すため、active 契約から派生させる。
  //    アカデミア契約には評議会参加権が暗黙に付帯するが、その付帯ロジックは
  //    View 側の表示で吸収されるため、ここでは契約 product をそのまま反映。
  const productsByCompany = new Map<string, Set<ProductCode>>();
  for (const c of activeContracts) {
    const set = productsByCompany.get(c.companyId) ?? new Set<ProductCode>();
    set.add(c.product);
    productsByCompany.set(c.companyId, set);
  }
  const companiesWithContracts = companies.map((c) => ({
    ...c,
    contracts:
      c.contracts && c.contracts.length > 0
        ? c.contracts
        : Array.from(productsByCompany.get(c.id) ?? [])
  }));

  // 2) 企業ごとの health 色 (active 契約の最悪値を集約)
  //    health_score_snapshots の最新値を contractId キーで参照する。
  //    Supabase ドライバの Contract には healthScore field が無いため、
  //    必ず snapshot 経由で解決する (旧 ct.healthScore?.color は廃止)。
  //    snapshot が無い契約は色なし扱い → UI 側のデフォルト (green) に流れる。
  const colorByContract = new Map<string, "green" | "yellow" | "red">();
  for (const s of latestHealthSnapshots) {
    colorByContract.set(s.contractId, s.color);
  }
  const healthByCompany: Record<string, "green" | "yellow" | "red"> = {};
  const rank = { red: 2, yellow: 1, green: 0 } as const;
  for (const ct of activeContracts) {
    const color = colorByContract.get(ct.id);
    if (!color) continue;
    const prev = healthByCompany[ct.companyId];
    // red > yellow > green の順で「悪い方」を採用
    if (!prev || rank[color] > rank[prev]) {
      healthByCompany[ct.companyId] = color;
    }
  }

  // 3) 未対応タスク件数 Map (companyTaskRepo.list({openOnly}) 結果から)
  const openTaskCountByCompany: Record<string, number> = {};
  for (const t of openTasks) {
    openTaskCountByCompany[t.companyId] =
      (openTaskCountByCompany[t.companyId] ?? 0) + 1;
  }

  // 4) 累計売上 (全期合算: active + renewed + churned の revenue 合計)
  //    UI の "累計売上" カラムが過去期を含めて集計するため、active のみだと不足。
  const totalRevenueByCompany: Record<string, number> = {};
  for (const ct of allContracts) {
    if (typeof ct.revenue !== "number") continue;
    totalRevenueByCompany[ct.companyId] =
      (totalRevenueByCompany[ct.companyId] ?? 0) + ct.revenue;
  }

  return (
    <CompaniesView
      initialCompanies={companiesWithContracts}
      initialContracts={activeContracts}
      initialJourneys={journeys}
      initialOnboardingItems={onboardingItems}
      healthByCompany={healthByCompany}
      openTaskCountByCompany={openTaskCountByCompany}
      totalRevenueByCompany={totalRevenueByCompany}
      weatherOverrides={weatherOverrides.map((o) => ({
        companyId: o.companyId,
        weather: o.weather
      }))}
    />
  );
}
