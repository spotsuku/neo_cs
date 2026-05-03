import Link from "next/link";
import { notFound } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { userRepo, oneOnOneLogRepo } from "@/lib/repository";
import { OneOnOneForm } from "./OneOnOneForm";
import { OneOnOneList } from "./OneOnOneList";

export const dynamic = "force-dynamic";

export default async function OneOnOnePage({
  params
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const [target, manager, logs, allUsers] = await Promise.all([
    userRepo.getById(userId),
    userRepo.getCurrent(),
    oneOnOneLogRepo.list({ memberUserId: userId }),
    userRepo.list({ activeOnly: true })
  ]);

  if (!target) {
    notFound();
  }

  return (
    <>
      <TopNav current="/team" />
      <main className="mx-auto max-w-[960px] px-6 py-8 space-y-6">
        <header className="space-y-1">
          <div className="text-caption text-neutral-500">
            <Link href="/team" className="hover:text-neutral-700">
              チーム
            </Link>
            <span className="mx-1">/</span>
            <span>{target.name}</span>
            <span className="mx-1">/</span>
            <span>1on1</span>
          </div>
          <h1 className="text-h1 font-bold text-neutral-900">
            {target.name} の 1on1
          </h1>
          <p className="text-body text-neutral-500">
            マネージャー視点の対話メモ。良かった点 / 改善点 / 次アクションを残す
          </p>
        </header>

        <section className="surface p-5">
          <h2 className="text-h4 font-semibold text-neutral-900 mb-3">
            新規記録
          </h2>
          <OneOnOneForm
            memberUserId={userId}
            memberName={target.name}
            managerUserId={manager?.id ?? null}
            managerName={manager?.name ?? null}
            managers={allUsers}
          />
        </section>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-h4 font-semibold text-neutral-900">
              履歴 ({logs.length}件)
            </h2>
          </div>
          <OneOnOneList logs={logs} users={allUsers} />
        </section>
      </main>
    </>
  );
}
