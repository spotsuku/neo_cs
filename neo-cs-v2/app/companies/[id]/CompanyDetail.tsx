"use client";

import { useState } from "react";
import Link from "next/link";
import { ProductBadge } from "@/components/ProductBadge";
import { WeeklyReviewPanel } from "./WeeklyReviewPanel";
import { CompanyTasksSection } from "@/components/CompanyTasksSection";
import type { CompanyTask } from "@/lib/repository/types";
import type {
  Company,
  Contact,
  MeetingLog
} from "@/lib/mock/entities";
// コース表示に対応
import { ProductCode, productByCode, yen, hasMultipleCourses, courseShortName, courseName, cycleLabel } from "@/lib/mock/data";
import type {
  ActiveContract,
  ContractOnboardingItem
} from "@/lib/mock/onboarding";
import {
  productOnboardingTemplates,
  productJourney,
  categoryProgress,
  contractProgress
} from "@/lib/mock/onboarding";
import type {
  Stakeholder,
  SuccessPlan,
  AccountJourney
} from "@/lib/mock/cycles";
import {
  stakeholderTypeLabel,
  journeyStageLabel,
  journeyStageOrder,
  generateRenewalMilestones,
  renewalMilestoneSpec
} from "@/lib/mock/cycles";
import { companyHealthColor } from "@/lib/mock/health";
import { computeFromContract } from "@/lib/domain/health";
import { HealthExplain } from "@/components/HealthExplain";
import { HealthSparkline } from "@/components/HealthSparkline";
import { ContractChurnSignals } from "@/components/ContractChurnSignals";
import { ContractExpansionOpportunities } from "@/components/ContractExpansionOpportunities";
import { RenewalMilestoneList } from "@/components/RenewalMilestoneList";
import { CompanyVocList } from "@/components/CompanyVocList";
import {
  StakeholderEngagementBlock,
  type StakeholderEngagementMetrics
} from "@/components/StakeholderEngagementCard";
import { useHealthSnapshots } from "@/lib/hooks/useHealthSnapshots";
import type { ChurnRecord } from "@/lib/mock/churn";
import { reasonCategoryLabels, reasonCategoryOrder, churnRecords as initialChurnRecords } from "@/lib/mock/churn";
import { emailThreads, emailMessages } from "@/lib/mock/email";
import type { EmailThreadStatus } from "@/lib/mock/email";
import {
  surveys as allSurveys,
  surveyInsights as allInsights,
  surveyResponses as allResponses,
  aggregateSurvey,
  targetCountForSurvey,
  SurveyInsight
} from "@/lib/mock/surveys";
import {
  participants as allParticipants,
  sessions as allSessionsData,
  attendanceRecords as allAttendance,
  participantEngagement,
  participantSurveyResponseRate
} from "@/lib/mock/participants";

type HealthColor = "green" | "yellow" | "red";

type Tab = "overview" | "tasks" | "weekly" | "contracts" | "logs" | "onboarding" | "surveys" | "engagement" | "mail";

const tabs: { key: Tab; label: string }[] = [
  { key: "overview", label: "概要" },
  { key: "tasks", label: "業務ToDo" },
  { key: "weekly", label: "週次レビュー" },
  { key: "contracts", label: "契約・更新" },
  { key: "logs", label: "面談ログ" },
  { key: "onboarding", label: "オンボ" },
  { key: "surveys", label: "アンケート" },
  { key: "engagement", label: "エンゲージメント" },
  { key: "mail", label: "メール" }
];

function healthBg(color: HealthColor) {
  return color === "green" ? "#10B981" : color === "yellow" ? "#F59E0B" : "#EF4444";
}

function healthLabel(color: HealthColor) {
  return color === "green" ? "Green" : color === "yellow" ? "Yellow" : "Red";
}

export function CompanyDetail({
  company,
  contacts,
  logs,
  contracts,
  allCycles,
  items,
  stakeholders,
  successPlans,
  journeys,
  tasks = [],
  members = [],
  engagementByStakeholder = {}
}: {
  company: Company;
  contacts: Contact[];
  logs: MeetingLog[];
  contracts: ActiveContract[];
  allCycles: ActiveContract[];
  items: ContractOnboardingItem[];
  stakeholders: Stakeholder[];
  successPlans: SuccessPlan[];
  journeys: AccountJourney[];
  tasks?: CompanyTask[];
  members?: { id: string; name: string }[];
  engagementByStakeholder?: Record<string, StakeholderEngagementMetrics>;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const healthColor: HealthColor = companyHealthColor(company.id);

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8 space-y-6">
      {/* パンくず */}
      <div className="text-xs text-ink-500">
        <Link href="/companies" className="hover:text-ink-700">
          企業
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink-700">{company.name}</span>
      </div>

      {/* ヘッダ */}
      <section className="liquid-surface relative overflow-hidden p-6">
        <div
          className="liquid-blob"
          style={{
            top: -80,
            right: -40,
            width: 220,
            height: 220,
            background: healthBg(healthColor),
            opacity: 0.12
          }}
        />
        <div className="relative flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-ink-500">
              <span>{company.industry}</span>
              {company.group && (
                <>
                  <span>・</span>
                  <span>{company.group}</span>
                </>
              )}
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink-900 flex items-center gap-2">
              <span>{company.name}</span>
              {(company.isDemo ?? true) && (
                <span
                  title="デモデータ (is_demo=true) — /settings/demo-data で管理"
                  className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
                >
                  🚧 デモデータ
                </span>
              )}
            </h1>
            <div className="mt-3 flex items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 liquid-chip">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: healthBg(healthColor) }}
                />
                Health: {healthLabel(healthColor)}
              </span>
              <span className="text-ink-500">MRR</span>
              <span className="text-ink-900 font-semibold">{yen(company.mrr)}</span>
              <span className="text-ink-500">最終接点</span>
              <span className="text-ink-700">{company.lastTouchDays}日前</span>
              {company.driveFolderUrl ? (
                <a
                  href={company.driveFolderUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-ink-100 bg-white/70 px-3 py-1 text-xs text-ink-700 hover:bg-ink-50"
                  title="Google Drive 顧客フォルダを開く"
                >
                  <span aria-hidden>📁</span>
                  <span>Driveフォルダ</span>
                </a>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700">
                  <span aria-hidden>📁</span>
                  <span>フォルダ未作成</span>
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 rounded-full bg-white border border-ink-100 text-sm text-ink-700 shadow-liquid hover:bg-ink-50">
              編集
            </button>
            <button className="px-4 py-2 rounded-full bg-ink-900 text-white text-sm hover:opacity-90">
              + ログ追加
            </button>
          </div>
        </div>
      </section>

      {/* タブ */}
      <nav className="flex items-center gap-1 border-b border-ink-100">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={[
                "px-4 py-2.5 text-sm transition relative -mb-px",
                active
                  ? "text-ink-900 font-semibold border-b-2 border-ink-900"
                  : "text-ink-500 hover:text-ink-700"
              ].join(" ")}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* タブコンテンツ */}
      {tab === "overview" && (
        <OverviewTab company={company} contacts={contacts} contracts={contracts} journeys={journeys} stakeholders={stakeholders} engagementByStakeholder={engagementByStakeholder} companyId={company.id} />
      )}
      {tab === "tasks" && (
        <CompanyTasksSection
          companyId={company.id}
          initialTasks={tasks}
          contracts={allCycles.map((c) => ({
            id: c.id,
            label: `${c.product} / ${c.courseKey ?? "-"} (${cycleLabel(c.product, c.cycleNumber)})`
          }))}
          members={members}
        />
      )}
      {tab === "weekly" && <WeeklyReviewPanel companyId={company.id} />}
      {tab === "contracts" && <ContractsTab allCycles={allCycles} successPlans={successPlans} />}
      {/* 解約モーダルの管理は ContractsTab 内で完結 */}
      {tab === "logs" && <LogsTab logs={logs} />}
      {tab === "onboarding" && (
        <OnboardingTab contracts={contracts} items={items} />
      )}
      {tab === "surveys" && <SurveysTab companyId={company.id} contracts={allCycles} />}
      {tab === "engagement" && <EngagementTab companyId={company.id} contracts={allCycles} />}
      {tab === "mail" && <MailTab companyId={company.id} />}
    </main>
  );
}

/* ──────────────── 概要タブ ──────────────── */
function OverviewTab({
  company,
  contacts,
  contracts,
  journeys,
  stakeholders,
  engagementByStakeholder,
  companyId
}: {
  company: Company;
  contacts: Contact[];
  contracts: ActiveContract[];
  journeys: AccountJourney[];
  stakeholders: Stakeholder[];
  engagementByStakeholder: Record<string, StakeholderEngagementMetrics>;
  companyId: string;
}) {
  return (
    <section className="space-y-4">
      <AccountJourneySection journeys={journeys} />
      <StakeholderSection stakeholders={stakeholders} engagementByStakeholder={engagementByStakeholder} companyId={companyId} />
      <CustomerJourneySection contracts={contracts} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 左: 企業情報 */}
      <div className="liquid-surface p-5 space-y-4">
        <div className="text-sm font-semibold text-ink-700">企業情報</div>
        <dl className="space-y-3 text-sm">
          <Row label="住所" value={company.address} />
          <Row label="業種" value={company.industry} />
          {company.group && <Row label="グループ" value={company.group} />}
          <Row label="主担当" value={company.ownerName} />
          <Row label="最終接点" value={`${company.lastTouchDays}日前`} />
        </dl>
        {company.memo && (
          <div className="mt-4 rounded-xl bg-ink-50 p-3">
            <div className="text-[11px] text-ink-500 font-medium mb-1">メモ</div>
            <div className="text-sm text-ink-700 leading-relaxed">
              {company.memo}
            </div>
          </div>
        )}
      </div>

      {/* 中央: 契約中研修サマリー */}
      <div className="space-y-3">
        <div className="text-sm font-semibold text-ink-700">契約中の研修</div>
        <div className="space-y-3">
          {company.contracts.map((code) => (
            <ContractMiniCard
              key={code}
              code={code}
              contracts={contracts.filter((c) => c.product === code)}
            />
          ))}
          {company.contracts.length === 0 && (
            <div className="liquid-surface p-4 text-sm text-ink-500">
              契約中の研修はありません
            </div>
          )}
        </div>
      </div>

      {/* 右: 担当者 */}
      <div className="liquid-surface p-5 space-y-3">
        <div className="text-sm font-semibold text-ink-700">企業側の担当者</div>
        {contacts.length === 0 && (
          <div className="text-sm text-ink-500">登録された担当者はいません</div>
        )}
        <div className="space-y-3">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-ink-100 p-3 bg-white"
            >
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold text-ink-900">{c.name}</div>
                {c.isPrimary && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-blue/10 text-brand-blue border border-brand-blue/20">
                    主担当
                  </span>
                )}
              </div>
              <div className="text-[11px] text-ink-500 mt-0.5">
                {c.department} ・ {c.title}
              </div>
              <div className="text-xs text-ink-700 mt-1.5">{c.email}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {c.products.map((p) => (
                  <ProductBadge key={p} code={p} size="sm" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>
    </section>
  );
}

function CustomerJourneySection({ contracts }: { contracts: ActiveContract[] }) {
  const inProgress = contracts.filter((c) => c.status === "onboarding").length;
  const running = contracts.filter((c) => c.status !== "onboarding" && c.status !== "handoff").length;

  if (contracts.length === 0) return null;

  return (
    <div className="liquid-surface p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-semibold text-ink-700">カスタマージャーニー</div>
          <div className="mt-0.5 text-[11px] text-ink-500">
            契約ごとの運用フェーズ進捗
          </div>
        </div>
        <div className="text-xs text-ink-500">
          進行中契約 <span className="text-ink-900 font-semibold">{running}</span> 件 / オンボ中{" "}
          <span className="text-ink-900 font-semibold">{inProgress}</span> 件
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {contracts.map((contract) => (
          <JourneyContractCard key={contract.id} contract={contract} />
        ))}
      </div>
    </div>
  );
}

function JourneyContractCard({ contract }: { contract: ActiveContract }) {
  const p = productByCode[contract.product];
  const phases = productJourney[contract.product];
  const isOnboarding = contract.status === "onboarding";
  const currentIdx = isOnboarding
    ? -1 // オンボ中は phases の前段
    : phases.findIndex((ph) => ph.key === contract.currentPhase);

  // 表示ステップ: オンボ中の場合は先頭に「オンボ」ステップを付ける
  const steps: { key: string; label: string; state: "done" | "current" | "todo" }[] = [];
  if (isOnboarding) {
    steps.push({ key: "onboarding", label: "オンボ中", state: "current" });
    phases.forEach((ph) => steps.push({ key: ph.key, label: ph.label, state: "todo" }));
  } else {
    phases.forEach((ph, i) => {
      steps.push({
        key: ph.key,
        label: ph.label,
        state: i < currentIdx ? "done" : i === currentIdx ? "current" : "todo"
      });
    });
  }

  const currentLabel = isOnboarding
    ? "オンボ中"
    : phases.find((ph) => ph.key === contract.currentPhase)?.label ?? "—";

  return (
    <div className="rounded-xl border border-ink-100 p-4 bg-white">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ProductBadge code={contract.product} size="sm" />
          {hasMultipleCourses(contract.product) && (
            <span className="text-xs text-ink-700 truncate">
              {courseName(contract.product, contract.courseKey)}
            </span>
          )}
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-ink-50 text-ink-600 border border-ink-100">
            {cycleLabel(contract.product, contract.cycleNumber)}
          </span>
        </div>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0"
          style={{ background: `${p.accent}14`, color: p.accent }}
        >
          {currentLabel}
        </span>
      </div>

      {/* ステップUI */}
      <div className="mt-4 flex items-center">
        {steps.map((step, i) => (
          <div key={step.key} className="flex-1 flex items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              {step.state === "done" && (
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ background: p.accent }}
                />
              )}
              {step.state === "current" && (
                <span
                  className="w-4 h-4 rounded-full ring-4 ring-offset-0"
                  style={{
                    background: p.accent,
                    boxShadow: `0 0 0 4px ${p.accent}22`
                  }}
                />
              )}
              {step.state === "todo" && (
                <span className="w-3 h-3 rounded-full bg-white border border-ink-200" />
              )}
              <span
                className={[
                  "text-[10px] whitespace-nowrap",
                  step.state === "current"
                    ? "font-semibold text-ink-900"
                    : step.state === "done"
                    ? "text-ink-700"
                    : "text-ink-500"
                ].join(" ")}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="h-px flex-1 mx-1 mb-4"
                style={{
                  background:
                    step.state === "done" ? p.accent : "#E5E7EB"
                }}
              />
            )}
          </div>
        ))}
      </div>

      {isOnboarding && (
        <Link
          href={`/onboarding/${contract.id}`}
          className="mt-3 inline-block text-[11px] text-ink-700 hover:underline"
        >
          → オンボチェックリストを見る
        </Link>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-[11px] text-ink-500 pt-0.5">{label}</dt>
      <dd className="text-sm text-ink-900 text-right">{value}</dd>
    </div>
  );
}

function ContractMiniCard({ code, contracts }: { code: ProductCode; contracts: ActiveContract[] }) {
  const p = productByCode[code];
  // 契約中コースの一覧（複数コース研修のみ表示）
  const courseKeys = Array.from(new Set(contracts.map((c) => c.courseKey)));
  return (
    <div className="liquid-surface p-4 relative overflow-hidden">
      <div
        className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-10"
        style={{ background: p.accent }}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <ProductBadge code={code} />
          {hasMultipleCourses(code) &&
            courseKeys.map((ck) => (
              <span
                key={ck}
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                style={{
                  color: p.accent,
                  background: `${p.accent}14`,
                  border: `1px solid ${p.accent}33`
                }}
              >
                {courseShortName(code, ck)}
              </span>
            ))}
        </div>
        <span className="text-[11px] text-ink-500 shrink-0">契約中</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-ink-500">MRR</div>
          <div className="text-ink-900 font-semibold mt-0.5">
            {p.type === "continuous" ? yen(300_000) : "—"}
          </div>
        </div>
        <div>
          <div className="text-ink-500">進捗</div>
          <div className="text-ink-900 font-semibold mt-0.5">
            {p.sessionCount ? `8 / ${p.sessionCount} 回` : "—"}
          </div>
        </div>
        <div>
          <div className="text-ink-500">次回MTG</div>
          <div className="text-ink-900 font-semibold mt-0.5">4/28</div>
        </div>
        <div>
          <div className="text-ink-500">参加者</div>
          <div className="text-ink-900 font-semibold mt-0.5">
            {p.participantCap ? `${p.participantCap}名` : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────── 面談ログタブ ──────────────── */
function LogsTab({ logs }: { logs: MeetingLog[] }) {
  const typeLabel: Record<MeetingLog["type"], string> = {
    mtg: "MTG",
    mail: "メール",
    call: "コール"
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-ink-500">
          全 {logs.length} 件の接点ログ
        </div>
        <button className="px-4 py-2 rounded-full bg-ink-900 text-white text-sm hover:opacity-90">
          + ログ追加
        </button>
      </div>

      {logs.length === 0 && (
        <div className="liquid-surface p-8 text-center text-sm text-ink-500">
          面談ログはまだありません
        </div>
      )}

      <ol className="space-y-3">
        {logs.map((l) => (
          <li key={l.id} className="liquid-surface p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink-500 font-medium">
                {new Date(l.date).toLocaleDateString("ja-JP", {
                  year: "numeric",
                  month: "short",
                  day: "numeric"
                })}
              </span>
              <span className="liquid-chip text-[10px] !px-2 !py-0.5">
                {typeLabel[l.type]}
              </span>
              {l.product === "cross" ? (
                <span className="inline-flex items-center gap-1 rounded-full font-medium border text-[10px] px-1.5 py-0.5 text-ink-700 border-ink-300 bg-ink-50">
                  <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-brand-blue to-brand-pink" />
                  横断
                </span>
              ) : (
                <ProductBadge code={l.product} size="sm" />
              )}
              {l.aiGenerated && (
                <span
                  className="text-[10px] text-ink-500"
                  title="AI生成"
                >
                  🤖 AI要約
                </span>
              )}
              <span className="ml-auto text-[11px] text-ink-500">
                {l.authorName}
              </span>
            </div>

            <div className="mt-2 text-sm font-semibold text-ink-900">
              {l.title}
            </div>
            <p className="mt-1.5 text-sm text-ink-700 leading-relaxed">
              {l.summary}
            </p>

            {(l.good || l.more || l.next) && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                {l.good && (
                  <LogSection
                    label="Good"
                    text={l.good}
                    color="#10B981"
                  />
                )}
                {l.more && (
                  <LogSection
                    label="More"
                    text={l.more}
                    color="#F59E0B"
                  />
                )}
                {l.next && (
                  <LogSection
                    label="Next"
                    text={l.next}
                    color="#3D9EFF"
                  />
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function LogSection({
  label,
  text,
  color
}: {
  label: string;
  text: string;
  color: string;
}) {
  return (
    <div
      className="rounded-xl p-3 border"
      style={{ borderColor: `${color}33`, background: `${color}0D` }}
    >
      <div
        className="text-[11px] font-semibold mb-1"
        style={{ color }}
      >
        {label}
      </div>
      <div className="text-xs text-ink-700 leading-relaxed">{text}</div>
    </div>
  );
}

/* ──────────────── オンボタブ ──────────────── */
function OnboardingTab({
  contracts,
  items
}: {
  contracts: ActiveContract[];
  items: ContractOnboardingItem[];
}) {
  if (contracts.length === 0) {
    return (
      <section className="liquid-surface p-10 text-center text-sm text-ink-500">
        対象の契約がありません
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {contracts.map((contract) => {
        const p = productByCode[contract.product];
        const prog = contractProgress(contract.id);
        const cats = productOnboardingTemplates[contract.product]
          .slice()
          .sort((a, b) => a.order - b.order);
        const contractItems = items.filter((i) => i.contractId === contract.id);
        return (
          <div key={contract.id} className="liquid-surface p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <ProductBadge code={contract.product} />
                  {hasMultipleCourses(contract.product) && (
                    <span
                      className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{
                        color: p.accent,
                        background: `${p.accent}14`,
                        border: `1px solid ${p.accent}33`
                      }}
                    >
                      {courseShortName(contract.product, contract.courseKey)}
                    </span>
                  )}
                  <span
                    className={[
                      "text-[11px] px-2 py-0.5 rounded-full border",
                      contract.status !== "onboarding" && contract.status !== "handoff"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                        : "bg-amber-50 text-amber-700 border-amber-100"
                    ].join(" ")}
                  >
                    {contract.status !== "onboarding" && contract.status !== "handoff"
                      ? "オンボ完了"
                      : "オンボ進行中"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-500">
                  <span>
                    開始日{" "}
                    <span className="text-ink-700 font-medium">
                      {contract.startDate.replace(/-/g, "/")}
                    </span>
                  </span>
                  <span>
                    担当{" "}
                    <span className="text-ink-700 font-medium">
                      {contract.ownerName}
                    </span>
                  </span>
                  <span>
                    参加者{" "}
                    <span className="text-ink-700 font-medium">
                      {contract.participants}名
                    </span>
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[11px] text-ink-500">全体</div>
                <div className="text-base font-bold text-ink-900">
                  {prog.done}/{prog.total}
                </div>
                {prog.overdue > 0 && (
                  <div className="text-[11px] text-rose-500">
                    期日超過 {prog.overdue}件
                  </div>
                )}
                <Link
                  href={`/onboarding/${contract.id}`}
                  className="mt-2 inline-block text-xs text-ink-500 hover:text-ink-700 underline"
                >
                  詳細 →
                </Link>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              {cats.map((cat) => {
                const cp = categoryProgress(contract.id, cat.key);
                const od = contractItems.filter(
                  (i) =>
                    i.categoryKey === cat.key && i.status === "overdue"
                ).length;
                return (
                  <div key={cat.key}>
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-ink-700 font-medium">
                          {cat.label}
                        </span>
                        {od > 0 && (
                          <span className="text-[10px] text-rose-500">
                            🔴{od}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-ink-500">
                        {cp.done}/{cp.total}
                      </span>
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-ink-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${
                            cp.total > 0 ? (cp.done / cp.total) * 100 : 0
                          }%`,
                          background: p.accent
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4">
              <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${
                      prog.total > 0 ? (prog.done / prog.total) * 100 : 0
                    }%`,
                    background: p.accent
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

/* ──────────────── アカウントジャーニー（サイクル非依存） ──────────────── */
function AccountJourneySection({ journeys }: { journeys: AccountJourney[] }) {
  if (journeys.length === 0) return null;
  return (
    <div className="liquid-surface p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-semibold text-ink-700">アカウントジャーニー</div>
          <div className="mt-0.5 text-[11px] text-ink-500">
            サイクルを跨いだ成熟度（研修ごと）
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {journeys.map((j) => {
          const p = productByCode[j.product];
          return (
            <div key={`${j.companyId}-${j.product}`} className="rounded-xl border border-ink-100 p-4 bg-white">
              <div className="flex items-center gap-2 mb-3">
                <ProductBadge code={j.product} size="sm" />
                <span className="text-[11px] text-ink-500">
                  {journeyStageLabel[j.currentStage]}に{" "}
                  {Math.max(0, Math.round((new Date("2026-04-24").getTime() - new Date(j.stageEnteredAt).getTime()) / (1000 * 60 * 60 * 24 * 30)))}ヶ月
                </span>
              </div>
              <div className="flex items-center">
                {journeyStageOrder.map((stage, i) => {
                  const currentIdx = journeyStageOrder.indexOf(j.currentStage);
                  const state = i < currentIdx ? "done" : i === currentIdx ? "current" : "todo";
                  return (
                    <div key={stage} className="flex-1 flex items-center last:flex-none">
                      <div className="flex flex-col items-center gap-1">
                        {state === "done" && <span className="w-3 h-3 rounded-full" style={{ background: p.accent }} />}
                        {state === "current" && (
                          <span className="w-4 h-4 rounded-full" style={{ background: p.accent, boxShadow: `0 0 0 4px ${p.accent}22` }} />
                        )}
                        {state === "todo" && <span className="w-3 h-3 rounded-full bg-white border border-ink-200" />}
                        <span className={["text-[10px] whitespace-nowrap", state === "current" ? "font-semibold text-ink-900" : state === "done" ? "text-ink-700" : "text-ink-500"].join(" ")}>
                          {journeyStageLabel[stage]}
                        </span>
                      </div>
                      {i < journeyStageOrder.length - 1 && (
                        <div className="h-px flex-1 mx-1 mb-4" style={{ background: state === "done" ? p.accent : "#E5E7EB" }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────── ステークホルダー ──────────────── */
function StakeholderSection({
  stakeholders,
  engagementByStakeholder,
  companyId
}: {
  stakeholders: Stakeholder[];
  engagementByStakeholder: Record<string, StakeholderEngagementMetrics>;
  companyId: string;
}) {
  if (stakeholders.length === 0) return null;
  // 個人へのリスクラベル (at_risk) は撤廃。type は役割のみ表現する
  const typeColor: Record<Stakeholder["type"], string> = {
    decision_maker: "#8B5CF6",
    champion: "#10B981",
    user: "#3D9EFF"
  };
  // 個人の関与度低下は事実として表示するが「リスク扱い」のラベルにはしない
  const engagementCls: Record<NonNullable<Stakeholder["engagement"]>, string> = {
    active: "bg-success-50 text-success-700 border-success-100",
    low: "bg-warning-50 text-warning-700 border-warning-100",
    disengaged: "bg-neutral-100 text-neutral-700 border-neutral-300"
  };
  const engagementLabel: Record<NonNullable<Stakeholder["engagement"]>, string> = {
    active: "活発",
    low: "頻度低下",
    disengaged: "ほぼ不参加"
  };
  return (
    <div className="liquid-surface p-5">
      <div className="text-sm font-semibold text-ink-700 mb-3">関係者マップ</div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {stakeholders.map((s) => (
          <div key={s.id} className="rounded-xl border border-ink-100 p-3 bg-white">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-ink-900 truncate">{s.name}</div>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                style={{ background: `${typeColor[s.type]}14`, color: typeColor[s.type], border: `1px solid ${typeColor[s.type]}33` }}
              >
                {stakeholderTypeLabel[s.type]}
              </span>
            </div>
            <div className="text-[11px] text-ink-500 mt-0.5">{s.role}</div>
            <div className="mt-2 flex flex-wrap gap-1 items-center">
              {s.products.map((p) => <ProductBadge key={p} code={p} size="sm" />)}
              {s.engagement && s.engagement !== "active" && (
                <span
                  className={`inline-flex px-1.5 py-0.5 rounded-pill border text-caption ${engagementCls[s.engagement]}`}
                >
                  関与: {engagementLabel[s.engagement]}
                </span>
              )}
            </div>
            {engagementByStakeholder[s.id] && (
              <StakeholderEngagementBlock
                stakeholderId={s.id}
                stakeholderName={s.name}
                companyId={companyId}
                metrics={engagementByStakeholder[s.id]}
                currentNote={s.engagementNote}
              />
            )}
            {s.note && (
              <div className="mt-2 text-[11px] text-ink-600 leading-relaxed">{s.note}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────── 契約・更新タブ ──────────────── */
function ContractsTab({
  allCycles,
  successPlans
}: {
  allCycles: ActiveContract[];
  successPlans: SuccessPlan[];
}) {
  // 解約レコード（モック state）
  // ⚠️ 実際の Contract.status 更新は別実装。ここでは ChurnRecord のみを保持
  const cycleIds = new Set(allCycles.map((c) => c.id));
  const [records, setRecords] = useState<ChurnRecord[]>(
    initialChurnRecords.filter((r) => cycleIds.has(r.contractId))
  );
  const [churnTarget, setChurnTarget] = useState<ActiveContract | null>(null);

  // 研修ごとにグルーピング
  const byProduct = new Map<ProductCode, ActiveContract[]>();
  allCycles.forEach((c) => {
    const arr = byProduct.get(c.product) ?? [];
    arr.push(c);
    byProduct.set(c.product, arr);
  });

  if (allCycles.length === 0) {
    return (
      <section className="liquid-surface p-10 text-center text-sm text-ink-500">
        契約がありません
      </section>
    );
  }

  const handleSave = (record: ChurnRecord) => {
    setRecords((prev) => {
      const exists = prev.some((r) => r.contractId === record.contractId);
      return exists
        ? prev.map((r) => (r.contractId === record.contractId ? record : r))
        : [...prev, record];
    });
    setChurnTarget(null);
  };

  return (
    <section className="space-y-4">
      {Array.from(byProduct.entries()).map(([code, cycles]) => {
        const sorted = cycles.slice().sort((a, b) => a.cycleNumber - b.cycleNumber);
        const current = sorted.find((c) => c.status !== "renewed" && c.status !== "churned") ?? sorted[sorted.length - 1];
        const currentPlan = successPlans.find((sp) => sp.contractId === current.id);
        return (
          <ProductCyclesBlock
            key={code}
            code={code}
            cycles={sorted}
            current={current}
            plan={currentPlan}
            churnRecords={records}
            onChurnClick={(c) => setChurnTarget(c)}
          />
        );
      })}

      {/* 解約履歴 */}
      <ChurnHistorySection records={records} cycles={allCycles} />

      {churnTarget && (
        <ChurnModal
          contract={churnTarget}
          existing={records.find((r) => r.contractId === churnTarget.id)}
          onClose={() => setChurnTarget(null)}
          onSave={handleSave}
        />
      )}
    </section>
  );
}

function ChurnHistorySection({
  records,
  cycles
}: {
  records: ChurnRecord[];
  cycles: ActiveContract[];
}) {
  if (records.length === 0) return null;
  const cycleById = new Map(cycles.map((c) => [c.id, c]));
  return (
    <div className="liquid-surface p-5">
      <div className="text-sm font-semibold text-ink-700 mb-3">解約履歴</div>
      <ul className="space-y-2">
        {records.map((r) => {
          const c = cycleById.get(r.contractId);
          return (
            <li
              key={r.contractId}
              className="rounded-xl border border-ink-100 p-3 bg-white"
            >
              <div className="flex items-center gap-2 flex-wrap">
                {c && <ProductBadge code={c.product} size="sm" />}
                <span className="text-[11px] text-ink-500">
                  {cycleLabel(c?.product ?? "academia", c?.cycleNumber ?? 1)}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100">
                  {reasonCategoryLabels[r.reasonCategory]}
                </span>
                <span className="text-[11px] text-ink-500 ml-auto">
                  解約日 {r.churnedAt}
                </span>
              </div>
              <div className="mt-1.5 text-xs text-ink-700 leading-relaxed">{r.reasonNote}</div>
              {r.nextActionDate && (
                <div className="mt-2 rounded-lg bg-ink-50 p-2.5 text-[11px] text-ink-700">
                  <span className="text-ink-500 mr-1.5">次回予定:</span>
                  {r.nextActionDate}
                  {r.nextActionNote && ` ・ ${r.nextActionNote}`}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ChurnModal({
  contract,
  existing,
  onClose,
  onSave
}: {
  contract: ActiveContract;
  existing?: ChurnRecord;
  onClose: () => void;
  onSave: (r: ChurnRecord) => void;
}) {
  const [churnedAt, setChurnedAt] = useState<string>(existing?.churnedAt ?? "2026-04-24");
  const [reasonCategory, setReasonCategory] = useState<ChurnRecord["reasonCategory"]>(
    existing?.reasonCategory ?? "budget"
  );
  const [reasonNote, setReasonNote] = useState<string>(existing?.reasonNote ?? "");
  const [nextActionDate, setNextActionDate] = useState<string>(existing?.nextActionDate ?? "");
  const [nextActionNote, setNextActionNote] = useState<string>(existing?.nextActionNote ?? "");
  const [verifiedByCustomer, setVerifiedByCustomer] = useState<boolean>(
    existing?.verifiedByCustomer ?? false
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // ⚠️ 実際の Contract.status 更新は別実装。ここでは ChurnRecord のみを保持
    onSave({
      contractId: contract.id,
      churnedAt,
      reasonCategory,
      reasonNote,
      verifiedByCustomer,
      verifiedAt: verifiedByCustomer
        ? existing?.verifiedAt ?? new Date().toISOString().slice(0, 10)
        : undefined,
      verificationNote: existing?.verificationNote,
      nextActionDate: nextActionDate || undefined,
      nextActionNote: nextActionNote || undefined,
      notified: existing?.notified ?? false
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-liquid-lg w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 border-b border-ink-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-ink-900">解約として記録</h3>
              <p className="text-[11px] text-ink-500 mt-0.5">
                {courseShortName(contract.product, contract.courseKey)} ・ {cycleLabel(contract.product, contract.cycleNumber)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-ink-400 hover:text-ink-700 text-xl"
              aria-label="閉じる"
            >
              ×
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            <Field label="解約日" required>
              <input
                type="date"
                required
                value={churnedAt}
                onChange={(e) => setChurnedAt(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm bg-white"
              />
            </Field>

            <Field label="理由カテゴリ" required>
              <select
                value={reasonCategory}
                onChange={(e) => setReasonCategory(e.target.value as ChurnRecord["reasonCategory"])}
                className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm bg-white"
              >
                {reasonCategoryOrder.map((k) => (
                  <option key={k} value={k}>
                    {reasonCategoryLabels[k]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="詳細メモ" required>
              <textarea
                required
                rows={3}
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
                placeholder="経緯・背景を記載"
                className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm bg-white resize-y"
              />
            </Field>

            <label className="mt-3 inline-flex items-start gap-2 text-body text-ink-700 cursor-pointer">
              <input
                type="checkbox"
                checked={verifiedByCustomer}
                onChange={(e) => setVerifiedByCustomer(e.target.checked)}
                className="mt-1 w-4 h-4 rounded accent-ink-900"
              />
              <span>
                <span className="font-medium">顧客本人に確認済</span>
                <span className="text-caption text-ink-500 block">
                  チェックなしの場合は CS 側の推測値として記録されます (reviews/10_顧客.md 対応)
                </span>
              </span>
            </label>

            <div className="pt-3 border-t border-ink-100">
              <div className="text-xs font-semibold text-ink-700 mb-3">次回接触（任意）</div>
              <Field label="次回接触予定日">
                <input
                  type="date"
                  value={nextActionDate}
                  onChange={(e) => setNextActionDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm bg-white"
                />
              </Field>
              <div className="mt-3" />
              <Field label="何を話すか">
                <textarea
                  rows={3}
                  value={nextActionNote}
                  onChange={(e) => setNextActionNote(e.target.value)}
                  placeholder="再アプローチ時の論点"
                  className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm bg-white resize-y"
                />
              </Field>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-ink-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full bg-white border border-ink-100 text-sm text-ink-700 hover:bg-ink-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-full bg-ink-900 text-white text-sm hover:opacity-90"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-ink-700 mb-1">
        {label}
        {required && <span className="text-rose-500 ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}

function ProductCyclesBlock({
  code,
  cycles,
  current,
  plan,
  churnRecords,
  onChurnClick
}: {
  code: ProductCode;
  cycles: ActiveContract[];
  current: ActiveContract;
  plan?: SuccessPlan;
  churnRecords: ChurnRecord[];
  onChurnClick: (c: ActiveContract) => void;
}) {
  const isCurrentChurned = churnRecords.some((r) => r.contractId === current.id);
  const p = productByCode[code];
  return (
    <div className="liquid-surface p-5 space-y-5">
      {/* ヘッダ：研修名 + サイクルタイムライン */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ProductBadge code={code} />
          <span className="text-xs text-ink-500">
            サイクル単位：<span className="text-ink-700">{p.cycleUnit}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-ink-500">{cycles.length} サイクル目</span>
          {current.status !== "renewed" && current.status !== "churned" && (
            <button
              type="button"
              onClick={() => onChurnClick(current)}
              className="px-3 py-1 rounded-full text-[11px] border border-rose-100 bg-white text-rose-600 hover:bg-rose-50"
            >
              {isCurrentChurned ? "解約記録を編集" : "解約として記録"}
            </button>
          )}
        </div>
      </div>

      {/* サイクルタイムライン */}
      <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
        {cycles.map((c) => {
          const isCurrent = c.id === current.id;
          return (
            <div
              key={c.id}
              className={[
                "flex-1 min-w-[140px] rounded-xl border p-3",
                isCurrent ? "bg-white border-2" : "bg-ink-50 border-ink-100 opacity-80"
              ].join(" ")}
              style={isCurrent ? { borderColor: p.accent } : undefined}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-ink-900">
                  {cycleLabel(code, c.cycleNumber)}
                </span>
                {isCurrent ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${p.accent}14`, color: p.accent }}>
                    現行
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-ink-100 text-ink-600">
                    {c.status === "renewed" ? "更新済" : c.status === "churned" ? "解約" : "完了"}
                  </span>
                )}
              </div>
              <div className="mt-1 text-[11px] text-ink-500">
                {c.startDate.replace(/-/g, "/")} 〜 {c.endDate?.replace(/-/g, "/") ?? "—"}
              </div>
              {c.mrr && (
                <div className="mt-1 text-[11px] text-ink-700">{yen(c.mrr)}/月</div>
              )}
            </div>
          );
        })}
      </div>

      {/* 現行サイクル詳細 */}
      <CurrentCyclePanel contract={current} plan={plan} />
    </div>
  );
}

function CurrentCyclePanel({ contract, plan }: { contract: ActiveContract; plan?: SuccessPlan }) {
  const p = productByCode[contract.product];
  const endDate = contract.endDate;
  const daysToEnd = endDate
    ? Math.ceil((new Date(endDate).getTime() - new Date("2026-04-24").getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const milestones = endDate ? generateRenewalMilestones(contract.id, endDate) : [];
  const renewalColor: Record<"green" | "yellow" | "red", string> = {
    green: "#10B981",
    yellow: "#F59E0B",
    red: "#EF4444"
  };
  const breakdown = computeFromContract(contract);
  const healthColor = breakdown.color;
  const { snapshots } = useHealthSnapshots(contract.id);
  return (
    <div className="space-y-4 pt-4 border-t border-ink-100">
      {/* Health 説明セクション */}
      <div className="surface p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-caption text-neutral-500 font-medium">
            Health Score (12週推移)
          </div>
          <HealthSparkline snapshots={snapshots} />
        </div>
        <HealthExplain breakdown={breakdown} />
      </div>

      {/* 解約予兆シグナル (D項) */}
      <div className="surface p-4 space-y-2">
        <div className="text-caption text-neutral-500 font-medium">
          解約予兆シグナル
        </div>
        <ContractChurnSignals contractId={contract.id} />
      </div>

      {/* エクスパンション機会 + 営業引き継ぎ (F項) */}
      <div className="surface p-4 space-y-2">
        <div className="flex items-baseline justify-between">
          <div className="text-caption text-neutral-500 font-medium">
            エクスパンション機会 / 営業引き継ぎ
          </div>
          <span className="text-caption text-neutral-400">
            score≥80 は Slack 通知対象 (週次)
          </span>
        </div>
        <ContractExpansionOpportunities contractId={contract.id} />
      </div>

      {/* VOC (顧客の声) — 未処理のみ (H項) */}
      <div className="surface p-4 space-y-2">
        <div className="flex items-baseline justify-between">
          <div className="text-caption text-neutral-500 font-medium">
            VOC (顧客の声) — 未処理
          </div>
          <a
            href={`/voc?companyId=${contract.companyId}`}
            className="text-caption text-info-700 hover:underline focus-ring rounded-sm"
          >
            すべて見る →
          </a>
        </div>
        <CompanyVocList companyId={contract.companyId} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 左: 現行サマリー */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-ink-700">現行サイクル</div>
        <div className="rounded-xl bg-ink-50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-ink-500">更新判定</span>
            {healthColor ? (
              <span
                className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: `${renewalColor[healthColor]}14`,
                  color: renewalColor[healthColor],
                  border: `1px solid ${renewalColor[healthColor]}33`
                }}
              >
                {healthColor.toUpperCase()}
              </span>
            ) : (
              <span className="text-[11px] text-ink-400">—</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-ink-500">期末まで</span>
            <span className="text-sm font-semibold text-ink-900">
              {daysToEnd !== null ? (daysToEnd >= 0 ? `${daysToEnd}日` : `${-daysToEnd}日超過`) : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-ink-500">担当</span>
            <span className="text-xs text-ink-700">{contract.ownerName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-ink-500">参加者</span>
            <span className="text-xs text-ink-700">{contract.participants}名</span>
          </div>
        </div>
      </div>

      {/* 中央: 更新マイルストーン (G項: 自動done廃止 + 証跡入力UI) */}
      <div className="space-y-3 lg:col-span-2">
        <div className="text-caption font-semibold text-neutral-700">更新マイルストーン</div>
        {milestones.length === 0 ? (
          <div className="text-caption text-neutral-500">期末日なし（単発）</div>
        ) : (
          <RenewalMilestoneList contractId={contract.id} />
        )}
      </div>

      {/* 右: Success Plan */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-ink-700">Success Plan</div>
          {plan && (
            <span className="text-[11px] text-ink-500">
              達成 <span className="text-ink-900 font-semibold">{Math.round(plan.overallAchievement * 100)}%</span>
            </span>
          )}
        </div>
        {!plan ? (
          <div className="text-[11px] text-ink-500">Success Plan未設定</div>
        ) : (
          <div className="space-y-2.5">
            {plan.goals.map((g) => (
              <div key={g.key}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] text-ink-700 truncate">{g.title}</span>
                  <span className="text-[11px] text-ink-500 shrink-0">{Math.round(g.achievement * 100)}%</span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-ink-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${g.achievement * 100}%`, background: p.accent }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

/* ──────────────── アンケートタブ ──────────────── */
function SurveysTab({
  companyId,
  contracts
}: {
  companyId: string;
  contracts: ActiveContract[];
}) {
  // この企業が回答したSurvey一覧（surveyResponses.companyId経由でフィルタ）
  const respondedSurveyIds = new Set(
    allResponses.filter((r) => r.companyId === companyId).map((r) => r.surveyId)
  );
  // 旧モデル互換: 紐づく契約由来のSurveyも一覧に出す
  const contractIds = new Set(contracts.map((c) => c.id));
  const companySurveys = allSurveys
    .filter(
      (s) => respondedSurveyIds.has(s.id) || (s.contractId !== undefined && contractIds.has(s.contractId))
    )
    .sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1));

  if (companySurveys.length === 0) {
    return (
      <section className="liquid-surface p-10 text-center text-sm text-ink-500">
        この企業のアンケートはまだありません
      </section>
    );
  }

  // NPS推移（時系列で並んだクローズ済survey）
  const trendItems = companySurveys
    .slice()
    .reverse()
    .map((s) => ({ survey: s, agg: aggregateSurvey(s.id) }))
    .filter((t) => t.agg.npsScore !== undefined);

  // 直近のインサイト3件
  const insightSurveyIds = new Set(companySurveys.map((s) => s.id));
  const recentInsights: SurveyInsight[] = allInsights
    .filter((i) => insightSurveyIds.has(i.surveyId))
    .slice(0, 3);

  return (
    <section className="space-y-4">
      {/* NPS推移ミニチャート */}
      {trendItems.length > 0 && (
        <div className="liquid-surface p-5">
          <div className="text-sm font-semibold text-ink-700 mb-3">NPS推移</div>
          <div className="flex items-end gap-3 h-32">
            {trendItems.map((t) => {
              const v = t.agg.npsScore ?? 0;
              const h = Math.max(8, ((v + 100) / 200) * 100);
              return (
                <div key={t.survey.id} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-[10px] text-ink-700 font-semibold">{v}</div>
                  <div
                    className="w-full rounded-t-md"
                    style={{ height: `${h}%`, background: "#3D9EFF" }}
                  />
                  <div className="text-[10px] text-ink-500 truncate max-w-[80px]">
                    {t.survey.openedAt.slice(5)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 直近インサイト */}
      {recentInsights.length > 0 && (
        <div className="liquid-surface p-5">
          <div className="text-sm font-semibold text-ink-700 mb-3">直近のAIインサイト</div>
          <ul className="space-y-2">
            {recentInsights.map((i) => (
              <li key={i.id} className="text-xs text-ink-700 rounded-lg border border-ink-100 p-2.5 bg-white">
                <span className="text-[10px] text-ink-500 mr-2">{i.category}</span>
                {i.summary}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Survey一覧 */}
      <div className="liquid-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-ink-500 border-b border-ink-100">
              <th className="px-5 py-3 font-medium">タイトル</th>
              <th className="px-3 py-3 font-medium">期間</th>
              <th className="px-3 py-3 font-medium">回答 / 対象</th>
              <th className="px-3 py-3 font-medium">NPS</th>
              <th className="px-3 py-3 font-medium">ステータス</th>
              <th className="px-5 py-3 font-medium w-20"></th>
            </tr>
          </thead>
          <tbody>
            {companySurveys.map((s) => {
              const agg = aggregateSurvey(s.id);
              const target = targetCountForSurvey(s.id);
              const responseCount = allResponses.filter((r) => r.surveyId === s.id).length;
              return (
                <tr key={s.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
                  <td className="px-5 py-3 font-medium">{s.title}</td>
                  <td className="px-3 py-3 text-ink-500 text-xs whitespace-nowrap">
                    {s.openedAt}
                    {s.closedAt ? ` 〜 ${s.closedAt}` : " 〜"}
                  </td>
                  <td className="px-3 py-3 text-ink-700">{responseCount} / {target}</td>
                  <td className="px-3 py-3 font-semibold">
                    {agg.npsScore !== undefined ? agg.npsScore : "—"}
                  </td>
                  <td className="px-3 py-3 text-ink-700 text-xs">{s.status}</td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/surveys/${s.id}`}
                      className="text-xs text-ink-700 hover:underline whitespace-nowrap"
                    >
                      詳細 →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ──────────────── エンゲージメントタブ ──────────────── */
function EngagementTab({
  companyId,
  contracts
}: {
  companyId: string;
  contracts: ActiveContract[];
}) {
  const contractIds = new Set(contracts.map((c) => c.id));
  const companyParticipants = allParticipants.filter(
    (p) => p.companyId === companyId && contractIds.has(p.contractId)
  );
  const companySessions = allSessionsData
    .filter((s) => contractIds.has(s.contractId))
    .sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : 1));

  if (companyParticipants.length === 0 || companySessions.length === 0) {
    return (
      <section className="liquid-surface p-10 text-center text-sm text-ink-500">
        この企業の出席データはまだありません
      </section>
    );
  }

  const cellColor = (status: "present" | "absent" | "late" | "excused" | "not_expected") => {
    switch (status) {
      case "present":
        return "#10B981";
      case "late":
        return "#F59E0B";
      case "excused":
        return "#6366F1";
      case "absent":
        return "#EF4444";
      default:
        return "#E5E7EB";
    }
  };

  const cellStatus = (
    sessionId: string,
    participantId: string
  ): "present" | "absent" | "late" | "excused" | "not_expected" => {
    const sess = companySessions.find((s) => s.id === sessionId);
    if (!sess) return "not_expected";
    if (!sess.expectedParticipantIds.includes(participantId)) return "not_expected";
    const rec = allAttendance.find(
      (r) => r.sessionId === sessionId && r.participantId === participantId
    );
    return rec?.status ?? "absent";
  };

  // 個人別エンゲージメント率（出席率＋アンケート回答率）
  const ranks = companyParticipants
    .map((p) => {
      const eng = participantEngagement(p.id);
      const sr = participantSurveyResponseRate(p.id);
      return {
        participant: p,
        attendanceRate: eng.attendanceRate,
        attended: eng.attended,
        totalSessions: eng.totalSessions,
        surveyRate: sr.rate,
        surveyResponded: sr.responded,
        surveyTotal: sr.totalSurveys
      };
    })
    .sort((a, b) => b.attendanceRate - a.attendanceRate);

  const seniorityLabel: Record<string, string> = {
    young: "若手",
    mid: "中堅",
    senior: "管理職",
    exec: "役員"
  };

  return (
    <section className="space-y-4">
      {/* ヒートマップ */}
      <div className="liquid-surface p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold text-ink-700">出席ヒートマップ</div>
            <div className="mt-0.5 text-[11px] text-ink-500">
              参加者 × セッション（緑=出席 / 黄=遅刻 / 赤=欠席 / 灰=対象外）
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-ink-500">
            {(["present", "late", "absent", "not_expected"] as const).map((st) => (
              <span key={st} className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block w-3 h-3 rounded"
                  style={{ background: cellColor(st) }}
                />
                {st === "present"
                  ? "出席"
                  : st === "late"
                  ? "遅刻"
                  : st === "absent"
                  ? "欠席"
                  : "対象外"}
              </span>
            ))}
          </div>
        </div>
        <div className="overflow-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white z-10 px-3 py-2 text-left font-medium text-ink-500 border-b border-ink-100 min-w-[180px]">
                  参加者
                </th>
                {companySessions.map((s) => (
                  <th
                    key={s.id}
                    className="px-1 py-2 font-medium text-ink-500 border-b border-ink-100"
                  >
                    <div className="text-[10px] writing-vertical-rl whitespace-nowrap">
                      第{s.sessionNumber}回 {s.scheduledAt.slice(5)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {companyParticipants.map((p) => (
                <tr key={p.id}>
                  <td className="sticky left-0 bg-white z-10 px-3 py-1.5 border-b border-ink-50">
                    <div className="text-ink-900 font-medium">{p.name}</div>
                    <div className="text-[10px] text-ink-500">
                      {p.department ?? "—"} ・ {p.seniority ? seniorityLabel[p.seniority] : "—"}
                    </div>
                  </td>
                  {companySessions.map((s) => {
                    const st = cellStatus(s.id, p.id);
                    return (
                      <td
                        key={s.id}
                        className="px-1 py-1.5 border-b border-ink-50 text-center"
                      >
                        <span
                          className="inline-block w-5 h-5 rounded"
                          style={{ background: cellColor(st) }}
                          title={`${p.name} / ${s.title} / ${st}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 個人別エンゲージメント率（出席率＋アンケート回答率） */}
      <div className="liquid-surface p-5">
        <div className="text-sm font-semibold text-ink-700 mb-3">個人別エンゲージメント率</div>
        <ul className="space-y-2.5">
          {ranks.map((r) => (
            <li key={r.participant.id}>
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-xs">
                  <span className="text-ink-900 font-medium">{r.participant.name}</span>
                  <span className="ml-2 text-ink-500">
                    {r.participant.department ?? "—"} ・{" "}
                    {r.participant.seniority ? seniorityLabel[r.participant.seniority] : "—"}
                  </span>
                </div>
                <div className="text-[11px] text-ink-500">
                  出席 <span className="text-ink-900 font-semibold">{Math.round(r.attendanceRate * 100)}%</span>{" "}
                  ({r.attended}/{r.totalSessions})
                  <span className="ml-3">
                    回答 <span className="text-ink-900 font-semibold">{Math.round(r.surveyRate * 100)}%</span>{" "}
                    ({r.surveyResponded}/{r.surveyTotal})
                  </span>
                </div>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${r.attendanceRate * 100}%`,
                      background: "#10B981"
                    }}
                  />
                </div>
                <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${r.surveyRate * 100}%`,
                      background: "#3D9EFF"
                    }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ──────────────── メールタブ ──────────────── */
const MAIL_STATUS_LABEL: Record<EmailThreadStatus, string> = {
  new: "未対応",
  in_progress: "対応中",
  replied: "返信済",
  waiting: "返信待ち",
  closed: "クローズ"
};
const MAIL_STATUS_BG: Record<EmailThreadStatus, string> = {
  new: "bg-rose-50 text-rose-600 border-rose-100",
  in_progress: "bg-amber-50 text-amber-700 border-amber-100",
  replied: "bg-sky-50 text-sky-700 border-sky-100",
  waiting: "bg-violet-50 text-violet-700 border-violet-100",
  closed: "bg-ink-50 text-ink-500 border-ink-100"
};
const MAIL_TODAY = "2026-04-24";

function MailTab({ companyId }: { companyId: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const threads = emailThreads
    .filter((t) => t.companyId === companyId)
    .sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1));

  if (threads.length === 0) {
    return (
      <section className="liquid-surface p-12 text-center">
        <div className="text-sm text-ink-500">この企業のメールスレッドはありません</div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="text-xs text-ink-500">
        全 {threads.length} スレッド ・{" "}
        <Link href="/inbox" className="hover:text-ink-700 underline">
          受信箱で開く →
        </Link>
      </div>
      <ul className="space-y-2">
        {threads.map((t) => {
          const open = openId === t.id;
          const overdue =
            t.slaDeadline &&
            new Date(t.slaDeadline) < new Date(MAIL_TODAY) &&
            (t.status === "new" || t.status === "in_progress");
          const tMsgs = emailMessages
            .filter((m) => m.threadId === t.id)
            .sort((a, b) => (a.sentAt < b.sentAt ? -1 : 1));
          return (
            <li key={t.id} className="liquid-surface overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : t.id)}
                className="w-full text-left p-4 hover:bg-ink-50 transition flex items-start gap-3"
              >
                <span
                  className={[
                    "px-2 py-0.5 rounded-full border text-[10px] mt-0.5 shrink-0",
                    MAIL_STATUS_BG[t.status]
                  ].join(" ")}
                >
                  {MAIL_STATUS_LABEL[t.status]}
                </span>
                {overdue && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 text-[10px] mt-0.5 shrink-0">
                    SLA超過
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink-900 truncate">
                    {t.subject}
                  </div>
                  <div className="text-[11px] text-ink-500 mt-0.5">
                    担当: {t.assignee} ・ 最終受信: {t.lastMessageAt}
                    {t.slaDeadline && ` ・ SLA: ${t.slaDeadline}`}
                  </div>
                </div>
                <Link
                  href={`/inbox?threadId=${t.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[11px] text-ink-700 hover:underline shrink-0"
                >
                  受信箱で開く →
                </Link>
                <span className="text-ink-400 text-xs shrink-0">{open ? "▼" : "▶"}</span>
              </button>
              {open && (
                <div className="border-t border-ink-100 p-4 bg-ink-50/30 space-y-2">
                  {tMsgs.map((m) => (
                    <div
                      key={m.id}
                      className={[
                        "rounded-lg border p-3 text-xs",
                        m.direction === "inbound"
                          ? "bg-white border-ink-100"
                          : "bg-sky-50 border-sky-100 ml-6"
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between text-[11px] text-ink-500">
                        <span className="font-medium text-ink-700">{m.from}</span>
                        <span>{new Date(m.sentAt).toLocaleString("ja-JP")}</span>
                      </div>
                      <pre className="mt-1 text-xs text-ink-900 whitespace-pre-wrap font-sans leading-relaxed">
                        {m.body}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
