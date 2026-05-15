import { notFound } from "next/navigation";
import { ProductCode } from "@/lib/master";
import {
  contractRepo,
  companyRepo,
  onboardingTemplateRepo
} from "@/lib/repository/server";
import { getPermissionContext } from "@/lib/auth/server";
import ProductEditClient from "./ProductEditClient";

export const dynamic = "force-dynamic";

const VALID_CODES: ProductCode[] = ["academia", "hyogikai", "aiken", "commu"];

export default async function ProductEditPage({
  params
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!VALID_CODES.includes(code as ProductCode)) {
    notFound();
  }

  const ctx = await getPermissionContext();
  // 本番 (REPO_DRIVER=supabase) では実 DB から、ローカルでは mock から取得
  const [contracts, companies, onboardingTemplate] = await Promise.all([
    contractRepo.list(),
    companyRepo.list(),
    onboardingTemplateRepo.listByProduct(code).catch(() => [])
  ]);
  // オンボテンプレ編集は admin 専用 (Server Action でも再チェック)
  const canManageOnboarding = ctx.actor?.role === "admin";

  return (
    <ProductEditClient
      code={code as ProductCode}
      contracts={contracts}
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      onboardingTemplate={onboardingTemplate}
      canManageOnboarding={canManageOnboarding}
    />
  );
}
