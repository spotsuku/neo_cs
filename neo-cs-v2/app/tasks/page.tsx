import Link from "next/link";
import { TopNavServer } from "@/components/TopNavServer";
import { SectionSubNav, TODO_SUBNAV } from "@/components/SectionSubNav";
import { companyTaskRepo, companyRepo, userRepo } from "@/lib/repository/server";
import { TasksBoard } from "./TasksBoard";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [tasks, companies, users, me] = await Promise.all([
    companyTaskRepo.list(),
    companyRepo.list(),
    userRepo.list({ activeOnly: true }),
    userRepo.getCurrent().catch(() => null)
  ]);

  return (
    <>
      <TopNavServer current="/tasks" />
      <SectionSubNav items={TODO_SUBNAV} />
      <main className="mx-auto max-w-[1720px] px-6 py-8 space-y-6">
        <header className="space-y-1">
          <div className="text-xs text-ink-500">
            <Link href="/" className="hover:text-ink-700">
              ダッシュボード
            </Link>
            <span className="mx-1">/</span>
            <span>個社ToDo</span>
          </div>
          <h1 className="text-xl font-bold text-ink-900">個社ToDo一覧</h1>
          <p className="text-sm text-ink-500">
            企業ごとの業務タスク (面談調整・提出物確認・資料送付など) を横断表示
          </p>
        </header>

        <TasksBoard
          initialTasks={tasks}
          companies={companies.map((c) => ({ id: c.id, name: c.name }))}
          users={users.map((u) => ({ id: u.id, name: u.name }))}
          currentUserId={me?.id ?? null}
        />
      </main>
    </>
  );
}
