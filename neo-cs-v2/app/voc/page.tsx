import Link from "next/link";
import { TopNavServer } from "@/components/TopNavServer";
import { SectionSubNav, SIGNAL_SUBNAV } from "@/components/SectionSubNav";
import { vocItemRepo, companyRepo, userRepo } from "@/lib/repository/server";
import { VocBoard } from "./VocBoard";

export const dynamic = "force-dynamic";

export default async function VocPage() {
  const [items, companies, users] = await Promise.all([
    vocItemRepo.list(),
    companyRepo.list(),
    userRepo.list({ activeOnly: true })
  ]);

  return (
    <>
      <TopNavServer current="/voc" />
      <SectionSubNav items={SIGNAL_SUBNAV} />
      <main className="mx-auto max-w-[1720px] px-6 py-8 space-y-6">
        <header className="space-y-1">
          <div className="text-caption text-neutral-500">
            <Link href="/" className="hover:text-neutral-700">
              ダッシュボード
            </Link>
            <span className="mx-1">/</span>
            <span>VOC</span>
          </div>
          <h1 className="text-xl font-bold text-neutral-900">VOC (顧客の声)</h1>
          <p className="text-body text-neutral-500">
            サーベイ・面談・週次から自動抽出したプロダクト要望候補。トリアージして開発に届ける
          </p>
        </header>

        <VocBoard
          initialItems={items}
          companies={companies.map((c) => ({ id: c.id, name: c.name }))}
          users={users.map((u) => ({ id: u.id, name: u.name }))}
        />
      </main>
    </>
  );
}
