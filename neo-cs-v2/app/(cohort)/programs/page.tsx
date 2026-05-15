import { TopNavServer } from "@/components/nav/TopNavServer";
import { SectionSubNav, TODO_SUBNAV } from "@/components/nav/SectionSubNav";
import { programRepo, companyRepo, userRepo } from "@/lib/repository/server";
import { summarizeProgress } from "@/lib/domain/program/program";
import { ProgramsView, type EnrichedTerm } from "./ProgramsView";
import { getPermissionContext } from "@/lib/auth/server";
import { canPerform } from "@/lib/auth/role-permissions";
import { products } from "@/lib/master";

export const dynamic = "force-dynamic";

const TODAY = new Date().toISOString().slice(0, 10);

export default async function ProgramsListPage() {
  const ctx = await getPermissionContext();
  const allowedProductCodes =
    ctx.actor?.role === "admin"
      ? products.map((p) => p.code)
      : ctx.programs.map((p) => p.productCode);
  const canManageTerm = await canPerform(ctx, "program_term_manage");

  const [terms, companies, users] = await Promise.all([
    programRepo.listTerms(),
    companyRepo.list(),
    userRepo.list({ activeOnly: true })
  ]);

  const enriched: EnrichedTerm[] = await Promise.all(
    terms.map(async (t) => {
      const [cells, templates] = await Promise.all([
        programRepo.listCells(t.id),
        programRepo.listTemplates(t.id)
      ]);
      const companyIds = Array.from(new Set(cells.map((c) => c.companyId)));
      const summary = summarizeProgress(cells, TODAY);
      return {
        term: t,
        summary,
        companyCount: companyIds.length,
        templateCount: templates.length,
        templates,
        cells,
        companyIds
      };
    })
  );

  return (
    <>
      <TopNavServer current="/programs" />
      <SectionSubNav items={TODO_SUBNAV} />
      <ProgramsView
        enriched={enriched}
        companyMap={Object.fromEntries(companies.map((c) => [c.id, c.name]))}
        users={users.map((u) => ({ id: u.id, name: u.name }))}
        today={TODAY}
        allowedProductCodes={allowedProductCodes}
        canManageTerm={canManageTerm}
      />
    </>
  );
}
