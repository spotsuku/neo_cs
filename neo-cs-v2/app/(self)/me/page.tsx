import Link from "next/link";
import { TopNavServer } from "@/components/nav/TopNavServer";
import {
  userRepo,
  companyTaskRepo,
  businessJourneyRepo,
  vocItemRepo,
  chatRepo,
  programRepo,
  companyRepo,
  contractRepo,
  emailRepo,
  aiExtractionRepo,
  onboardingItemRepo
} from "@/lib/repository/server";
import { getPermissionContext } from "@/lib/auth/server";
import { DEFAULT_ORG_ID } from "@/lib/repository/types";
import {
  products,
  productByCode,
  productCourses,
  courseShortName,
  ProductCode
} from "@/lib/master";
import { MeExtractions, MeExtractionItem } from "./MeExtractions";

const TODAY = new Date().toISOString().slice(0, 10);
const FALLBACK_USER = "古野";

// 事業ジャーニーの短縮ラベル
const BUSINESS_STAGE_SHORT: Record<string, string> = {
  kickoff: "立上げ",
  running: "運用中",
  value_articulated: "成果言語化",
  renewal_consideration: "継続検討",
  internal_share: "社内共有",
  approval_prep: "稟議準備",
  verbal_consent: "口頭内諾",
  consent: "内諾",
  upsell: "アップセル"
};

function isOverdue(d?: string) {
  return d ? new Date(d) < new Date(TODAY) : false;
}

function daysBetween(a: string, b: string) {
  return Math.ceil(
    (new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24)
  );
}

type TodoColor = "red" | "amber" | "ink";

type UpcomingTodo = {
  key: string;
  badge: string;
  badgeColor: TodoColor;
  company: string;
  title: string;
  href: string;
  dueDate?: string;
  daysLeft: number; // 期限なしは 9999
  meta?: string;
};

function dueBadge(days: number): { text: string; color: TodoColor } {
  if (days < 0) return { text: `${-days}日超過`, color: "red" };
  if (days === 0) return { text: "本日", color: "red" };
  if (days <= 2) return { text: `あと${days}日`, color: "amber" };
  return { text: `あと${days}日`, color: "ink" };
}

export default async function MyPage() {
  const me = await userRepo.getCurrent();
  const CURRENT_USER = me?.name ?? FALLBACK_USER;
  const myUserId = me?.id ?? "";
  const ctx = await getPermissionContext();
  const orgId = ctx.actor?.organizationId ?? DEFAULT_ORG_ID;

  // 本番 supabase は空 DB のため、emailRepo / aiExtractionRepo は空配列を返す
  const [companies, allContracts, threadsRaw] = await Promise.all([
    companyRepo.list(),
    contractRepo.list({ activeOnly: true }),
    emailRepo.listThreads({ organizationId: orgId })
  ]);

  // adapter: repo の EmailThread → mock 互換 shape (slaDeadline 等は undefined)
  const adaptedThreads = threadsRaw.map((t) => ({
    id: t.id,
    companyId: t.companyId ?? "",
    subject: t.subject,
    status: t.status,
    assignee: t.assigneeUserId ?? "",
    slaDeadline: undefined as string | undefined,
    lastMessageAt: t.lastInboundAt ?? t.lastOutboundAt ?? t.updatedAt
  }));

  // 全企業の AI 抽出を集約 (空 DB なら空配列)
  const extractionsNested = await Promise.all(
    companies.map((c) => aiExtractionRepo.listByCompany(c.id))
  );
  const adaptedExtractions = extractionsNested.flat().map((x) => ({
    id: x.id,
    threadId: x.sourceType === "email" ? x.sourceId : "",
    type: x.extractionType,
    suggestion: x.suggestedAction ?? x.excerpt ?? "",
    confidence: x.confidence ?? 0,
    status: (x.reviewed ? "approved" : "pending") as
      | "pending"
      | "approved"
      | "rejected",
    createdAt: x.createdAt
  }));

  const myThreads = adaptedThreads.filter((t) => t.assignee === CURRENT_USER);
  const myOpenThreads = myThreads
    .filter((t) => t.status === "new" || t.status === "in_progress")
    .sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1));
  const mySlaOver = myOpenThreads.filter((t) => isOverdue(t.slaDeadline));

  const myThreadIds = new Set(myThreads.map((t) => t.id));
  const myPendingExtractions = adaptedExtractions
    .filter((e) => e.status === "pending" && myThreadIds.has(e.threadId))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const myCompanies = companies.filter((c) => c.ownerName === CURRENT_USER);
  const myContracts = allContracts.filter(
    (c) => c.ownerName === CURRENT_USER
  );
  const companyById = new Map(companies.map((c) => [c.id, c]));

  // 個社ToDo: 自分担当（完了/未完了の両方を取得）
  const myCompanyTasksAll = myUserId
    ? await companyTaskRepo.list({ assignedTo: myUserId })
    : [];
  const myCompanyTasksOpen = myCompanyTasksAll.filter(
    (t) => t.status === "pending" || t.status === "in_progress"
  );

  // 担当企業の個社ToDo（自分以外も含む完了率算出用）
  const myCompanyIds = myCompanies.map((c) => c.id);
  const allTasksForMyCompanies = (
    await Promise.all(
      myCompanyIds.map((id) => companyTaskRepo.list({ companyId: id }))
    )
  ).flat();

  // 担当契約のオンボ進捗（onboarding_tasks から完了率算出）
  const myContractIdsAll = myContracts.map((c) => c.id);
  const onbItemsForMyContracts = await onboardingItemRepo
    .listByContractIds(myContractIdsAll)
    .catch(() => []);
  const onbItemsByContract = new Map<string, typeof onbItemsForMyContracts>();
  onbItemsForMyContracts.forEach((it) => {
    const arr = onbItemsByContract.get(it.contractId) ?? [];
    arr.push(it);
    onbItemsByContract.set(it.contractId, arr);
  });

  // 事業ジャーニー
  const myContractIds = myContracts.map((c) => c.id);
  const journeysList = await businessJourneyRepo.listByContractIds(myContractIds);
  const journeyByContract = new Map(
    journeysList.map((j) => [j.contractId, j])
  );

  // VOC（オープンのみ）
  const openVoc = await vocItemRepo.list({
    organizationId: orgId,
    status: ["open", "in_progress"]
  });
  const vocCountByCompany = new Map<string, number>();
  openVoc.forEach((v) => {
    if (!v.companyId) return;
    vocCountByCompany.set(
      v.companyId,
      (vocCountByCompany.get(v.companyId) ?? 0) + 1
    );
  });

  // チャット
  const myChannels = await chatRepo.listChannels({
    organizationId: orgId,
    userName: CURRENT_USER
  });
  // 最新メッセージの著者が自分でないものを「未対応」とする
  const channelsWithLastAuthor = await Promise.all(
    myChannels.map(async (ch) => {
      const msgs = await chatRepo.listMessages(ch.id);
      const last = msgs[msgs.length - 1];
      return { channel: ch, lastAuthor: last?.authorName, lastBody: last?.body };
    })
  );
  const openChats = channelsWithLastAuthor
    .filter(
      (c) =>
        c.lastAuthor &&
        c.lastAuthor !== CURRENT_USER &&
        c.channel.kind !== "email_thread"
    )
    .sort((a, b) =>
      a.channel.lastMessageAt < b.channel.lastMessageAt ? 1 : -1
    );

  // ── ヘッダ KPI ──
  const redContractCount = myContracts.filter(
    (c) => c.healthScore?.color === "red"
  ).length;

  // ── 事業別ToDo（program_company_tasks）：自分担当 or 担当企業の open セル ──
  const myCompanyIdSet = new Set(myCompanies.map((c) => c.id));
  const activeTerms = await programRepo.listTerms({
    status: ["draft", "active"]
  });
  const programTodos: UpcomingTodo[] = [];
  for (const term of activeTerms) {
    const [templates, cells] = await Promise.all([
      programRepo.listTemplates(term.id),
      programRepo.listCells(term.id)
    ]);
    const tplById = new Map(templates.map((t) => [t.id, t]));
    for (const cell of cells) {
      if (cell.status !== "pending" && cell.status !== "in_progress") continue;
      if (!cell.dueDate) continue;
      const mine =
        (myUserId && cell.assignedTo === myUserId) ||
        myCompanyIdSet.has(cell.companyId);
      if (!mine) continue;
      const days = daysBetween(cell.dueDate, TODAY);
      if (days > 14) continue;
      const tpl = tplById.get(cell.templateId);
      const co = companyById.get(cell.companyId);
      const b = dueBadge(days);
      programTodos.push({
        key: `prog-${cell.id}`,
        badge: b.text,
        badgeColor: b.color,
        company: co?.name ?? cell.companyId,
        title: tpl?.label ?? "事業別ToDo",
        href: `/programs/${term.id}`,
        dueDate: cell.dueDate,
        daysLeft: days,
        meta: term.label
      });
    }
  }
  programTodos.sort((a, b) => a.daysLeft - b.daysLeft);

  // ── 個別ToDo（company_tasks）：自分担当 open ──
  const personalTodos: UpcomingTodo[] = myCompanyTasksOpen
    .map((t) => {
      const co = companyById.get(t.companyId);
      const days = t.dueDate ? daysBetween(t.dueDate, TODAY) : 9999;
      const b = t.dueDate
        ? dueBadge(days)
        : { text: "期限なし", color: "ink" as TodoColor };
      return {
        key: `task-${t.id}`,
        badge: b.text,
        badgeColor: b.color,
        company: co?.name ?? t.companyId,
        title: t.title,
        href: `/companies/${t.companyId}`,
        dueDate: t.dueDate,
        daysLeft: days,
        meta: t.priority === "urgent" ? "緊急" : undefined
      };
    })
    .filter((t) => t.daysLeft <= 14)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // 本日タスク詳細（事業別ToDo + 個別ToDo の overdue+本日 ぶん）
  const todayDetailTodos: UpcomingTodo[] = [
    ...programTodos,
    ...personalTodos
  ]
    .filter((t) => t.daysLeft <= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // Red企業（自分担当の健康スコアred契約）
  const redContracts = myContracts.filter(
    (c) => c.healthScore?.color === "red"
  );

  // ── AI抽出 用にスレッド/企業情報を組み立て ──
  const threadById = new Map(adaptedThreads.map((t) => [t.id, t]));
  const extractionItems: MeExtractionItem[] = myPendingExtractions.map((ex) => {
    const thread = threadById.get(ex.threadId);
    const company = thread ? companyById.get(thread.companyId) : null;
    return {
      extraction: ex,
      threadId: thread?.id,
      threadSubject: thread?.subject,
      companyId: company?.id,
      companyName: company?.name
    };
  });

  // ── 担当企業を 事業 → コース でグループ化 ──
  const colorOrder: Record<"red" | "yellow" | "green", number> = {
    red: 0,
    yellow: 1,
    green: 2
  };

  type ContractRow = {
    contractId: string;
    companyId: string;
    companyName: string;
    karuteNo?: number;
    healthColor: "red" | "yellow" | "green";
    journeyShort?: string;
    onbDoneRate: number; // 0..1
    todoDoneRate: number; // 0..1
    vocCount: number;
  };

  type CourseGroup = {
    courseKey: string;
    courseLabel: string;
    rows: ContractRow[];
  };

  type ProductGroup = {
    code: ProductCode;
    name: string;
    accent: string;
    courses: CourseGroup[];
    contractCount: number;
  };

  const productGroups: ProductGroup[] = products
    .map((p) => {
      const contractsForProduct = myContracts.filter(
        (c) => c.product === p.code
      );
      if (contractsForProduct.length === 0) return null;

      const courses = productCourses[p.code] ?? [];
      const courseGroups: CourseGroup[] = courses
        .map((co) => {
          const contractsForCourse = contractsForProduct.filter(
            (c) => c.courseKey === co.key
          );
          if (contractsForCourse.length === 0) return null;

          const rows: ContractRow[] = contractsForCourse.map((c) => {
            const company = companyById.get(c.companyId);
            const onbItems = onbItemsByContract.get(c.id) ?? [];
            const onbDone = onbItems.filter((i) => i.status === "done").length;
            const onbDoneRate =
              onbItems.length > 0 ? onbDone / onbItems.length : 1;
            const tasksForCompany = allTasksForMyCompanies.filter(
              (t) => t.companyId === c.companyId
            );
            const todoDone = tasksForCompany.filter(
              (t) => t.status === "done"
            ).length;
            const todoDoneRate =
              tasksForCompany.length > 0
                ? todoDone / tasksForCompany.length
                : 1;
            const journey = journeyByContract.get(c.id);
            const journeyShort = journey
              ? BUSINESS_STAGE_SHORT[journey.currentStageKey] ?? journey.currentStageKey
              : undefined;
            return {
              contractId: c.id,
              companyId: c.companyId,
              companyName: company?.name ?? c.companyId,
              karuteNo: company?.karuteNo,
              healthColor: c.healthScore?.color ?? "green",
              journeyShort,
              onbDoneRate,
              todoDoneRate,
              vocCount: vocCountByCompany.get(c.companyId) ?? 0
            };
          });

          rows.sort((a, b) => {
            const c = colorOrder[a.healthColor] - colorOrder[b.healthColor];
            if (c !== 0) return c;
            return (a.karuteNo ?? 9999) - (b.karuteNo ?? 9999);
          });

          return {
            courseKey: co.key,
            courseLabel: courseShortName(p.code, co.key),
            rows
          };
        })
        .filter((g): g is CourseGroup => g !== null);

      return {
        code: p.code,
        name: p.shortName,
        accent: p.accent,
        courses: courseGroups,
        contractCount: contractsForProduct.length
      };
    })
    .filter((g): g is ProductGroup => g !== null);

  return (
    <>
      <TopNavServer current="/me" />
      <main className="mx-auto max-w-[1720px] px-6 py-6">
        {/* 4分割: 左1/4 担当企業（フルハイト）/ 右3/4 ヘッダ + やること系 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 items-start">
          {/* ── 左: 担当企業（事業→コース） ── */}
          <section className="liquid-surface p-4 lg:col-span-1 flex flex-col lg:sticky lg:top-20 max-h-[calc(100vh-6rem)] z-20">
            <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-base">🏢</span>
                <h2 className="text-sm font-semibold text-ink-700">
                  担当企業
                </h2>
                <span className="text-[11px] text-ink-500">
                  {myCompanies.length} 社
                </span>
              </div>
              <Link
                href="/companies"
                className="text-[11px] text-ink-700 hover:underline"
              >
                すべて →
              </Link>
            </div>
            {productGroups.length === 0 ? (
              <Empty>担当企業はありません</Empty>
            ) : (
              <div className="overflow-y-auto flex-1 -mx-1 px-1 space-y-3">
                {productGroups.map((p) => (
                  <div key={p.code}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="inline-block w-1.5 h-3 rounded-sm"
                        style={{ background: p.accent }}
                      />
                      <span className="text-[11px] font-bold text-ink-900">
                        {p.name}
                      </span>
                      <span className="text-[10px] text-ink-500">
                        {p.contractCount}
                      </span>
                    </div>
                    <div className="space-y-2 ml-2">
                      {p.courses.map((co) => (
                        <div key={co.courseKey}>
                          {p.courses.length > 1 && (
                            <div className="text-[10px] text-ink-500 mb-1 px-1">
                              {co.courseLabel}
                            </div>
                          )}
                          <ul className="space-y-1">
                            {co.rows.map((r) => (
                              <li key={r.contractId}>
                                <Link
                                  href={`/companies/${r.companyId}`}
                                  className="block px-2 py-1.5 rounded-lg hover:bg-ink-50/60"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <HealthDot color={r.healthColor} />
                                    {r.karuteNo !== undefined && (
                                      <span className="text-[9px] text-ink-400 tabular-nums shrink-0">
                                        #{r.karuteNo}
                                      </span>
                                    )}
                                    <span className="text-[12px] font-medium text-ink-900 truncate flex-1 min-w-0">
                                      {r.companyName}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-1 text-[9px] text-ink-500 ml-3 flex-wrap">
                                    {r.journeyShort && (
                                      <span className="px-1.5 py-px rounded bg-ink-50 text-ink-700">
                                        ジャーニー: {r.journeyShort}
                                      </span>
                                    )}
                                    <span>
                                      オンボ {Math.round(r.onbDoneRate * 100)}%
                                    </span>
                                    <span>
                                      ToDo {Math.round(r.todoDoneRate * 100)}%
                                    </span>
                                    {r.vocCount > 0 && (
                                      <span className="text-rose-600">
                                        VOC {r.vocCount}件
                                      </span>
                                    )}
                                  </div>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── 右: ヘッダ + やること / AI抽出 / メール・チャット ── */}
          <div className="lg:col-span-3 flex flex-col gap-5">
            {/* ヘッダ + KPI（スクロール中も常に表示） */}
            <section className="liquid-surface p-5 relative lg:sticky lg:top-20 z-30">
              <div className="absolute inset-0 overflow-hidden rounded-[inherit] pointer-events-none">
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
              </div>
              <div className="relative flex items-center justify-between gap-6 flex-wrap">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-ink-900 text-white flex items-center justify-center text-base font-bold">
                    古
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] text-ink-500">マイページ</div>
                    <h1 className="text-xl font-bold tracking-tight text-ink-900">
                      {CURRENT_USER}
                    </h1>
                    <div className="text-[11px] text-ink-500 mt-0.5">
                      Customer Success / 福岡
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <KpiStat
                    label="担当企業"
                    value={myCompanies.length}
                    href="/companies"
                  >
                    {myCompanies.slice(0, 12).map((c) => (
                      <Link
                        key={c.id}
                        href={`/companies/${c.id}`}
                        className="block px-2 py-1 text-[12px] text-ink-700 hover:bg-ink-50 rounded"
                      >
                        {c.name}
                      </Link>
                    ))}
                  </KpiStat>
                  <KpiStat
                    label="本日タスク"
                    value={todayDetailTodos.length}
                    accent={
                      todayDetailTodos.length > 0 ? "text-rose-600" : undefined
                    }
                    emptyText="本日締切のタスクはありません"
                  >
                    {todayDetailTodos.map((t) => (
                      <Link
                        key={t.key}
                        href={t.href}
                        className="flex items-center gap-2 px-2 py-1 hover:bg-ink-50 rounded"
                      >
                        <BadgeChip color={t.badgeColor}>{t.badge}</BadgeChip>
                        <span className="text-[11px] font-medium text-ink-900 truncate max-w-[110px]">
                          {t.company}
                        </span>
                        <span className="text-[11px] text-ink-700 truncate flex-1 min-w-0">
                          {t.title}
                        </span>
                      </Link>
                    ))}
                  </KpiStat>
                  <KpiStat
                    label="未対応メール"
                    value={myOpenThreads.length}
                    accent={mySlaOver.length > 0 ? "text-rose-600" : undefined}
                    emptyText="未対応メールはありません"
                    footer={
                      <Link
                        href="/inbox"
                        className="text-[11px] text-ink-700 hover:underline block px-2 pt-1"
                      >
                        受信箱を開く →
                      </Link>
                    }
                  >
                    {myOpenThreads.slice(0, 10).map((t) => {
                      const co = companyById.get(t.companyId);
                      const overdue = isOverdue(t.slaDeadline);
                      return (
                        <Link
                          key={t.id}
                          href={`/inbox?threadId=${t.id}`}
                          className="flex items-center gap-2 px-2 py-1 hover:bg-ink-50 rounded"
                        >
                          {overdue && (
                            <span className="text-[9px] px-1.5 py-px rounded-full bg-rose-100 text-rose-600 font-medium shrink-0">
                              SLA
                            </span>
                          )}
                          <span className="text-[11px] font-medium text-ink-900 truncate shrink-0 max-w-[110px]">
                            {co?.name ?? t.companyId}
                          </span>
                          <span className="text-[11px] text-ink-700 truncate flex-1 min-w-0">
                            {t.subject}
                          </span>
                        </Link>
                      );
                    })}
                  </KpiStat>
                  <KpiStat
                    label="SLA超過"
                    value={mySlaOver.length}
                    accent={mySlaOver.length > 0 ? "text-rose-600" : undefined}
                    emptyText="SLA超過のメールはありません"
                  >
                    {mySlaOver.map((t) => {
                      const co = companyById.get(t.companyId);
                      const days = t.slaDeadline
                        ? -daysBetween(t.slaDeadline, TODAY)
                        : 0;
                      return (
                        <Link
                          key={t.id}
                          href={`/inbox?threadId=${t.id}`}
                          className="flex items-center gap-2 px-2 py-1 hover:bg-ink-50 rounded"
                        >
                          <span className="text-[9px] px-1.5 py-px rounded-full bg-rose-100 text-rose-600 font-medium shrink-0">
                            {days}日超過
                          </span>
                          <span className="text-[11px] font-medium text-ink-900 truncate shrink-0 max-w-[110px]">
                            {co?.name ?? t.companyId}
                          </span>
                          <span className="text-[11px] text-ink-700 truncate flex-1 min-w-0">
                            {t.subject}
                          </span>
                        </Link>
                      );
                    })}
                  </KpiStat>
                  <KpiStat
                    label="Red企業"
                    value={redContractCount}
                    accent={redContractCount > 0 ? "text-rose-600" : undefined}
                    emptyText="Red企業はありません"
                  >
                    {redContracts.map((c) => {
                      const co = companyById.get(c.companyId);
                      return (
                        <Link
                          key={c.id}
                          href={`/companies/${c.companyId}`}
                          className="flex items-center gap-2 px-2 py-1 hover:bg-ink-50 rounded"
                        >
                          <span className="inline-block w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                          <span className="text-[11px] font-medium text-ink-900 truncate flex-1 min-w-0">
                            {co?.name ?? c.companyId}
                          </span>
                          <span className="text-[10px] text-ink-500 shrink-0">
                            {productByCode[c.product]?.shortName ?? c.product}
                          </span>
                        </Link>
                      );
                    })}
                  </KpiStat>
                </div>
              </div>
            </section>

            {/* 上段: 事業別ToDo / 個別ToDo（締切が近い順） */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <UpcomingColumn
                title="事業別ToDo（締切が近い順）"
                emoji="📋"
                todos={programTodos}
                emptyText="直近で締切が迫る事業別ToDoはありません"
              />
              <UpcomingColumn
                title="個別ToDo（締切が近い順）"
                emoji="✅"
                todos={personalTodos}
                emptyText="直近で締切が迫る個別ToDoはありません"
              />
            </div>

            {/* AI抽出 承認待ち（この場で承認/却下できる） */}
            <MeExtractions items={extractionItems} />

            {/* 下段: 未対応メール / 未対応チャット */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* 未対応メール */}
              <section className="liquid-surface p-4 flex flex-col h-[360px]">
                <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📧</span>
                    <h2 className="text-sm font-semibold text-ink-700">
                      未対応メール
                    </h2>
                    <span className="text-[11px] text-ink-500">
                      {myOpenThreads.length} 件
                      {mySlaOver.length > 0 && (
                        <span className="text-rose-600 ml-1">
                          (SLA超過 {mySlaOver.length})
                        </span>
                      )}
                    </span>
                  </div>
                  <Link
                    href="/inbox"
                    className="text-[11px] text-ink-700 hover:underline"
                  >
                    受信箱 →
                  </Link>
                </div>
                {myOpenThreads.length === 0 ? (
                  <Empty>未対応のメールはありません</Empty>
                ) : (
                  <ul className="divide-y divide-ink-50 overflow-y-auto flex-1 -mx-2 px-2">
                    {myOpenThreads.slice(0, 12).map((t) => {
                      const co = companyById.get(t.companyId);
                      const overdue = isOverdue(t.slaDeadline);
                      return (
                        <li key={t.id}>
                          <Link
                            href={`/inbox?threadId=${t.id}`}
                            className="block py-2 px-2 -mx-2 rounded-lg hover:bg-ink-50/60"
                          >
                            <div className="flex items-center gap-2">
                              {overdue && (
                                <span className="text-[9px] px-1.5 py-px rounded-full bg-rose-100 text-rose-600 font-medium shrink-0">
                                  SLA
                                </span>
                              )}
                              <span className="text-[12px] font-medium text-ink-900 truncate shrink-0 max-w-[140px]">
                                {co?.name ?? t.companyId}
                              </span>
                              <span className="text-[12px] text-ink-700 truncate flex-1 min-w-0">
                                {t.subject}
                              </span>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* 未対応チャット */}
              <section className="liquid-surface p-4 flex flex-col h-[360px]">
                <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base">💬</span>
                    <h2 className="text-sm font-semibold text-ink-700">
                      未対応チャット
                    </h2>
                    <span className="text-[11px] text-ink-500">
                      {openChats.length} 件
                    </span>
                  </div>
                  <Link
                    href="/chat"
                    className="text-[11px] text-ink-700 hover:underline"
                  >
                    チャット →
                  </Link>
                </div>
                {openChats.length === 0 ? (
                  <Empty>未対応のチャットはありません</Empty>
                ) : (
                  <ul className="divide-y divide-ink-50 overflow-y-auto flex-1 -mx-2 px-2">
                    {openChats.slice(0, 12).map((c) => {
                      const kindLabel =
                        c.channel.kind === "dm"
                          ? "DM"
                          : c.channel.kind === "program"
                          ? productByCode[c.channel.productCode!]?.shortName ??
                            "事業"
                          : "メール";
                      return (
                        <li key={c.channel.id}>
                          <Link
                            href={`/chat?channelId=${c.channel.id}`}
                            className="block py-2 px-2 -mx-2 rounded-lg hover:bg-ink-50/60"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] px-1.5 py-px rounded-full bg-ink-50 text-ink-700 shrink-0">
                                {kindLabel}
                              </span>
                              <span className="text-[12px] font-medium text-ink-900 truncate shrink-0 max-w-[120px]">
                                {c.channel.title}
                              </span>
                              <span className="text-[11px] text-ink-500 truncate flex-1 min-w-0">
                                {c.lastAuthor}: {c.lastBody}
                              </span>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function UpcomingColumn({
  title,
  emoji,
  todos,
  emptyText
}: {
  title: string;
  emoji: string;
  todos: UpcomingTodo[];
  emptyText: string;
}) {
  return (
    <section className="liquid-surface p-4 flex flex-col h-[420px]">
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <span className="text-base">{emoji}</span>
        <h2 className="text-sm font-semibold text-ink-700">{title}</h2>
        <span className="text-[11px] text-ink-500">{todos.length} 件</span>
      </div>
      {todos.length === 0 ? (
        <Empty>{emptyText}</Empty>
      ) : (
        <ul className="divide-y divide-ink-50 overflow-y-auto flex-1 -mx-2 px-2">
          {todos.map((t) => (
            <li key={t.key}>
              <Link
                href={t.href}
                className="flex items-center gap-2 py-2 hover:bg-ink-50/60 rounded-lg px-2 -mx-2"
              >
                <BadgeChip color={t.badgeColor}>{t.badge}</BadgeChip>
                <span className="text-[12px] font-medium text-ink-900 shrink-0 truncate max-w-[120px]">
                  {t.company}
                </span>
                <span className="text-[12px] text-ink-700 truncate flex-1 min-w-0">
                  {t.title}
                </span>
                {t.meta && (
                  <span className="text-[10px] text-ink-500 shrink-0 truncate max-w-[80px]">
                    {t.meta}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function KpiStat({
  label,
  value,
  accent,
  href,
  emptyText,
  footer,
  children
}: {
  label: string;
  value: number;
  accent?: string;
  href?: string;
  emptyText?: string;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}) {
  // 0件 かつ href が無い場合はクリック不要なので静的表示
  const hasContent =
    href || (Array.isArray(children) ? children.length > 0 : !!children);
  if (!hasContent) {
    return (
      <div className="text-center px-2">
        <div className={`text-xl font-bold ${accent ?? "text-ink-900"}`}>
          {value}
        </div>
        <div className="text-[10px] text-ink-500">{label}</div>
      </div>
    );
  }
  return (
    <details className="relative group">
      <summary className="list-none cursor-pointer text-center select-none px-2 py-1 rounded hover:bg-ink-50 [&::-webkit-details-marker]:hidden">
        <div className={`text-xl font-bold ${accent ?? "text-ink-900"}`}>
          {value}
        </div>
        <div className="text-[10px] text-ink-500">{label} ▾</div>
      </summary>
      <div className="absolute right-0 top-full mt-2 w-[340px] z-50 rounded-xl bg-white border border-ink-100 shadow-xl p-2 max-h-[420px] overflow-y-auto">
        {value === 0 ? (
          <div className="px-2 py-3 text-center text-[11px] text-ink-500">
            {emptyText ?? "該当なし"}
          </div>
        ) : (
          <div className="space-y-px">{children}</div>
        )}
        {footer}
        {href && (
          <Link
            href={href}
            className="text-[11px] text-ink-700 hover:underline block px-2 pt-1"
          >
            一覧を開く →
          </Link>
        )}
      </div>
    </details>
  );
}

function BadgeChip({
  color,
  children
}: {
  color: TodoColor;
  children: React.ReactNode;
}) {
  const cls =
    color === "red"
      ? "bg-rose-100 text-rose-600"
      : color === "amber"
      ? "bg-amber-100 text-amber-700"
      : "bg-ink-50 text-ink-700";
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 w-[68px] text-center ${cls}`}
    >
      {children}
    </span>
  );
}

function HealthDot({ color }: { color: "red" | "yellow" | "green" }) {
  const bg =
    color === "red" ? "#EF4444" : color === "yellow" ? "#F59E0B" : "#3B82F6";
  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{ background: bg }}
    />
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-ink-100 p-6 text-center text-xs text-ink-500">
      {children}
    </div>
  );
}
