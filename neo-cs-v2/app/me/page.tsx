import Link from "next/link";
import { TopNavServer } from "@/components/TopNavServer";
import {
  emailThreads,
  emailMessages,
  aiExtractions,
  AiExtractionType
} from "@/lib/mock/email";
import { companies } from "@/lib/mock/entities";
import { activeContracts, contractOnboardingItems } from "@/lib/mock/onboarding";
import { weeklyReviews, CURRENT_WEEK_MONDAY } from "@/lib/mock/weekly";
import { churnRecords, reasonCategoryLabels } from "@/lib/mock/churn";
import { allContracts } from "@/lib/mock/onboarding";
import { userRepo, contractRepo, churnSignalRepo } from "@/lib/repository";
import { getPermissionContext } from "@/lib/auth/server";
import { canSeeManagerView, effectiveRole } from "@/lib/auth/permissions";
import { products as allProducts, productByCode } from "@/lib/mock/data";

const TODAY = "2026-04-24";
const FALLBACK_USER = "古野";

const TYPE_LABEL: Record<AiExtractionType, string> = {
  onboarding_task_done: "オンボ完了",
  stakeholder_change: "関係者変更",
  negative_signal: "ネガティブ",
  next_action: "次アクション",
  renewal_signal: "更新シグナル"
};
const TYPE_COLOR: Record<AiExtractionType, string> = {
  onboarding_task_done: "#10B981",
  stakeholder_change: "#8B5CF6",
  negative_signal: "#EF4444",
  next_action: "#3D9EFF",
  renewal_signal: "#F59E0B"
};

function isOverdue(d?: string) {
  return d ? new Date(d) < new Date(TODAY) : false;
}

function daysBetween(a: string, b: string) {
  return Math.ceil(
    (new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24)
  );
}

export default async function MyPage() {
  const me = await userRepo.getCurrent();
  const CURRENT_USER = me?.name ?? FALLBACK_USER;
  // 1. 自分宛て未対応メール
  const myThreads = emailThreads.filter((t) => t.assignee === CURRENT_USER);
  const myOpenThreads = myThreads
    .filter((t) => t.status === "new" || t.status === "in_progress")
    .sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1));
  const mySlaOver = myOpenThreads.filter((t) => isOverdue(t.slaDeadline));

  // 2. 自分関連のAI抽出（自分担当スレッドの pending）
  const myThreadIds = new Set(myThreads.map((t) => t.id));
  const myPendingExtractions = aiExtractions
    .filter((e) => e.status === "pending" && myThreadIds.has(e.threadId))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const extractionByType: Record<AiExtractionType, number> = {
    onboarding_task_done: 0,
    stakeholder_change: 0,
    negative_signal: 0,
    next_action: 0,
    renewal_signal: 0
  };
  myPendingExtractions.forEach((e) => extractionByType[e.type]++);

  // 3. 自分担当社のうちWeekly未入力（今週分）
  const myCompanies = companies.filter((c) => c.ownerName === CURRENT_USER);
  const myContracts = activeContracts.filter((c) => c.ownerName === CURRENT_USER);
  // 「自分担当(企業×研修)」のうち今週Weekly未入力なもの
  const reviewKey = (companyId: string, product: string) => `${companyId}:${product}`;
  const thisWeekReviewed = new Set(
    weeklyReviews
      .filter((r) => r.weekStart === CURRENT_WEEK_MONDAY)
      .map((r) => reviewKey(r.companyId, r.product))
  );
  const missingWeekly = myContracts
    .filter(
      (c) =>
        c.status !== "renewed" &&
        c.status !== "churned" &&
        !thisWeekReviewed.has(reviewKey(c.companyId, c.product))
    )
    .slice(0, 5);
  const companyById = new Map(companies.map((c) => [c.id, c]));

  // 4. 自分担当のRed/Yellow契約
  const riskContracts = myContracts
    .filter(
      (c) =>
        c.healthScore?.color === "red" || c.healthScore?.color === "yellow"
    )
    .sort((a, b) => {
      const order = { red: 0, yellow: 1, green: 2 } as const;
      return (
        order[a.healthScore!.color] - order[b.healthScore!.color]
      );
    });

  // 5. 期限近いオンボタスク（自分担当・7日以内）
  const myOnboardingTasks = contractOnboardingItems
    .filter(
      (i) =>
        i.assignee === CURRENT_USER &&
        i.status !== "done" &&
        daysBetween(i.dueDate, TODAY) <= 7
    )
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));

  // ヘッダ統計
  const todayTaskCount = myOnboardingTasks.filter(
    (t) => daysBetween(t.dueDate, TODAY) <= 0
  ).length;

  // 6. 解約後の再アプローチ予定（自分担当・7日以内・notified=false）
  const myChurnRecords = churnRecords.filter((r) => {
    const c = allContracts.find((ct) => ct.id === r.contractId);
    return c?.ownerName === CURRENT_USER;
  });
  const reapproachUpcoming = myChurnRecords.filter((r) => {
    if (r.notified) return false;
    if (!r.nextActionDate) return false;
    const d = daysBetween(r.nextActionDate, TODAY);
    return d >= 0 && d <= 7;
  });
  const reapproachAll7d = myChurnRecords
    .filter((r) => {
      if (!r.nextActionDate) return false;
      const d = daysBetween(r.nextActionDate, TODAY);
      return d >= 0;
    })
    .sort((a, b) => (a.nextActionDate! < b.nextActionDate! ? -1 : 1));

  // マネージャー視点サマリー（admin/manager のみ）
  const ctx = await getPermissionContext();
  const showManagerSummary =
    canSeeManagerView(ctx) && effectiveRole(ctx) !== "member";
  const managerSections = showManagerSummary
    ? await buildManagerSummary(ctx)
    : null;

  return (
    <>
      <TopNavServer current="/me" />
      <main className="mx-auto max-w-[1400px] px-6 py-8 space-y-6">
        {/* マネージャー視点サマリー */}
        {managerSections && managerSections.length > 0 && (
          <section className="liquid-surface p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base font-semibold text-ink-900">
                  マネージャー視点サマリー
                </h2>
                <div className="text-xs text-ink-500 mt-0.5">
                  担当事業の今週進捗・アラート・契約更新の概況
                </div>
              </div>
              <Link
                href="/manager"
                className="text-xs text-ink-700 hover:text-ink-900 font-medium"
              >
                マネージャー画面へ →
              </Link>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {managerSections.map((s) => (
                <div
                  key={s.code}
                  className="rounded-xl border border-ink-100 p-4 bg-white"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ background: s.accent }}
                    />
                    <span className="text-sm font-semibold text-ink-900">
                      {s.name}
                    </span>
                    <span className="ml-auto text-[11px] text-ink-500">
                      {s.contractsCount}社
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <SmallStat label="今週未提出" value={s.weeklyMissing} warn />
                    <SmallStat label="アラート" value={s.alertsCount} warn />
                    <SmallStat label="更新60日" value={s.renewalSoon} warn />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ユーザヘッダ */}
        <section className="liquid-surface p-6 relative overflow-hidden">
          <div
            className="liquid-blob"
            style={{
              top: -80,
              right: -40,
              width: 220,
              height: 220,
              background: "#3D9EFF",
              opacity: 0.12
            }}
          />
          <div className="relative flex items-start justify-between gap-6 flex-wrap">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-14 h-14 rounded-full bg-ink-900 text-white flex items-center justify-center text-lg font-bold">
                古
              </div>
              <div className="min-w-0">
                <div className="text-xs text-ink-500">マイページ</div>
                <h1 className="text-2xl font-bold tracking-tight text-ink-900">
                  古野 健太
                </h1>
                <div className="text-xs text-ink-500 mt-0.5">
                  Customer Success / 福岡
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <Stat label="担当企業" value={myCompanies.length} />
              <Stat
                label="本日タスク"
                value={todayTaskCount}
                accent={todayTaskCount > 0 ? "text-rose-600" : undefined}
              />
              <Stat label="未対応メール" value={myOpenThreads.length} />
              <Stat
                label="SLA超過"
                value={mySlaOver.length}
                accent={mySlaOver.length > 0 ? "text-rose-600" : undefined}
              />
            </div>
          </div>
        </section>

        {/* 1. 未対応メール */}
        <Section
          icon="🔴"
          title="未対応メール"
          link={{ href: "/inbox", label: "すべて見る →" }}
          rightSlot={
            <span className="text-xs text-ink-500">
              {myOpenThreads.length} 件{" "}
              {mySlaOver.length > 0 && (
                <span className="text-rose-600 font-semibold">
                  / SLA超過 {mySlaOver.length}
                </span>
              )}
            </span>
          }
        >
          {myOpenThreads.length === 0 ? (
            <Empty>未対応のメールはありません</Empty>
          ) : (
            <ul className="space-y-2">
              {myOpenThreads.slice(0, 5).map((t) => {
                const co = companyById.get(t.companyId);
                const overdue = isOverdue(t.slaDeadline);
                return (
                  <li key={t.id}>
                    <Link
                      href={`/inbox?threadId=${t.id}`}
                      className="block rounded-xl border border-ink-100 p-3 bg-white hover:bg-ink-50"
                    >
                      <div className="flex items-center gap-2 text-[11px]">
                        {overdue && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 font-medium">
                            SLA超過
                          </span>
                        )}
                        <span className="text-ink-500">
                          {t.status === "new" ? "未対応" : "対応中"}
                        </span>
                        <span className="ml-auto text-ink-500">
                          {t.lastMessageAt}
                        </span>
                      </div>
                      <div className="mt-1 text-sm font-semibold text-ink-900 truncate">
                        {co?.name ?? t.companyId}
                      </div>
                      <div className="text-xs text-ink-700 truncate">
                        {t.subject}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* 2. AI抽出 承認待ち */}
        <Section
          icon="🤖"
          title="AI抽出 承認待ち"
          link={{ href: "/inbox/extractions", label: "すべて見る →" }}
          rightSlot={
            <div className="flex items-center gap-1.5 text-[10px]">
              {(Object.keys(extractionByType) as AiExtractionType[]).map((t) =>
                extractionByType[t] > 0 ? (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-full font-medium"
                    style={{
                      color: TYPE_COLOR[t],
                      background: `${TYPE_COLOR[t]}14`
                    }}
                  >
                    {TYPE_LABEL[t]} {extractionByType[t]}
                  </span>
                ) : null
              )}
            </div>
          }
        >
          {myPendingExtractions.length === 0 ? (
            <Empty>承認待ちはありません</Empty>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {myPendingExtractions.slice(0, 3).map((e) => {
                const t = emailThreads.find((th) => th.id === e.threadId);
                const co = t ? companyById.get(t.companyId) : null;
                return (
                  <li
                    key={e.id}
                    className="rounded-xl border border-ink-100 p-3 bg-white"
                  >
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{
                        color: TYPE_COLOR[e.type],
                        background: `${TYPE_COLOR[e.type]}14`
                      }}
                    >
                      {TYPE_LABEL[e.type]}
                    </span>
                    <div className="mt-1.5 text-xs text-ink-500">{co?.name}</div>
                    <div className="text-sm text-ink-900 line-clamp-2 leading-snug mt-0.5">
                      {e.suggestion}
                    </div>
                    <div className="text-[10px] text-ink-500 mt-1">
                      確信度 {Math.round(e.confidence * 100)}%
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* 3. 今週の未入力Weekly */}
        <Section
          icon="📝"
          title="今週の未入力Weekly"
          link={{ href: "/weekly", label: "週次画面 →" }}
          rightSlot={
            <span className="text-xs text-ink-500">{missingWeekly.length} 件</span>
          }
        >
          {missingWeekly.length === 0 ? (
            <Empty>今週分はすべて入力済み</Empty>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {missingWeekly.map((c) => {
                const co = companyById.get(c.companyId);
                return (
                  <li
                    key={c.id}
                    className="rounded-xl border border-ink-100 p-3 bg-white"
                  >
                    <div className="text-sm font-semibold text-ink-900 truncate">
                      {co?.name ?? c.companyId}
                    </div>
                    <div className="text-[11px] text-ink-500 mt-0.5">
                      {c.product} ・ {c.courseKey}
                    </div>
                    <Link
                      href={`/companies/${c.companyId}`}
                      className="mt-1.5 inline-block text-[11px] text-ink-700 hover:underline"
                    >
                      企業カルテへ →
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* 4. Red/Yellow企業 */}
        <Section
          icon="⚠️"
          title="担当のRed/Yellow企業"
          rightSlot={
            <span className="text-xs text-ink-500">{riskContracts.length} 件</span>
          }
        >
          {riskContracts.length === 0 ? (
            <Empty>Red/Yellowはありません</Empty>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {riskContracts.map((c) => {
                const co = companyById.get(c.companyId);
                const color = c.healthScore!.color;
                return (
                  <li key={c.id}>
                    <Link
                      href={`/companies/${c.companyId}`}
                      className="block rounded-xl border border-ink-100 p-3 bg-white hover:bg-ink-50"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{
                            background: color === "red" ? "#EF4444" : "#F59E0B"
                          }}
                        />
                        <span className="text-sm font-semibold text-ink-900 truncate">
                          {co?.name ?? c.companyId}
                        </span>
                        <span
                          className={[
                            "ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                            color === "red"
                              ? "bg-rose-100 text-rose-600"
                              : "bg-amber-100 text-amber-700"
                          ].join(" ")}
                        >
                          {color.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[11px] text-ink-500 mt-1">
                        {c.product} ・ 期末 {c.endDate ?? "—"}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* 6. 解約後の再アプローチ予定 */}
        <Section
          icon="🔔"
          title="解約後の再アプローチ予定"
          link={{ href: "/renewal", label: "すべて見る → /renewal" }}
          rightSlot={
            <span className="text-xs text-ink-500">
              7日以内 <span className="text-ink-900 font-semibold">{reapproachUpcoming.length}</span> 件
            </span>
          }
        >
          {reapproachAll7d.length === 0 ? (
            <Empty>再アプローチ予定はありません</Empty>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {reapproachAll7d.slice(0, 3).map((r) => {
                const contract = allContracts.find((c) => c.id === r.contractId);
                const co = contract ? companyById.get(contract.companyId) : null;
                const days = r.nextActionDate ? daysBetween(r.nextActionDate, TODAY) : 0;
                return (
                  <li
                    key={r.contractId}
                    className="rounded-xl border border-ink-100 p-3 bg-white"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={[
                          "px-2 py-0.5 rounded-full text-[10px] font-medium",
                          days <= 7
                            ? "bg-rose-100 text-rose-600"
                            : "bg-ink-50 text-ink-700"
                        ].join(" ")}
                      >
                        あと{days}日
                      </span>
                      <span className="text-[10px] text-ink-500 ml-auto">
                        {reasonCategoryLabels[r.reasonCategory]}
                      </span>
                    </div>
                    <div className="mt-1.5 text-sm font-semibold text-ink-900 truncate">
                      {co?.name ?? r.contractId}
                    </div>
                    <div className="text-[11px] text-ink-500 mt-0.5">
                      予定日 {r.nextActionDate}
                    </div>
                    <div className="text-xs text-ink-700 mt-1 line-clamp-2">
                      {r.nextActionNote ?? "—"}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* 5. 期限近いオンボタスク */}
        <Section
          icon="📅"
          title="期限近いオンボタスク（7日以内）"
          link={{ href: "/onboarding", label: "オンボ画面 →" }}
          rightSlot={
            <span className="text-xs text-ink-500">{myOnboardingTasks.length} 件</span>
          }
        >
          {myOnboardingTasks.length === 0 ? (
            <Empty>期限近いオンボタスクはありません</Empty>
          ) : (
            <ul className="space-y-1.5">
              {myOnboardingTasks.slice(0, 8).map((task) => {
                const contract = activeContracts.find((c) => c.id === task.contractId);
                const co = contract ? companyById.get(contract.companyId) : null;
                const days = daysBetween(task.dueDate, TODAY);
                const isOd = task.status === "overdue" || days < 0;
                return (
                  <li
                    key={task.id}
                    className="rounded-lg border border-ink-100 p-2.5 bg-white flex items-center gap-3"
                  >
                    <span
                      className={[
                        "px-2 py-0.5 rounded-full text-[10px] shrink-0",
                        isOd
                          ? "bg-rose-100 text-rose-600"
                          : days <= 2
                          ? "bg-amber-100 text-amber-700"
                          : "bg-ink-50 text-ink-700"
                      ].join(" ")}
                    >
                      {isOd ? `${-days}日超過` : `あと${days}日`}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-ink-900 truncate">{task.name}</div>
                      <div className="text-[11px] text-ink-500">
                        {co?.name ?? "—"} ・ 期限 {task.dueDate}
                      </div>
                    </div>
                    {contract && (
                      <Link
                        href={`/onboarding/${contract.id}`}
                        className="text-[11px] text-ink-700 hover:underline shrink-0"
                      >
                        →
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </main>
    </>
  );
}

function Stat({
  label,
  value,
  accent
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${accent ?? "text-ink-900"}`}>
        {value}
      </div>
      <div className="text-[10px] text-ink-500">{label}</div>
    </div>
  );
}

function Section({
  icon,
  title,
  link,
  rightSlot,
  children
}: {
  icon: string;
  title: string;
  link?: { href: string; label: string };
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="liquid-surface p-5">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <h2 className="text-sm font-semibold text-ink-700">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          {rightSlot}
          {link && (
            <Link
              href={link.href}
              className="text-[11px] text-ink-700 hover:underline"
            >
              {link.label}
            </Link>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-ink-100 p-6 text-center text-xs text-ink-500">
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────
// マネージャー視点サマリー（admin / manager のみ）
// 担当事業ごとに今週未提出の週次・未解決アラート・更新60日内の件数を集計
// ─────────────────────────────────────────────
type ManagerSection = {
  code: string;
  name: string;
  accent: string;
  contractsCount: number;
  weeklyMissing: number;
  alertsCount: number;
  renewalSoon: number;
};

async function buildManagerSummary(
  ctx: Awaited<ReturnType<typeof getPermissionContext>>
): Promise<ManagerSection[]> {
  const codes =
    ctx.actor?.role === "admin"
      ? allProducts.map((p) => p.code as string)
      : ctx.programs.map((p) => p.productCode);

  if (codes.length === 0) return [];

  const [allActiveContracts, allSignals] = await Promise.all([
    contractRepo.list({ activeOnly: true }),
    churnSignalRepo.list({ unresolvedOnly: true }).catch(() => [])
  ]);

  const horizon = addDaysIso(TODAY, 60);

  return codes.map((code) => {
    const product = productByCode[code as keyof typeof productByCode];
    const contracts = allActiveContracts.filter((c) => c.product === code);
    const contractIds = new Set(contracts.map((c) => c.id));
    const companyIds = new Set(contracts.map((c) => c.companyId));

    // 今週未提出: 担当事業の active 契約のうち、今週レビューが無い社の数
    const reviewedCompanyIds = new Set(
      weeklyReviews
        .filter(
          (r) =>
            r.product === code && r.weekStart === CURRENT_WEEK_MONDAY
        )
        .map((r) => r.companyId)
    );
    const weeklyMissing = Array.from(companyIds).filter(
      (cid) => !reviewedCompanyIds.has(cid)
    ).length;

    const alertsCount = allSignals.filter((s) => contractIds.has(s.contractId)).length;
    const renewalSoon = contracts.filter((c) => c.endDate && c.endDate <= horizon).length;

    return {
      code,
      name: product?.name ?? code,
      accent: product?.accent ?? "#999",
      contractsCount: contracts.length,
      weeklyMissing,
      alertsCount,
      renewalSoon
    };
  });
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function SmallStat({
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
      <div className={`text-lg font-bold ${cls}`}>{value}</div>
      <div className="text-[10px] text-ink-500">{label}</div>
    </div>
  );
}
