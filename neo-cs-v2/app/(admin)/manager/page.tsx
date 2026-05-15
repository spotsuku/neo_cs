// マネージャー専用ダッシュボード（ベース拡張版）
//
// 表示対象: admin / manager（admin が「メンバー表示」モードに切替中なら redirect）
// 構成:
//   1) 事業別 KPI: 契約数 / 進捗% / アラート / 更新60日 / 今週未提出
//   2) 週次レビュー未記入企業の抽出
//   3) 未実施タスク（期限切れ + 今日締切）
//   4) 未対応アラート（churn signals）
//   5) 各メンバーの稼働管理（担当社数 / 今週レビュー実施 / 未完了タスク）
//
// 後段でセクションごとに drill-down を充実させる前提の「ベース」。
// 数値計算は純関数化して domain 配下に切り出すべきだが、本ベースでは
// 同ファイル内に集約。

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TopNavServer } from "@/components/nav/TopNavServer";
import { getPermissionContext } from "@/lib/auth/server";
import {
  canSeeManagerView,
  effectiveRole,
  assignedProductCodes
} from "@/lib/auth/permissions";
import { products, productByCode } from "@/lib/master";
import {
  contractRepo,
  churnSignalRepo,
  programRepo,
  weeklyReviewRepo,
  companyTaskRepo,
  companyRepo,
  userRepo,
  assignmentRepo,
  onboardingItemRepo,
  surveyRepo
} from "@/lib/repository/server";
import { summarizeProgress } from "@/lib/domain/program/program";
import { currentWeekMondayISO } from "@/lib/domain/week/week";

export const metadata: Metadata = {
  title: "マネージャー | NEO CS",
  description: "担当事業の全体進捗・アラート・契約更新サマリー"
};

const TODAY = new Date().toISOString().slice(0, 10);

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function ManagerPage() {
  const ctx = await getPermissionContext();
  if (!canSeeManagerView(ctx)) redirect("/");
  if (effectiveRole(ctx) !== "admin" && effectiveRole(ctx) !== "manager") {
    redirect("/");
  }

  const myProductCodes =
    ctx.actor?.role === "admin"
      ? products.map((p) => p.code as string)
      : assignedProductCodes(ctx);

  const horizon = addDays(TODAY, 60);
  // 「今週の月曜」はリクエスト時刻から動的に算出 (旧: lib/mock/weekly.CURRENT_WEEK_MONDAY)
  const CURRENT_WEEK_MONDAY = currentWeekMondayISO();

  // ───────────────────────────────────────────────
  // データ取得（並列）
  // ───────────────────────────────────────────────
  const [
    allContracts,
    allSignals,
    allTerms,
    allWeekly,
    allTasks,
    allCompanies,
    allUsers,
    allAssignments,
    allSurveys
  ] = await Promise.all([
    contractRepo.list({ activeOnly: true }),
    churnSignalRepo.list({ unresolvedOnly: true }).catch(() => []),
    programRepo.listTerms({ status: "active" }).catch(() => []),
    weeklyReviewRepo.list().catch(() => []),
    companyTaskRepo.list({ openOnly: true }).catch(() => []),
    companyRepo.list(),
    userRepo.list({ activeOnly: true }),
    assignmentRepo.list({ activeOnly: true }).catch(() => []),
    surveyRepo.list().catch(() => [])
  ]);

  const companyById = new Map(allCompanies.map((c) => [c.id, c]));

  // 担当事業に絞った契約
  const myContracts = allContracts.filter((c) =>
    myProductCodes.includes(c.product as string)
  );
  const myContractIds = new Set(myContracts.map((c) => c.id));
  const myCompanyIds = new Set(myContracts.map((c) => c.companyId));

  // ───────────────────────────────────────────────
  // 6) onboarding サマリー: 未完了 / 期限超過 / 完了率
  // ───────────────────────────────────────────────
  const onboardingItems = await onboardingItemRepo
    .listByContractIds(Array.from(myContractIds))
    .catch(() => []);
  const onboardingSummary = {
    total: onboardingItems.length,
    done: onboardingItems.filter((i) => i.status === "done").length,
    overdue: onboardingItems.filter(
      (i) => i.status !== "done" && i.dueDate && i.dueDate < TODAY
    ).length,
    pct:
      onboardingItems.length === 0
        ? 0
        : Math.round(
            (onboardingItems.filter((i) => i.status === "done").length /
              onboardingItems.length) *
              100
          )
  };

  // ───────────────────────────────────────────────
  // 7) surveys サマリー: open 調査の回答率
  // ───────────────────────────────────────────────
  const myContractIdsArr = Array.from(myContractIds);
  const mySurveys = allSurveys.filter(
    (s) => s.contractId && myContractIdsArr.includes(s.contractId)
  );
  const openSurveys = mySurveys.filter((s) => s.status === "open");
  const surveyAggregate = await Promise.all(
    openSurveys.map(async (s) => {
      const responses = await surveyRepo.listResponses(s.id).catch(() => []);
      const expected = s.expectedRespondentCount || 1;
      const pct = Math.min(100, Math.round((responses.length / expected) * 100));
      return {
        id: s.id,
        title: s.title,
        productSessionLabel: s.productSessionLabel,
        received: responses.length,
        expected: s.expectedRespondentCount,
        pct
      };
    })
  );

  // ───────────────────────────────────────────────
  // 1) 事業別 KPI
  // ───────────────────────────────────────────────
  const kpiSections = await Promise.all(
    myProductCodes.map(async (code) => {
      const product = productByCode[code as keyof typeof productByCode];
      const contracts = myContracts.filter((c) => c.product === code);
      const contractIds = new Set(contracts.map((c) => c.id));
      const companyIds = new Set(contracts.map((c) => c.companyId));
      const signals = allSignals.filter((s) => contractIds.has(s.contractId));
      const terms = allTerms.filter((t) => t.productCode === code);

      const cells = (
        await Promise.all(
          terms.map((t) => programRepo.listCells(t.id).catch(() => []))
        )
      ).flat();
      const progress = summarizeProgress(
        cells.map((c) => ({ status: c.status, dueDate: c.dueDate ?? null })),
        TODAY
      );

      const reviewedCompanies = new Set(
        allWeekly
          .filter((r) => r.product === code && r.weekStart === CURRENT_WEEK_MONDAY)
          .map((r) => r.companyId)
      );
      const weeklyMissing = Array.from(companyIds).filter(
        (cid) => !reviewedCompanies.has(cid)
      ).length;

      const renewalSoon = contracts.filter(
        (c) => c.endDate && c.endDate <= horizon
      ).length;

      return {
        code,
        name: product?.name ?? code,
        accent: product?.accent ?? "#999",
        contractsCount: contracts.length,
        progress,
        signalsCount: signals.length,
        renewalSoon,
        weeklyMissing
      };
    })
  );

  // ───────────────────────────────────────────────
  // 2) 週次レビュー未記入企業（事業別）
  // ───────────────────────────────────────────────
  type MissingRow = {
    companyId: string;
    companyName: string;
    productCode: string;
    productName: string;
    accent: string;
  };
  const missingWeekly: MissingRow[] = [];
  for (const c of myContracts) {
    const reviewed = allWeekly.some(
      (r) =>
        r.companyId === c.companyId &&
        r.product === c.product &&
        r.weekStart === CURRENT_WEEK_MONDAY
    );
    if (reviewed) continue;
    const product = productByCode[c.product as keyof typeof productByCode];
    missingWeekly.push({
      companyId: c.companyId,
      companyName: companyById.get(c.companyId)?.name ?? c.companyId,
      productCode: c.product as string,
      productName: product?.shortName ?? c.product,
      accent: product?.accent ?? "#999"
    });
  }

  // ───────────────────────────────────────────────
  // 3) 未実施タスク（期限切れ + 今日締切）
  // ───────────────────────────────────────────────
  const myOpenTasks = allTasks.filter((t) => myCompanyIds.has(t.companyId));
  const overdueTasks = myOpenTasks
    .filter((t) => t.dueDate && t.dueDate < TODAY)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
    .slice(0, 10);
  const dueTodayTasks = myOpenTasks
    .filter((t) => t.dueDate === TODAY)
    .slice(0, 10);

  // ───────────────────────────────────────────────
  // 4) 未対応アラート
  // ───────────────────────────────────────────────
  const myAlerts = allSignals
    .filter((s) => myContractIds.has(s.contractId))
    .slice(0, 10);

  // ───────────────────────────────────────────────
  // 5) メンバー稼働管理
  // ───────────────────────────────────────────────
  type MemberRow = {
    userId: string;
    name: string;
    role: string;
    primaryCount: number;
    weeklyDoneThisWeek: number;
    openTaskCount: number;
    overdueTaskCount: number;
  };
  const members: MemberRow[] = allUsers
    .filter((u) => u.role !== "external")
    .map((u) => {
      const myPrimary = allAssignments.filter(
        (a) => a.userId === u.id && a.role === "primary"
      );
      const primaryCompanyIds = new Set(myPrimary.map((a) => a.companyId));
      const weeklyDoneThisWeek = allWeekly.filter(
        (r) =>
          primaryCompanyIds.has(r.companyId) &&
          r.weekStart === CURRENT_WEEK_MONDAY &&
          r.authorName === u.name
      ).length;
      const openTasks = allTasks.filter(
        (t) => t.assignedTo === u.id && primaryCompanyIds.has(t.companyId)
      );
      const overdueTaskCount = openTasks.filter(
        (t) => t.dueDate && t.dueDate < TODAY
      ).length;
      return {
        userId: u.id,
        name: u.name,
        role: u.role,
        primaryCount: myPrimary.length,
        weeklyDoneThisWeek,
        openTaskCount: openTasks.length,
        overdueTaskCount
      };
    })
    .sort((a, b) => b.primaryCount - a.primaryCount);

  // ───────────────────────────────────────────────
  // レンダリング
  // ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-canvas">
      <TopNavServer current="/manager" />
      <main className="mx-auto max-w-[1720px] px-6 py-8 space-y-8">
        <header>
          <h1 className="text-xl font-bold text-ink-900">マネージャー</h1>
          <p className="mt-1 text-sm text-ink-500">
            担当事業の全体進捗・アラート・メンバー稼働を一画面で把握
          </p>
        </header>

        {kpiSections.length === 0 ? (
          <div className="rounded-2xl border border-ink-100 bg-white px-6 py-8 text-sm text-ink-500">
            担当事業が割り当てられていません。管理者に事業の割当を依頼してください。
          </div>
        ) : (
          <>
            {/* 1) 事業別 KPI — 各 KPI から該当画面へジャンプ */}
            <section>
              <h2 className="text-base font-semibold text-ink-900 mb-3">事業別 KPI</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {kpiSections.map((s) => (
                  <article
                    key={s.code}
                    className="rounded-2xl border border-ink-100 bg-white p-5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full"
                          style={{ background: s.accent }}
                        />
                        <h3 className="text-base font-semibold text-ink-900">{s.name}</h3>
                      </div>
                      <span className="text-[11px] text-ink-500">
                        {s.contractsCount}社
                      </span>
                    </div>
                    <dl className="mt-4 grid grid-cols-4 gap-2">
                      <DrillStat
                        label="進捗"
                        value={`${s.progress.pct}%`}
                        sub={`${s.progress.done}/${s.progress.total}`}
                        href={`/programs?product=${s.code}`}
                      />
                      <DrillStat
                        label="未提出"
                        value={String(s.weeklyMissing)}
                        warn={s.weeklyMissing > 0}
                        href={`/manager/missing-weekly?product=${s.code}`}
                      />
                      <DrillStat
                        label="アラート"
                        value={String(s.signalsCount)}
                        warn={s.signalsCount > 0}
                        href={`/manager/alerts?product=${s.code}`}
                      />
                      <DrillStat
                        label="更新60日"
                        value={String(s.renewalSoon)}
                        warn={s.renewalSoon > 0}
                        href={`/companies?product=${s.code}`}
                      />
                    </dl>
                  </article>
                ))}
              </div>
            </section>

            {/* 2) 週次レビュー未記入企業 */}
            <Section title="週次レビュー 未記入企業" subtitle={`今週 (${CURRENT_WEEK_MONDAY}〜) の未提出 ${missingWeekly.length} 件`}>
              {missingWeekly.length === 0 ? (
                <Empty>未提出の企業はありません</Empty>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {missingWeekly.slice(0, 20).map((m) => (
                    <li
                      key={`${m.companyId}-${m.productCode}`}
                      className="py-2 flex items-center justify-between gap-3"
                    >
                      <Link
                        href={`/companies/${m.companyId}`}
                        className="flex items-center gap-2 min-w-0 hover:underline"
                      >
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: m.accent }}
                        />
                        <span className="text-sm text-ink-900 truncate">{m.companyName}</span>
                        <span className="text-[11px] text-ink-500 shrink-0">{m.productName}</span>
                      </Link>
                      <Link
                        href={`/weekly?companyId=${m.companyId}&product=${m.productCode}`}
                        className="text-[11px] text-ink-700 hover:text-ink-900 shrink-0"
                      >
                        記入する →
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* 3) 未実施タスク */}
            <div className="grid gap-4 md:grid-cols-2">
              <Section title="期限切れタスク" subtitle={`${overdueTasks.length} 件`} accent="rose">
                {overdueTasks.length === 0 ? (
                  <Empty>期限切れタスクはありません</Empty>
                ) : (
                  <TaskList
                    tasks={overdueTasks}
                    companyById={companyById}
                    today={TODAY}
                  />
                )}
              </Section>
              <Section title="今日締切のタスク" subtitle={`${dueTodayTasks.length} 件`}>
                {dueTodayTasks.length === 0 ? (
                  <Empty>今日締切のタスクはありません</Empty>
                ) : (
                  <TaskList
                    tasks={dueTodayTasks}
                    companyById={companyById}
                    today={TODAY}
                  />
                )}
              </Section>
            </div>

            {/* 4) 未対応アラート */}
            <Section title="未対応アラート (Churn シグナル)" subtitle={`${myAlerts.length} 件`} accent="rose">
              {myAlerts.length === 0 ? (
                <Empty>未対応アラートはありません</Empty>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {myAlerts.map((s) => {
                    const company = companyById.get(s.companyId);
                    return (
                      <li key={s.id} className="py-2 flex items-center justify-between gap-3">
                        <Link
                          href={`/companies/${s.companyId}`}
                          className="min-w-0 flex-1 hover:underline"
                        >
                          <div className="text-sm text-ink-900 truncate">
                            {company?.name ?? s.companyId}
                          </div>
                          <div className="text-[11px] text-ink-500 truncate">
                            {s.rule} · severity: {s.severity}
                          </div>
                        </Link>
                        <span className="text-[10px] text-ink-500 shrink-0">
                          {s.detectedAt?.slice(0, 10)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            {/* 6) onboarding / surveys サマリー */}
            <div className="grid gap-4 md:grid-cols-2">
              <Section
                title="オンボーディング"
                subtitle={`${onboardingSummary.done}/${onboardingSummary.total} 完了 (${onboardingSummary.pct}%)`}
              >
                <dl className="grid grid-cols-3 gap-3 text-center">
                  <Stat
                    label="完了率"
                    value={`${onboardingSummary.pct}%`}
                    sub={`${onboardingSummary.done}/${onboardingSummary.total}`}
                  />
                  <Stat
                    label="期限超過"
                    value={String(onboardingSummary.overdue)}
                    warn={onboardingSummary.overdue > 0}
                  />
                  <Stat
                    label="未完了"
                    value={String(onboardingSummary.total - onboardingSummary.done)}
                  />
                </dl>
                <div className="mt-3 text-right">
                  <Link
                    href="/onboarding"
                    className="text-[11px] text-ink-700 hover:text-ink-900"
                  >
                    オンボ画面へ →
                  </Link>
                </div>
              </Section>

              <Section title="アンケート" subtitle={`open ${surveyAggregate.length} 件`}>
                {surveyAggregate.length === 0 ? (
                  <Empty>open 中のアンケートはありません</Empty>
                ) : (
                  <ul className="divide-y divide-ink-100">
                    {surveyAggregate.slice(0, 8).map((s) => (
                      <li key={s.id} className="py-2 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/surveys/${s.id}`}
                            className="block text-sm text-ink-900 hover:underline truncate"
                          >
                            {s.title}
                          </Link>
                          <div className="text-[11px] text-ink-500 truncate">
                            {s.productSessionLabel ?? ""}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold tabular-nums">{s.pct}%</div>
                          <div className="text-[10px] text-ink-500 tabular-nums">
                            {s.received}/{s.expected}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>

            {/* 5) メンバー稼働管理 */}
            <Section title="メンバー稼働" subtitle={`${members.length} 名`}>
              <div className="overflow-hidden rounded-xl border border-ink-100">
                <table className="w-full text-sm">
                  <thead className="bg-ink-50/60 text-[11px] text-ink-500">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">名前</th>
                      <th className="text-left font-medium px-3 py-2">ロール</th>
                      <th className="text-right font-medium px-3 py-2">担当社</th>
                      <th className="text-right font-medium px-3 py-2">今週レビュー</th>
                      <th className="text-right font-medium px-3 py-2">未完了タスク</th>
                      <th className="text-right font-medium px-3 py-2">期限超過</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.userId} className="border-t border-ink-100 hover:bg-ink-50/40">
                        <td className="px-3 py-2 text-ink-900">
                          <Link
                            href={`/manager/members/${m.userId}`}
                            className="hover:underline font-medium"
                          >
                            {m.name}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-ink-500 text-xs">{m.role}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{m.primaryCount}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{m.weeklyDoneThisWeek}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{m.openTaskCount}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${m.overdueTaskCount > 0 ? "text-rose-600" : ""}`}>
                          {m.overdueTaskCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────
// 共通コンポーネント
// ─────────────────────────────────────────────
function Stat({
  label,
  value,
  sub,
  warn
}: {
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}) {
  const cls = warn ? "text-rose-600" : "text-ink-900";
  return (
    <div>
      <div className="text-[10px] text-ink-500">{label}</div>
      <div className={`text-lg font-bold ${cls}`}>{value}</div>
      {sub && <div className="text-[10px] text-ink-500">{sub}</div>}
    </div>
  );
}

function DrillStat({
  label,
  value,
  sub,
  warn,
  href
}: {
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
  href: string;
}) {
  const cls = warn ? "text-rose-600" : "text-ink-900";
  return (
    <Link
      href={href}
      className="block rounded-lg -m-1 p-1 hover:bg-ink-50 transition"
      aria-label={`${label} の詳細を見る`}
    >
      <div className="text-[10px] text-ink-500">{label}</div>
      <div className={`text-lg font-bold ${cls}`}>{value}</div>
      {sub && <div className="text-[10px] text-ink-500">{sub}</div>}
    </Link>
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

function TaskList({
  tasks,
  companyById,
  today
}: {
  tasks: import("@/lib/repository/types").CompanyTask[];
  companyById: Map<string, { name: string }>;
  today: string;
}) {
  return (
    <ul className="divide-y divide-ink-100">
      {tasks.map((t) => {
        const overdue = t.dueDate && t.dueDate < today;
        return (
          <li key={t.id} className="py-2">
            <Link
              href={`/companies/${t.companyId}`}
              className="block hover:underline"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-ink-900 truncate">{t.title}</span>
                <span
                  className={`text-[11px] tabular-nums shrink-0 ${
                    overdue ? "text-rose-600" : "text-ink-500"
                  }`}
                >
                  {t.dueDate}
                </span>
              </div>
              <div className="text-[11px] text-ink-500 truncate">
                {companyById.get(t.companyId)?.name ?? t.companyId}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
