import { notFound } from "next/navigation";
import { ProductCode } from "@/lib/mock/data";
import { contractRepo, companyRepo } from "@/lib/repository/server";
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

  // 本番 (REPO_DRIVER=supabase) では実 DB から、ローカルでは mock から取得
  const [contracts, companies] = await Promise.all([
    contractRepo.list(),
    companyRepo.list()
  ]);

  return (
    <ProductEditClient
      code={code as ProductCode}
      contracts={contracts}
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
