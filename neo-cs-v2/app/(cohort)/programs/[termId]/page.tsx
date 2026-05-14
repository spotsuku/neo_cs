import { notFound } from "next/navigation";
import { TopNavServer } from "@/components/TopNavServer";
import {
  programRepo,
  companyRepo,
  userRepo,
  contractRepo,
  onboardingItemRepo
} from "@/lib/repository/server";
import { productByCode, courseShortName, hasMultipleCourses, type ProductCode } from "@/lib/mock/data";
import { getPermissionContext } from "@/lib/auth/server";
import { canPerform } from "@/lib/auth/role-permissions";
import { TermHubView } from "./TermHubView";

export const dynamic = "force-dynamic";

const TODAY = new Date().toISOString().slice(0, 10);

// 期スコープにマッチする契約を判定する純関数
// (programRepo の syncCompanies と同じセマンティクス)
function contractMatchesTerm(
  contract: { product: string; courseKey?: string | null; cycleNumber?: number | null },
  term: { productCode: string; courseKey?: string | null; cycleNo?: number | null }
): boolean {
  if (term.productCode === "hyogikai" && contract.product === "academia") return true;
  if (contract.product !== term.productCode) return false;
  if (term.courseKey != null && contract.courseKey !== term.courseKey) return false;
  if (term.cycleNo != null && contract.cycleNumber !== term.cycleNo) return false;
  return true;
}

export default async function ProgramTermPage({
  params
}: {
  params: Promise<{ termId: string }>;
}) {
  const { termId } = await params;
  const term = await programRepo.getTerm(termId);
  if (!term) notFound();

  const ctx = await getPermissionContext();
  const [
    canManageTerm,
    canManageContracts,
    templates,
    cells,
    companies,
    users,
    allContracts
  ] = await Promise.all([
    canPerform(ctx, "program_term_manage"),
    canPerform(ctx, "contract_manage"),
    programRepo.listTemplates(termId),
    programRepo.listCells(termId),
    companyRepo.list(),
    userRepo.list({ activeOnly: true }),
    contractRepo.list()
  ]);

  // 参加企業 = この期のスコープに合致する active な契約 (renewed/churned 以外)
  const participants = allContracts
    .filter(
      (c) =>
        c.status !== "renewed" &&
        c.status !== "churned" &&
        contractMatchesTerm(c, term)
    )
    .map((c) => ({
      contract: c,
      companyName: companies.find((co) => co.id === c.companyId)?.name ?? c.companyId
    }))
    .sort((a, b) => a.companyName.localeCompare(b.companyName, "ja"));

  // 各 contract のオンボ items を一括取得
  const onboardingItems = await onboardingItemRepo.listByContractIds(
    participants.map((p) => p.contract.id)
  );

  const product = productByCode[term.productCode];
  const accent = product?.accent ?? "#3D9EFF";
  const productCourseLabel =
    term.courseKey && hasMultipleCourses(term.productCode as ProductCode)
      ? courseShortName(term.productCode as ProductCode, term.courseKey)
      : null;

  return (
    <>
      <TopNavServer current="/programs" />
      <TermHubView
        term={term}
        templates={templates}
        cells={cells}
        participants={participants}
        onboardingItems={onboardingItems}
        companyMap={Object.fromEntries(companies.map((c) => [c.id, c.name]))}
        users={users.map((u) => ({ id: u.id, name: u.name }))}
        today={TODAY}
        canManageTerm={canManageTerm}
        canManageContracts={canManageContracts}
        productAccent={accent}
        productShortName={product?.shortName ?? term.productCode}
        productCourseLabel={productCourseLabel}
      />
    </>
  );
}
