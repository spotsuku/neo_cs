import Link from "next/link";
import type { Metadata } from "next";
import { TopNav } from "@/components/TopNav";
import {
  userRepo,
  assignmentRepo,
  companyRepo,
  contractRepo,
  healthSnapshotRepo,
  stakeholderRepo,
  meetingLogRepo
} from "@/lib/repository";
import { weeklyReviews, CURRENT_WEEK_MONDAY } from "@/lib/mock/weekly";
import { meetingLogs } from "@/lib/mock/entities";
import type { AppUser, Assignment, Contract } from "@/lib/repository";
import { computeStakeholderEngagement } from "@/lib/domain/engagement-builder";
import { tallyByTier, type EngagementTier } from "@/lib/domain/engagement";
import { EngagementDistribution } from "@/components/EngagementDistribution";

export const metadata: Metadata = {
  title: "チーム | NEO CS",
  description: "メンバー一覧 / 担当社数 / 直近活動 / 健全度平均"
};

const TODAY = "2026-04-24";
const ONE_MONTH_AGO = "2026-03-24";

const ROLE_LABEL: Record<AppUser["role"], string> = {
  admin: "管理者",
  manager: "マネージャー",
  member: "メンバー",
  viewer: "閲覧"
};

const ROLE_TONE: Record<AppUser["role"], string> = {
  admin: "bg-info-50 text-info-700 border-info-100",
  manager: "bg-brand-purple/10 text-brand-purple border-brand-purple/20",
  member: "bg-neutral-100 text-neutral-700 border-neutral-300",
  viewer: "bg-neutral-50 text-neutral-500 border-neutral-100"
};

type MemberStat = {
  user: AppUser;
  primaryAssignments: Assignment[];
  contracts: Contract[];
  weeklyReviewCount30d: number;
  meetingLogCount30d: number;
  healthAvg: number | null;
  riskRedCount: number;
  riskYellowCount: number;
  weeklyDoneThisWeek: number;
  weeklyDueThisWeek: number;
  engagementTally: Record<EngagementTier, number>;
};

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((s, n) => s + n, 0) / nums.length);
}

function healthBadge(score: number | null): {
  cls: string;
  label: string;
} {
  if (score === null) return { cls: "bg-neutral-100 text-neutral-500", label: "—" };
  if (score >= 80) return { cls: "bg-success-50 text-success-700 border border-success-100", label: `${score}` };
  if (score >= 60) return { cls: "bg-warning-50 text-warning-700 border border-warning-100", label: `${score}` };
  return { cls: "bg-danger-50 text-danger-700 border border-danger-100", label: `${score}` };
}

export default async function TeamPage() {
  const [users, allAssignments, companies, contracts, latestSnapshots, allStakeholders] = await Promise.all([
    userRepo.list({ activeOnly: true }),
    assignmentRepo.list({ activeOnly: true }),
    companyRepo.list(),
    contractRepo.list({ activeOnly: true }),
    healthSnapshotRepo.latestAll(),
    stakeholderRepo.list()
  ]);

  // 全 company 分の meetings を 1 度だけ取得 → engagement 算出
  const companyIdsAll = Array.from(new Set(allStakeholders.map((s) => s.companyId)));
  const meetingsByCompanyAll = new Map<string, Awaited<ReturnType<typeof meetingLogRepo.listByCompany>>>();
  await Promise.all(
    companyIdsAll.map(async (cid) => {
      const ms = await meetingLogRepo.listByCompany(cid, { sort: "date desc", limit: 50 });
      meetingsByCompanyAll.set(cid, ms);
    })
  );

  // stakeholder.id → tier
  const tierByStakeholder = new Map<string, EngagementTier>();
  for (const s of allStakeholders) {
    const r = computeStakeholderEngagement(s, {
      meetingLogs: meetingsByCompanyAll.get(s.companyId) ?? []
    });
    tierByStakeholder.set(s.id, r.tier);
  }

  const orgTally = tallyByTier(
    allStakeholders.map((s) => ({ tier: tierByStakeholder.get(s.id)! }))
  );

  // contractId -> 最新スナップショット
  const snapshotByContract = new Map(
    latestSnapshots.map((s) => [s.contractId, s])
  );

  const userById = new Map(users.map((u) => [u.id, u]));
  const companyById = new Map(companies.map((c) => [c.id, c]));

  // mock の ownerName から userId への変換 (assignment seed と同じ規則)
  const ownerNameToUserId: Record<string, string> = {
    古野: "u-furuno",
    三木: "u-miki",
    松田: "u-matsuda"
  };

  // contract.ownerName から userId を解決
  const contractsByUserId = new Map<string, Contract[]>();
  for (const c of contracts) {
    const uid = ownerNameToUserId[c.ownerName];
    if (!uid) continue;
    const arr = contractsByUserId.get(uid) ?? [];
    arr.push(c);
    contractsByUserId.set(uid, arr);
  }

  const stats: MemberStat[] = users.map((u) => {
    const myPrimary = allAssignments.filter(
      (a) => a.userId === u.id && a.role === "primary"
    );
    const myContracts = contractsByUserId.get(u.id) ?? [];

    // 担当企業集合
    const myCompanyIds = new Set(myPrimary.map((a) => a.companyId));
    // owner経由でも追加 (mockデータ整合)
    myContracts.forEach((c) => myCompanyIds.add(c.companyId));

    // 直近30日の活動
    const weeklyReviewCount30d = weeklyReviews.filter(
      (r) =>
        myCompanyIds.has(r.companyId) &&
        r.weekStart >= ONE_MONTH_AGO &&
        r.authorName === u.name
    ).length;
    const meetingLogCount30d = meetingLogs.filter(
      (m) =>
        myCompanyIds.has(m.companyId) &&
        m.date >= ONE_MONTH_AGO &&
        m.authorName === u.name
    ).length;

    // 健全度: health_score_snapshots の最新値から算出 (snapshot正本)
    const mySnapshots = myContracts
      .map((c) => snapshotByContract.get(c.id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
    const healthAvg = avg(mySnapshots.map((s) => s.score));
    const riskRedCount = mySnapshots.filter((s) => s.color === "red").length;
    const riskYellowCount = mySnapshots.filter((s) => s.color === "yellow").length;

    // 今週の週次レビュー消化率
    const weeklyDueThisWeek = myContracts.filter(
      (c) => c.status === "active" || c.status === "renewal_window" || c.status === "onboarding"
    ).length;
    const weeklyDoneThisWeek = weeklyReviews.filter(
      (r) =>
        myCompanyIds.has(r.companyId) &&
        r.weekStart === CURRENT_WEEK_MONDAY &&
        r.authorName === u.name
    ).length;

    // 担当社の stakeholders → 自身が担当する顧客側担当者の tier 分布
    const myStakeholders = allStakeholders.filter((s) => myCompanyIds.has(s.companyId));
    const engagementTally = tallyByTier(
      myStakeholders.map((s) => ({ tier: tierByStakeholder.get(s.id)! }))
    );

    return {
      user: u,
      primaryAssignments: myPrimary,
      contracts: myContracts,
      weeklyReviewCount30d,
      meetingLogCount30d,
      healthAvg,
      riskRedCount,
      riskYellowCount,
      weeklyDoneThisWeek,
      weeklyDueThisWeek,
      engagementTally
    };
  });

  stats.sort((a, b) => {
    // 担当社数 desc
    return (
      b.primaryAssignments.length + b.contracts.length -
      (a.primaryAssignments.length + a.contracts.length)
    );
  });

  const totals = {
    members: stats.length,
    companies: new Set(allAssignments.map((a) => a.companyId)).size,
    weekly30d: stats.reduce((s, st) => s + st.weeklyReviewCount30d, 0),
    meetings30d: stats.reduce((s, st) => s + st.meetingLogCount30d, 0)
  };

  return (
    <>
      <TopNav current="/team" />
      <main className="mx-auto max-w-[1400px] px-6 py-8 space-y-6">
        <header className="space-y-1">
          <div className="text-caption text-neutral-500">
            <Link href="/" className="hover:text-neutral-700">
              ダッシュボード
            </Link>
            <span className="mx-1">/</span>
            <span>チーム</span>
          </div>
          <h1 className="text-h1 font-bold text-neutral-900">チーム</h1>
          <p className="text-body text-neutral-500">
            メンバーごとの担当社数・直近1ヶ月の活動・健全度平均
          </p>
        </header>

        {/* サマリー */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="メンバー" value={totals.members} unit="名" />
          <SummaryCard label="担当社" value={totals.companies} unit="社" />
          <SummaryCard label="週次入力(30日)" value={totals.weekly30d} unit="件" />
          <SummaryCard label="面談ログ(30日)" value={totals.meetings30d} unit="件" />
        </section>

        {/* 顧客側担当者 エンゲージメント分布 (Phase2-#4) */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <EngagementDistribution tally={orgTally} title="全社 顧客側担当者 tier 分布" />
          {stats.slice(0, 3).map((s) => (
            <EngagementDistribution
              key={s.user.id}
              tally={s.engagementTally}
              title={`${s.user.name} 担当先 tier`}
              showLegend={false}
            />
          ))}
        </section>

        {/* メンバーテーブル */}
        <section className="surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-body">
              <thead className="bg-neutral-50 text-caption text-neutral-500">
                <tr>
                  <Th>メンバー</Th>
                  <Th>役割</Th>
                  <Th align="right">担当社</Th>
                  <Th align="right">担当契約</Th>
                  <Th align="right">健全度平均</Th>
                  <Th align="right">Red/Yellow</Th>
                  <Th align="right">週次(今週)</Th>
                  <Th align="right">週次(30日)</Th>
                  <Th align="right">面談(30日)</Th>
                  <Th align="right">1on1</Th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => {
                  const hb = healthBadge(s.healthAvg);
                  const weeklyRate =
                    s.weeklyDueThisWeek > 0
                      ? `${s.weeklyDoneThisWeek}/${s.weeklyDueThisWeek}`
                      : "—";
                  return (
                    <tr
                      key={s.user.id}
                      className="border-t border-neutral-100 hover:bg-neutral-50/60"
                    >
                      <Td>
                        <Link
                          href={`/team/${s.user.id}/one-on-one`}
                          className="text-neutral-900 font-medium hover:underline focus-ring rounded-sm"
                        >
                          {s.user.name}
                        </Link>
                        <div className="text-caption text-neutral-500">
                          {s.user.email}
                        </div>
                      </Td>
                      <Td>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-pill border text-caption ${ROLE_TONE[s.user.role]}`}
                        >
                          {ROLE_LABEL[s.user.role]}
                        </span>
                      </Td>
                      <Td align="right" className="font-medium">
                        {s.primaryAssignments.length}
                      </Td>
                      <Td align="right">{s.contracts.length}</Td>
                      <Td align="right">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-pill text-caption ${hb.cls}`}
                        >
                          {hb.label}
                        </span>
                      </Td>
                      <Td align="right" className="text-caption">
                        <span className="text-danger-600 font-medium">
                          {s.riskRedCount}
                        </span>
                        <span className="text-neutral-300 mx-0.5">/</span>
                        <span className="text-warning-600 font-medium">
                          {s.riskYellowCount}
                        </span>
                      </Td>
                      <Td align="right">{weeklyRate}</Td>
                      <Td align="right">{s.weeklyReviewCount30d}</Td>
                      <Td align="right">{s.meetingLogCount30d}</Td>
                      <Td align="right">
                        <Link
                          href={`/team/${s.user.id}/one-on-one`}
                          className="text-info-600 hover:text-info-700 underline-offset-2 hover:underline focus-ring rounded-sm"
                        >
                          記録
                        </Link>
                      </Td>
                    </tr>
                  );
                })}
                {stats.length === 0 && (
                  <tr>
                    <Td>
                      <span className="text-neutral-500">
                        アクティブメンバーがいません
                      </span>
                    </Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <p className="text-caption text-neutral-500">
          ※ 健全度は health_score_snapshots の最新値ベース。担当社は assignments primary を起点とし、
          mock seed の owner も補助的に集計に含む。
        </p>
      </main>
    </>
  );
}

function SummaryCard({
  label,
  value,
  unit
}: {
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <div className="surface p-4">
      <div className="text-caption text-neutral-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-metric font-bold text-neutral-900">{value}</span>
        <span className="text-body text-neutral-500">{unit}</span>
      </div>
    </div>
  );
}

function Th({
  children,
  align = "left"
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-3 py-2 font-normal ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  className = ""
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"} ${className}`}
    >
      {children}
    </td>
  );
}
