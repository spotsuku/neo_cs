// マネージャー drill-down: メンバー個別ページ
// 担当社一覧 / 直近の活動 / 未完了タスク / 期限超過タスクを集約表示

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TopNavServer } from "@/components/nav/TopNavServer";
import { getPermissionContext } from "@/lib/auth/server";
import { canSeeManagerView } from "@/lib/auth/permissions";
import {
  userRepo,
  assignmentRepo,
  companyRepo,
  contractRepo,
  weeklyReviewRepo,
  companyTaskRepo,
  meetingLogRepo,
  userProgramRoleRepo,
  healthSnapshotRepo,
  churnSignalRepo
} from "@/lib/repository/server";
import { productByCode } from "@/lib/mock/data";
import { currentWeekMondayISO } from "@/lib/domain/week/week";

export const metadata: Metadata = {
  title: "メンバー詳細 | マネージャー | NEO CS"
};

const TODAY = new Date().toISOString().slice(0, 10);

export default async function MemberDetailPage({
  params
}: {
  params: Promise<{ userId: string }>;
}) {
  const ctx = await getPermissionContext();
  if (!canSeeManagerView(ctx)) redirect("/");

  const { userId } = await params;
  const user = await userRepo.getById(userId);
  if (!user) return notFound();
  if (user.role === "external") return notFound(); // external はメンバー詳細対象外

  // 「今週の月曜」をリクエスト時刻から動的に算出
  const CURRENT_WEEK_MONDAY = currentWeekMondayISO();

  const [
    assignments,
    companies,
    contracts,
    weekly,
    tasks,
    programRoles,
    latestSnapshots,
    allSignals
  ] = await Promise.all([
    assignmentRepo.listByUser(userId, { activeOnly: true }).catch(() => []),
    companyRepo.list(),
    contractRepo.list({ activeOnly: true }),
    weeklyReviewRepo.list().catch(() => []),
    companyTaskRepo.list({ assignedTo: userId, openOnly: true }).catch(() => []),
    userProgramRoleRepo.listByUser(userId),
    healthSnapshotRepo.latestAll().catch(() => []),
    churnSignalRepo.list({ unresolvedOnly: true }).catch(() => [])
  ]);

  const companyById = new Map(companies.map((c) => [c.id, c]));
  const myCompanyIds = new Set(
    assignments.filter((a) => a.role === "primary").map((a) => a.companyId)
  );

  const myContracts = contracts.filter((c) => myCompanyIds.has(c.companyId));

  // 直近の活動（自分の担当社で本人が記入した meeting / weekly）
  const meetingsByCompany = await Promise.all(
    Array.from(myCompanyIds).slice(0, 30).map((cid) =>
      meetingLogRepo.listByCompany(cid, { sort: "date desc", limit: 5 }).catch(() => [])
    )
  );
  const recentMeetings = meetingsByCompany
    .flat()
    .filter((m) => m.authorName === user.name)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 5);

  const myWeeklyThisWeek = weekly.filter(
    (r) =>
      myCompanyIds.has(r.companyId) &&
      r.weekStart === CURRENT_WEEK_MONDAY &&
      r.authorName === user.name
  );

  const overdueTasks = tasks
    .filter((t) => t.dueDate && t.dueDate < TODAY)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));

  // 担当企業ごとの「今週レビュー有無 / health / 未対応アラート」進捗
  const snapshotByContract = new Map(latestSnapshots.map((s) => [s.contractId, s]));

  type CompanyProgressRow = {
    companyId: string;
    companyName: string;
    productLabels: string[];
    accent: string;
    weeklyDone: boolean;
    healthColor: "green" | "yellow" | "red" | null;
    alertCount: number;
  };

  const companyProgress: CompanyProgressRow[] = Array.from(myCompanyIds).map((cid) => {
    const co = companyById.get(cid);
    const myCs = myContracts.filter((c) => c.companyId === cid);
    const productCodes = myCs.map((c) => c.product as string);
    const labels = Array.from(
      new Set(productCodes.map((pc) => productByCode[pc as keyof typeof productByCode]?.shortName ?? pc))
    );
    const accent =
      productByCode[productCodes[0] as keyof typeof productByCode]?.accent ?? "#999";

    // 今週レビュー（事業跨ぎで 1 件でも記入されていれば done）
    const weeklyDone = weekly.some(
      (r) =>
        r.companyId === cid &&
        r.weekStart === CURRENT_WEEK_MONDAY &&
        productCodes.includes(r.product as string)
    );

    // health: 自身の担当契約のうち最も悪いものを採用 (red > yellow > green)
    let healthColor: "green" | "yellow" | "red" | null = null;
    const order: Record<string, number> = { red: 0, yellow: 1, green: 2 };
    for (const c of myCs) {
      const s = snapshotByContract.get(c.id);
      if (!s?.color) continue;
      if (
        healthColor === null ||
        (order[s.color] ?? 99) < (order[healthColor] ?? 99)
      ) {
        healthColor = s.color;
      }
    }

    // 未対応アラート（自身の担当契約に紐づく churn signals）
    const myContractIds = new Set(myCs.map((c) => c.id));
    const alertCount = allSignals.filter((s) => myContractIds.has(s.contractId)).length;

    return {
      companyId: cid,
      companyName: co?.name ?? cid,
      productLabels: labels,
      accent,
      weeklyDone,
      healthColor,
      alertCount
    };
  });

  companyProgress.sort((a, b) => {
    // health 悪い順 → アラート多い順
    const order: Record<string, number> = { red: 0, yellow: 1, green: 2 };
    const ha = a.healthColor ? order[a.healthColor] : 3;
    const hb = b.healthColor ? order[b.healthColor] : 3;
    if (ha !== hb) return ha - hb;
    return b.alertCount - a.alertCount;
  });

  return (
    <div className="min-h-screen bg-canvas">
      <TopNavServer current="/manager" />
      <main className="mx-auto max-w-[1200px] px-6 py-8 space-y-6">
        <div className="text-xs text-ink-500">
          <Link href="/manager" className="hover:text-ink-700">マネージャー</Link>
          <span className="mx-1.5">/</span>
          <span>メンバー</span>
          <span className="mx-1.5">/</span>
          <span>{user.name}</span>
        </div>

        {/* ヘッダ */}
        <header className="rounded-2xl border border-ink-100 bg-white p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-ink-900 text-white flex items-center justify-center text-lg font-bold">
              {user.name.slice(0, 1)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-ink-500">{user.role}</div>
              <h1 className="text-xl font-bold text-ink-900">{user.name}</h1>
              <div className="text-xs text-ink-500 mt-0.5">{user.email}</div>
            </div>
            <Link
              href={`/settings/users/${user.id}`}
              className="text-xs text-ink-700 hover:text-ink-900"
            >
              ユーザー設定 →
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="担当社（primary）" value={myCompanyIds.size} />
            <Stat label="active 契約" value={myContracts.length} />
            <Stat label="今週レビュー実施" value={myWeeklyThisWeek.length} />
            <Stat
              label="期限超過タスク"
              value={overdueTasks.length}
              warn={overdueTasks.length > 0}
            />
          </div>
        </header>

        {/* 担当事業 × スコープ */}
        <Section title="担当事業 × スコープ">
          {programRoles.length === 0 ? (
            <Empty>担当事業はありません</Empty>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {programRoles.map((r) => {
                const product = productByCode[r.productCode as keyof typeof productByCode];
                return (
                  <li
                    key={r.productCode}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-ink-100 bg-ink-50 text-xs text-ink-700"
                  >
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{ background: product?.accent ?? "#999" }}
                    />
                    <span>{product?.name ?? r.productCode}</span>
                    <span className="text-ink-500">·</span>
                    <span>{SCOPE_LABEL[r.scopeRole]}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* 担当企業の進捗 */}
        <Section title="担当企業の進捗" subtitle={`${companyProgress.length} 社`}>
          {companyProgress.length === 0 ? (
            <Empty>担当社がありません</Empty>
          ) : (
            <div className="overflow-hidden rounded-xl border border-ink-100">
              <table className="w-full text-sm">
                <thead className="bg-ink-50/60 text-[11px] text-ink-500">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">企業</th>
                    <th className="text-left font-medium px-3 py-2">事業</th>
                    <th className="text-center font-medium px-3 py-2">今週</th>
                    <th className="text-center font-medium px-3 py-2">Health</th>
                    <th className="text-right font-medium px-3 py-2">アラート</th>
                  </tr>
                </thead>
                <tbody>
                  {companyProgress.map((r) => (
                    <tr key={r.companyId} className="border-t border-ink-100 hover:bg-ink-50/40">
                      <td className="px-3 py-2">
                        <Link href={`/companies/${r.companyId}`} className="text-ink-900 hover:underline">
                          {r.companyName}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {r.productLabels.map((l) => (
                            <span
                              key={l}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-ink-50 text-[10px] text-ink-700"
                            >
                              <span className="inline-block w-1 h-1 rounded-full" style={{ background: r.accent }} />
                              {l}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] ${
                            r.weeklyDone
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                          title={r.weeklyDone ? "今週レビュー記入済" : "今週レビュー未記入"}
                        >
                          {r.weeklyDone ? "✓" : "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <HealthDot color={r.healthColor} />
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums ${r.alertCount > 0 ? "text-rose-600 font-medium" : "text-ink-500"}`}>
                        {r.alertCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* 期限超過タスク */}
        <Section
          title="期限超過タスク"
          subtitle={`${overdueTasks.length} 件`}
          accent={overdueTasks.length > 0 ? "rose" : undefined}
        >
          {overdueTasks.length === 0 ? (
            <Empty>期限超過タスクはありません</Empty>
          ) : (
            <ul className="divide-y divide-ink-100">
              {overdueTasks.slice(0, 20).map((t) => (
                <li key={t.id} className="py-2">
                  <Link href={`/companies/${t.companyId}`} className="block hover:underline">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-ink-900 truncate">{t.title}</span>
                      <span className="text-[11px] text-rose-600 tabular-nums shrink-0">
                        {t.dueDate}
                      </span>
                    </div>
                    <div className="text-[11px] text-ink-500 truncate">
                      {companyById.get(t.companyId)?.name ?? t.companyId}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* 直近の面談 */}
        <Section title="直近の面談ログ" subtitle={`${recentMeetings.length} 件`}>
          {recentMeetings.length === 0 ? (
            <Empty>直近の面談ログはありません</Empty>
          ) : (
            <ul className="divide-y divide-ink-100">
              {recentMeetings.map((m) => (
                <li key={m.id} className="py-2">
                  <Link href={`/companies/${m.companyId}`} className="block hover:underline">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-ink-900 truncate">{m.summary ?? "(無題)"}</span>
                      <span className="text-[11px] text-ink-500 tabular-nums shrink-0">{m.date}</span>
                    </div>
                    <div className="text-[11px] text-ink-500 truncate">
                      {companyById.get(m.companyId)?.name ?? m.companyId}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </main>
    </div>
  );
}

const SCOPE_LABEL: Record<string, string> = {
  viewer: "閲覧",
  editor: "項目編集",
  template_editor: "テンプレ編集"
};

function Stat({
  label,
  value,
  warn
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  const cls = warn && value > 0 ? "text-rose-600" : "text-ink-900";
  return (
    <div>
      <div className="text-[10px] text-ink-500">{label}</div>
      <div className={`text-2xl font-bold ${cls}`}>{value}</div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  accent,
  children
}: {
  title: string;
  subtitle?: string;
  accent?: "rose";
  children: React.ReactNode;
}) {
  const titleCls = accent === "rose" ? "text-rose-700" : "text-ink-900";
  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-5">
      <header className="mb-3 flex items-end justify-between">
        <h2 className={`text-base font-semibold ${titleCls}`}>{title}</h2>
        {subtitle && <span className="text-[11px] text-ink-500">{subtitle}</span>}
      </header>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-ink-100 px-3 py-6 text-center text-xs text-ink-500">
      {children}
    </div>
  );
}

function HealthDot({ color }: { color: "green" | "yellow" | "red" | null }) {
  if (color === null) return <span className="text-ink-300">—</span>;
  const bg = color === "green" ? "#3B82F6" : color === "yellow" ? "#F59E0B" : "#EF4444";
  return (
    <span
      className="inline-block w-2 h-2 rounded-full"
      style={{ background: bg }}
      title={color}
    />
  );
}
