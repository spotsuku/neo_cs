// /programs/products は最初の事業詳細にリダイレクト
// 一覧画面を挟まず、ヘッダ右上の ProductSwitcher で切替する設計

import { redirect } from "next/navigation";
import { products } from "@/lib/master";

export const dynamic = "force-dynamic";

export default async function ProductsIndexPage() {
  const first = products[0]?.code ?? "academia";
  redirect(`/programs/products/${first}`);
}
