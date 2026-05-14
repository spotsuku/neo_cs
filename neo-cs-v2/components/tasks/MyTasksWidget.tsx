// ダッシュボード「あなたの未完了ToDo」ウィジェット (Server Component)
// 期日近い順 5 件。 isOverdue で強調。

import Link from "next/link";
import { companyTaskRepo, companyRepo, userRepo } from "@/lib/repository/server";
import { isOverdue, sortByDueAsc, TASK_PRIORITY_LABEL } from "@/lib/domain/tasks/task";

const TODAY = new Date().toISOString().slice(0, 10);

export async function MyTasksWidget() {
  const me = await userRepo.getCurrent().catch(() => null);
  if (!me) return null;
  const [tasks, companies] = await Promise.all([
    companyTaskRepo.list({ assignedTo: me.id, openOnly: true }),
    companyRepo.list()
  ]);
  const companyMap = new Map(companies.map((c) => [c.id, c.name]));
  const top = sortByDueAsc(tasks).slice(0, 5);

  return (
    <div className="liquid-surface p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-semibold text-ink-700">あなたの未完了ToDo</div>
          <div className="text-[11px] text-ink-500 mt-0.5">期日が近い順 (上位5件)</div>
        </div>
        <Link
          href="/tasks"
          className="text-[11px] text-ink-700 hover:underline font-medium"
        >
          すべて見る →
        </Link>
      </div>
      {top.length === 0 ? (
        <div className="text-sm text-ink-500 py-6 text-center">未完了のToDoはありません</div>
      ) : (
        <ul className="space-y-2">
          {top.map((t) => {
            const overdue = isOverdue(t, TODAY);
            return (
              <li
                key={t.id}
                className={[
                  "rounded-lg border p-2.5 bg-white",
                  overdue ? "border-rose-300 bg-rose-50/30" : "border-ink-100"
                ].join(" ")}
              >
                <Link
                  href={`/companies/${t.companyId}`}
                  className="block text-xs text-ink-500 hover:underline"
                >
                  {companyMap.get(t.companyId) ?? t.companyId}
                </Link>
                <div className="text-sm font-medium text-ink-900 mt-0.5">{t.title}</div>
                <div className="text-[11px] text-ink-500 mt-1 flex items-center gap-2">
                  {t.dueDate && (
                    <span className={overdue ? "text-rose-600 font-semibold" : ""}>
                      期日: {t.dueDate}
                      {overdue && " (期限切れ)"}
                    </span>
                  )}
                  <span>優先度: {TASK_PRIORITY_LABEL[t.priority]}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
