"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ProductBadge } from "@/components/contract/ProductBadge";
import { WeeklyReviewPanel } from "./WeeklyReviewPanel";
import { AddLogModal } from "./AddLogModal";
import { ContractFormModal } from "./ContractFormModal";
import { CancelContractModal } from "./CancelContractModal";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { CompanyTasksSection } from "@/components/company/CompanyTasksSection";
import type { CompanyTask } from "@/lib/repository/types";
import type {
  Company,
  Contact,
  ContactRole,
  ContactRoleScope,
  ContactRoleLevel,
  ContactFunction,
  ContactCommunityTier,
  ContactPersonality,
  MeetingLog
} from "@/lib/mock/entities";
// コース表示に対応
import { ProductCode, productByCode, yen, hasMultipleCourses, courseShortName, courseName, cycleLabel } from "@/lib/mock/data";
import type { ActiveContract } from "@/lib/mock/onboarding";
import type { ContractOnboardingItem } from "@/lib/repository/types";
import {
  productOnboardingTemplates,
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
  journeyStageOrder
} from "@/lib/mock/cycles";
import type {
  CompanyJourney,
  BusinessJourney,
  JourneyStageDefinition,
  JourneyCheckpointStatus,
  ContractLifecycleSnapshot,
  CompanyVision,
  CompanyVisionLog,
  WeeklyReview,
  ProgramTerm,
  ProgramTaskTemplate,
  ProgramCompanyTask,
  ChurnSignalRecord,
  VocItemRecord,
  DriveSendLog
} from "@/lib/repository/types";
import { DriveSendLogsSection } from "./DriveSendLogsSection";

export type ProgramBundle = {
  term: ProgramTerm;
  templates: ProgramTaskTemplate[];
  cells: ProgramCompanyTask[];
};
import type { JourneySuggestion } from "@/lib/domain/journey/journey";
import { JourneyStageBar } from "@/components/journey/JourneyStageBar";
import { JourneyCheckpointPanel } from "@/components/journey/JourneyCheckpointPanel";
import { BusinessLifecyclePanel } from "@/components/journey/BusinessLifecyclePanel";
import { ContractHistorySection } from "@/components/contract/ContractHistorySection";
import { CompanyWeatherPicker } from "@/components/company/CompanyWeatherPicker";
import { CompanyHealthBadge } from "@/components/company/CompanyHealthBadge";
import type { CompanyWeather } from "@/lib/domain/weather/weather";
import { NextCycleModal, type NextCycleDefaults } from "@/components/journey/NextCycleModal";
import { CompanyVisionSection } from "@/components/company/CompanyVisionSection";
import { ChecklistView } from "@/app/(lifecycle)/onboarding/[contractId]/ChecklistView";
import { CompanyEditDialog } from "./CompanyEditDialog";
import { setProgramCellStatus } from "@/app/(cohort)/programs/[termId]/cellActions";
import {
  PROGRAM_TASK_CATEGORY_LABEL,
  PROGRAM_CELL_STATUS_LABEL,
  type ProgramTaskCategory,
  type ProgramCellStatus
} from "@/lib/domain/program/program";
import { KaruteNoBadge } from "@/components/company/KaruteNoBadge";
import { CompletenessChecklistCard } from "@/components/kpi/CompletenessChecklistCard";
import type { CompletenessResult } from "@/lib/domain/completeness/completeness";
import { HyogikaiMembershipBadge } from "@/components/health/HyogikaiMembershipBadge";
import {
  getHyogikaiMembership,
  getHyogikaiMemberSince
} from "@/lib/domain/community/hyogikai-membership";
import {
  setCompanyJourneyStageAction,
  setBusinessJourneyStageAction
} from "./journey-actions";
import { computeFromContract, computeHealthScore } from "@/lib/domain/health/health";
import type { CccBreakdown } from "@/lib/domain/ccc/breakdown";
import { CccSection } from "@/components/health/CccSection";
import { InnerRingsSection } from "@/components/community/InnerRingsSection";
import { HealthExplain } from "@/components/health/HealthExplain";
import { HealthSparkline } from "@/components/health/HealthSparkline";
import { ContractChurnSignals } from "@/components/contract/ContractChurnSignals";
import { ContractExpansionOpportunities } from "@/components/contract/ContractExpansionOpportunities";
import { CompanyVocList } from "@/components/company/CompanyVocList";
import {
  StakeholderEngagementBlock,
  type StakeholderEngagementMetrics
} from "@/components/stakeholder/StakeholderEngagementCard";
import { useHealthSnapshots } from "@/lib/hooks/useHealthSnapshots";
import type { ChurnRecord } from "@/lib/mock/churn";
import { reasonCategoryLabels, reasonCategoryOrder, churnRecords as initialChurnRecords } from "@/lib/mock/churn";
import type { EmailThreadStatus } from "@/lib/mock/email";
import type { EmailThread, EmailMessage } from "@/lib/repository/types";
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
  participantSurveyResponseRate,
  participantFieldSchemas,
  participantTermByProduct
} from "@/lib/mock/participants";
import type { Participant } from "@/lib/mock/participants";

type HealthColor = "green" | "yellow" | "red";

type Tab = "overview" | "tasks" | "weekly" | "contracts" | "logs" | "surveys" | "engagement" | "mail" | "documents" | "org_chart";

/**
 * 進捗系タブ（担当事業の契約がない or 担当外事業のみの企業では非表示にする）
 * 概要 / 契約・更新 / メール / 組織図 は常に表示（基本情報や閲覧用途）
 */
const PROGRESS_TABS: ReadonlySet<Tab> = new Set([
  "tasks",
  "weekly",
  "logs",
  "surveys",
  "engagement"
]);

const tabs: { key: Tab; label: string }[] = [
  { key: "overview", label: "概要" },
  { key: "contracts", label: "契約・更新" },
  { key: "tasks", label: "ToDo" },
  { key: "weekly", label: "週次レビュー" },
  { key: "surveys", label: "アンケート" },
  { key: "engagement", label: "出席・参加状況" },
  { key: "logs", label: "ログ" },
  { key: "mail", label: "メール" },
  { key: "documents", label: "送付資料" },
  { key: "org_chart", label: "組織図" }
];

function healthBg(color: HealthColor) {
  return color === "green" ? "#3B82F6" : color === "yellow" ? "#F59E0B" : "#EF4444";
}

/* 商材切替タブ (segmented control) — 契約・更新 / ToDo タブで共用 */
function ProductTabs({
  codes,
  selected,
  onChange
}: {
  codes: ProductCode[];
  selected: ProductCode;
  onChange: (code: ProductCode) => void;
}) {
  return (
    <div
      className="inline-flex items-center gap-1 p-1 rounded-full bg-ink-100/70 border border-ink-100"
      role="tablist"
    >
      {codes.map((code) => {
        const p = productByCode[code];
        const active = code === selected;
        return (
          <button
            key={code}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(code)}
            className={[
              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition",
              active
                ? "bg-white shadow-sm font-semibold text-ink-900"
                : "text-ink-500 hover:text-ink-700"
            ].join(" ")}
          >
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ background: p.accent }}
            />
            <span>{p.shortName}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CompanyDetail({
  viewerRole,
  accessibleProductCodes = [],
  canManageContracts = false,
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
  assignments = [],
  completeness,
  engagementByStakeholder = {},
  companyJourney = null,
  businessJourneys = [],
  companyStageDefs = [],
  businessStageDefs = [],
  companySuggestion,
  businessSuggestions = {},
  checkpointStatusesByContract = {},
  lifecycleSnapshots = [],
  weatherOverride,
  companyVision = null,
  companyVisionLogs = [],
  weeklyReviews = [],
  programData = [],
  emailThreads = [],
  emailMessages = [],
  initialParticipants,
  headerHealthColor = "green",
  latestHealthByContract = {},
  churnSignalsByContract = {},
  vocItemsByCompany = [],
  driveSendLogs = [],
  cccBreakdown,
  innerRingsComputed = {}
}: {
  /** 閲覧者のグローバルロール。external だと進捗系タブを user_company_access ベースで制限 */
  viewerRole?: string;
  /** 閲覧者が担当する事業 productCode 一覧（admin は全 product） */
  accessibleProductCodes?: string[];
  /** role_permissions.contract_manage で許可されているか */
  canManageContracts?: boolean;
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
  /** CS 側のアサインメント (現状未使用 — 必要なら左サイドに復活) */
  assignments?: { userId: string; role: "primary" | "secondary" | "observer" | "sales_owner" }[];
  /** 未入力チェックリスト結果 (左サイドの最上段に折りたたみで表示) */
  completeness?: CompletenessResult;
  engagementByStakeholder?: Record<string, StakeholderEngagementMetrics>;
  companyJourney?: CompanyJourney | null;
  businessJourneys?: BusinessJourney[];
  companyStageDefs?: JourneyStageDefinition[];
  businessStageDefs?: JourneyStageDefinition[];
  companySuggestion?: JourneySuggestion;
  businessSuggestions?: Record<string, JourneySuggestion>;
  checkpointStatusesByContract?: Record<string, JourneyCheckpointStatus[]>;
  lifecycleSnapshots?: ContractLifecycleSnapshot[];
  /** 手動設定された天気 (未設定なら undefined) */
  weatherOverride?: CompanyWeather;
  /** 企業ビジョン (NEO参画動機 / 目標 / 活用方針) */
  companyVision?: CompanyVision | null;
  /** 企業ビジョンの改訂履歴 */
  companyVisionLogs?: CompanyVisionLog[];
  /** 直近の動きセクション用 — 週次レビュー一覧 */
  weeklyReviews?: WeeklyReview[];
  /** 事業別ToDo (program_company_tasks) を term ごとに事前ロードしたバンドル */
  programData?: ProgramBundle[];
  /** メールスレッド一覧 (この企業に紐づくもの) */
  emailThreads?: EmailThread[];
  /** メールメッセージ一覧 (上記スレッド配下のもの) */
  emailMessages?: EmailMessage[];
  /** 派遣社員 (アカデミア生 / 受講者 等) — supabase 由来。未指定なら mock を使う */
  initialParticipants?: Participant[];
  /**
   * ヘッダーバッジに表示するヘルスカラー。
   * Server Component (page.tsx) で health_score_snapshots の最新値から
   * worst-of-active で算出して渡す。snapshot 未生成の契約は green 扱い。
   */
  headerHealthColor?: HealthColor;
  /**
   * active 契約 ID → 最新 health_score_snapshot の Map。
   * CompanyHealthSection で契約別 breakdown を実シグナル由来の factor から
   * 再計算するために使う。snapshot 未生成の契約はキー未登録 = mock fallback。
   */
  latestHealthByContract?: Record<string, import("@/lib/repository/types").HealthSnapshot>;
  /**
   * 契約 ID → 未解決の解約予兆シグナル一覧。Server Component で
   * churnSignalRepo.listByContract({unresolvedOnly:true}) を契約ごとに呼んで構築する。
   * docs/PARITY.md §5 P0: Client 側で `@/lib/repository` から fetch する旧経路を廃止。
   */
  churnSignalsByContract?: Record<string, ChurnSignalRecord[]>;
  /**
   * 企業の未処理 VOC (open / in_progress)。Server Component で vocItemRepo.list 取得。
   * docs/PARITY.md §5 P0: 旧 Client fetch 経路を廃止。
   */
  vocItemsByCompany?: VocItemRecord[];
  /**
   * F4: Drive テンプレ送付履歴。Server Component で driveSendLogRepo.listByCompany() を取得。
   * 「送付資料」タブでテーブル表示する。
   */
  driveSendLogs?: DriveSendLog[];
  /**
   * CCC (Customer Community Construction) 2026 Framework スコア。
   * Server Component で computeCccBreakdown(...) を呼んで構築し、概要タブで可視化する。
   */
  cccBreakdown?: CccBreakdown;
  /**
   * F5: Inner Rings 用 — 各 stakeholder の自動算出 suggestedTier。
   * Server Component で computeStakeholderEngagement(...) を呼んで構築する。
   */
  innerRingsComputed?: Record<
    string,
    { suggestedTier: "core" | "active" | "casual" | "at_risk"; reasons: string[] }
  >;
}) {
  // 担当事業との重複で進捗系タブを表示するか判定
  // - admin: 常に表示
  // - external: 自身の company access があるならこのページに来られている時点で OK だが、
  //   進捗編集系のみ許可
  // - manager/member: 企業の契約のうち、担当事業の契約があれば表示
  const companyProductCodes = Array.from(new Set(allCycles.map((c) => c.product as string)));
  const hasAssignedContract =
    viewerRole === "admin" ||
    viewerRole === "external" ||
    companyProductCodes.some((pc) => accessibleProductCodes.includes(pc));
  const visibleTabs = tabs.filter((t) => {
    if (PROGRESS_TABS.has(t.key) && !hasAssignedContract) return false;
    return true;
  });

  const [tab, setTab] = useState<Tab>(visibleTabs[0]?.key ?? "overview");
  const [contactList, setContactList] = useState<Contact[]>(contacts);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editCompanyOpen, setEditCompanyOpen] = useState(false);
  // ContactEditDialog の availableScopes を contacts から導出 (OrgChartTab と同等のロジック)
  const availableScopes: ContactRoleScope[] = (() => {
    const seen = new Set<ContactRoleScope>();
    const list: ContactRoleScope[] = [];
    for (const c of contactList) {
      for (const r of c.roles ?? []) {
        if (!seen.has(r.scope)) {
          seen.add(r.scope);
          list.push(r.scope);
        }
      }
    }
    list.sort((a, b) => (a === "overall" ? -1 : b === "overall" ? 1 : 0));
    return list.length > 0 ? list : ["overall"];
  })();
  const updateContact = (next: Contact) =>
    setContactList((prev) => prev.map((c) => (c.id === next.id ? next : c)));
  // ヘッダーのヘルスカラーは Server 側で health_score_snapshots から算出済みの値を使う。
  // 旧来の lib/mock/health.companyHealthColor() (mock onboarding 直読み) は廃止。
  const healthColor: HealthColor = headerHealthColor;

  return (
    <main className="mx-auto max-w-[1720px] px-6 pt-0 pb-8">
      {/* 上部固定領域 (パンくず + ヘッダーバー)。グローバル TopNav (h-14) の直下に固定 */}
      <div className="sticky top-14 z-30 -mx-6 px-6 bg-white/85 backdrop-blur border-b border-ink-100">
        <div className="text-xs text-ink-500 pt-3 pb-1">
          <Link href="/companies" className="hover:text-ink-700">
            企業
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-ink-700">{company.name}</span>
        </div>
      <header className="h-14 flex items-center gap-3">
        {company.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={company.logoUrl}
            alt=""
            className="w-9 h-9 rounded-lg border border-ink-100 bg-white object-cover shrink-0"
          />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-ink-100 flex items-center justify-center text-ink-500 text-xs font-semibold shrink-0">
            {company.name.charAt(0)}
          </div>
        )}
        <KaruteNoBadge companyId={company.id} karuteNo={company.karuteNo} />
        <h1 className="text-base font-semibold text-ink-900 truncate min-w-0">
          {company.name}
        </h1>
        {(company.isDemo ?? true) && (
          <span
            title="デモデータ (is_demo=true)"
            className="hidden lg:inline-flex shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
          >
            🚧 デモ
          </span>
        )}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <CompanyWeatherPicker companyId={company.id} weather={weatherOverride} />
          <HealthWithTrend
            companyId={company.id}
            color={healthColor}
            contracts={contracts}
          />
          {company.driveFolderUrl ? (
            <a
              href={company.driveFolderUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-ink-100 bg-white px-2.5 py-1 text-xs text-ink-700 hover:bg-ink-50"
              title="Google Drive 顧客フォルダを開く"
            >
              <span aria-hidden>📁</span>
              <span className="hidden md:inline">Drive</span>
            </a>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-700">
              <span aria-hidden>📁</span>
              <span className="hidden md:inline">未作成</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => setEditCompanyOpen(true)}
            title="企業情報を編集"
            className="px-3 py-1.5 rounded-full bg-white border border-ink-100 text-xs text-ink-700 hover:bg-ink-50"
          >
            編集
          </button>
          <button
            type="button"
            disabled
            title="準備中: 接点ログ追加は別途実装予定"
            className="px-3 py-1.5 rounded-full bg-ink-300 text-white text-xs cursor-not-allowed"
          >
            + ログ
          </button>
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-md border border-ink-100 text-ink-700 hover:bg-ink-50"
            aria-label="メニュー"
          >
            <span aria-hidden>☰</span>
          </button>
        </div>
      </header>
      </div>

      {/* メイン: 左サイド + コンテンツ */}
      <div className="flex gap-6 mt-4">
        <aside className="hidden md:block w-[280px] shrink-0">
          {/* sticky 単独。外側の overflow を持たせず、ページスクロールで動かないようにする
             (担当者一覧など各カード内部で必要に応じてスクロール) */}
          <div className="sticky top-[156px] space-y-5">
            <CompanySidebarPanel
              company={company}
              allCycles={allCycles}
              contacts={contactList}
              completeness={completeness}
              onEditContact={setEditingContact}
              onEditCompany={() => setEditCompanyOpen(true)}
            />
          </div>
        </aside>

        {sidebarOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-white p-4 shadow-xl overflow-y-auto">
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="mb-3 text-sm text-ink-500"
              >
                ← 閉じる
              </button>
              <CompanySidebarPanel
                company={company}
                allCycles={allCycles}
                contacts={contactList}
                completeness={completeness}
                onEditContact={setEditingContact}
                onEditCompany={() => setEditCompanyOpen(true)}
              />
            </div>
          </div>
        )}

        <section className="flex-1 min-w-0 space-y-6">
          {/* タブ (上部固定: ヘッダー(56px)直下) */}
          <nav className="sticky top-[146px] z-20 -mx-2 px-2 bg-white/90 backdrop-blur flex items-center gap-1 border-b border-ink-100 overflow-x-auto">
            {visibleTabs.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={[
                    "px-4 py-2.5 text-sm transition relative -mb-px whitespace-nowrap",
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
        <OverviewTab
          company={company}
          companyId={company.id}
          companyJourney={companyJourney}
          companyStageDefs={companyStageDefs}
          companySuggestion={companySuggestion}
          contracts={contracts}
          logs={logs}
          weeklyReviews={weeklyReviews}
          lifecycleSnapshots={lifecycleSnapshots}
          pastContracts={allCycles}
          companyVision={companyVision}
          companyVisionLogs={companyVisionLogs}
          latestHealthByContract={latestHealthByContract}
          cccBreakdown={cccBreakdown}
          stakeholders={stakeholders}
          innerRingsComputed={innerRingsComputed}
        />
      )}
      {tab === "tasks" && (
        <TodoTab
          companyId={company.id}
          companyName={company.name}
          contracts={contracts}
          allCycles={allCycles}
          items={items}
          tasks={tasks}
          members={members}
          programData={programData}
        />
      )}
      {tab === "weekly" && (
        <WeeklyReviewPanel
          companyId={company.id}
          activeContracts={contracts}
          weeklyReviews={weeklyReviews}
        />
      )}
      {tab === "contracts" && (
        <ContractsTab
          allCycles={allCycles}
          successPlans={successPlans}
          businessJourneys={businessJourneys}
          businessStageDefs={businessStageDefs}
          businessSuggestions={businessSuggestions}
          checkpointStatusesByContract={checkpointStatusesByContract}
          companyId={company.id}
          canManageContracts={canManageContracts}
          churnSignalsByContract={churnSignalsByContract}
          vocItemsByCompany={vocItemsByCompany}
        />
      )}
      {/* 解約モーダルの管理は ContractsTab 内で完結 */}
      {tab === "logs" && (
        <LogsTab
          logs={logs}
          companyId={company.id}
          contacts={contacts}
          members={members ?? []}
        />
      )}
      {tab === "surveys" && <SurveysTab companyId={company.id} contracts={allCycles} />}
      {tab === "engagement" && <EngagementTab companyId={company.id} contracts={allCycles} />}
      {tab === "mail" && (
        <MailTab
          companyId={company.id}
          emailThreads={emailThreads}
          emailMessages={emailMessages}
        />
      )}
      {tab === "documents" && (
        <DriveSendLogsSection companyId={company.id} logs={driveSendLogs} />
      )}
      {tab === "org_chart" && (
        <OrgChartTab
          companyId={company.id}
          contacts={contactList}
          allCycles={allCycles}
          onUpdateContact={updateContact}
          initialParticipants={initialParticipants}
        />
      )}
        </section>
      </div>

      {editingContact && (
        <ContactEditDialog
          contact={editingContact}
          availableScopes={availableScopes}
          allCycles={allCycles}
          onClose={() => setEditingContact(null)}
          onSave={(next) => {
            updateContact(next);
            setEditingContact(null);
          }}
        />
      )}

      {editCompanyOpen && (
        <CompanyEditDialog
          company={company}
          onClose={() => setEditCompanyOpen(false)}
        />
      )}
    </main>
  );
}

/* ──────────────── 左サイドバー: 未入力チェック / 累計売上 / 企業情報 / 担当者一覧 ──────────────── */
function CompanySidebarPanel({
  company,
  allCycles,
  contacts,
  completeness,
  onEditContact,
  onEditCompany
}: {
  company: Company;
  allCycles: ActiveContract[];
  contacts: Contact[];
  completeness?: CompletenessResult;
  onEditContact: (c: Contact) => void;
  onEditCompany?: () => void;
}) {
  // 累計売上 + 事業別ブレイクダウン (revenue × cycles)
  const total = allCycles.reduce((s, c) => s + (c.revenue ?? 0), 0);
  const breakdown = new Map<ProductCode, { amount: number; cycles: number }>();
  for (const c of allCycles) {
    const code = c.product as ProductCode;
    const prev = breakdown.get(code) ?? { amount: 0, cycles: 0 };
    breakdown.set(code, {
      amount: prev.amount + (c.revenue ?? 0),
      cycles: prev.cycles + 1
    });
  }
  const breakdownEntries = Array.from(breakdown.entries()).sort(
    (a, b) => b[1].amount - a[1].amount
  );

  // 担当者一覧 = 顧客企業の組織図 (contacts) — primary→役職レベル→名前順
  const ROLE_LEVEL_RANK: Record<ContactRoleLevel, number> = {
    executive: 0,
    approver: 1,
    lead: 2,
    member: 3
  };
  const highestLevel = (c: Contact): ContactRoleLevel | null => {
    if (!c.roles || c.roles.length === 0) return null;
    return [...c.roles].sort(
      (a, b) => ROLE_LEVEL_RANK[a.level] - ROLE_LEVEL_RANK[b.level]
    )[0].level;
  };
  const sortedContacts = [...contacts].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    const la = highestLevel(a);
    const lb = highestLevel(b);
    const ra = la ? ROLE_LEVEL_RANK[la] : 99;
    const rb = lb ? ROLE_LEVEL_RANK[lb] : 99;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name, "ja");
  });

  return (
    <>
      {/* 未入力チェック (折りたたみ) */}
      {completeness && (
        <CompletenessChecklistCard
          result={completeness}
          defaultOpen={false}
          compact
        />
      )}

      {/* 累計売上 */}
      <div className="rounded-2xl border border-ink-100 bg-white p-4">
        <div className="text-[11px] font-medium text-ink-500">累計売上</div>
        <div className="mt-1 text-xl font-bold text-ink-900 tabular-nums">
          {yen(total)}
        </div>
        {breakdownEntries.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-[11px] text-ink-400">
            {breakdownEntries.map(([code, v]) => {
              const p = productByCode[code];
              if (!p) return null;
              const cycleSuffix = `${v.cycles}${p.cycleUnit}分`;
              return (
                <li key={code} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 truncate">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: p.accent }}
                    />
                    <span className="truncate">{p.shortName}</span>
                  </span>
                  <span className="tabular-nums">
                    {yen(v.amount)}{" "}
                    <span className="text-ink-300">({cycleSuffix})</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 企業情報 */}
      <div className="rounded-2xl border border-ink-100 bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] font-medium text-ink-500">企業情報</div>
          {onEditCompany && (
            <button
              type="button"
              onClick={onEditCompany}
              title="企業情報を編集"
              aria-label="企業情報を編集"
              className="w-6 h-6 rounded-full text-ink-400 hover:text-ink-700 hover:bg-ink-50 flex items-center justify-center text-xs"
            >
              ✎
            </button>
          )}
        </div>
        <dl className="space-y-1.5 text-xs">
          <SidebarField label="業種" value={company.industry} />
          {company.kana && <SidebarField label="カナ" value={company.kana} />}
          {company.group && <SidebarField label="グループ" value={company.group} />}
          {company.address && <SidebarField label="所在地" value={company.address} />}
          <SidebarField
            label="MRR"
            value={company.mrr != null ? yen(company.mrr) : "—"}
          />
          <SidebarField
            label="最終接点"
            value={company.lastTouchDays != null ? `${company.lastTouchDays}日前` : "—"}
          />
          {company.domains && company.domains.length > 0 && (
            <SidebarField
              label="ドメイン"
              value={company.domains.join(", ")}
            />
          )}
        </dl>
      </div>

      {/* 担当者一覧 — 顧客企業 (組織図) の連絡先。5名まで常時表示, それ以降スクロール */}
      <div className="rounded-2xl border border-ink-100 bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] font-medium text-ink-500">担当者一覧</div>
          <div className="text-[11px] text-ink-400 tabular-nums">
            {sortedContacts.length}名
          </div>
        </div>
        {sortedContacts.length === 0 ? (
          <div className="text-xs text-ink-400">未登録</div>
        ) : (
          <ul className="max-h-[360px] overflow-y-auto pr-1 -mr-1">
            {sortedContacts.map((c) => (
              <li
                key={c.id}
                className="flex items-start gap-2 py-1.5 text-xs"
              >
                <div className="w-6 h-6 rounded-full bg-ink-100 flex items-center justify-center text-[10px] text-ink-700 shrink-0 mt-0.5">
                  {c.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="text-ink-900 truncate flex-1">{c.name}</span>
                    <button
                      type="button"
                      onClick={() => onEditContact(c)}
                      className="shrink-0 text-ink-400 hover:text-ink-700 px-1"
                      title="編集"
                      aria-label={`${c.name} を編集`}
                    >
                      <span aria-hidden>✎</span>
                    </button>
                    {c.email ? (
                      <a
                        href={`mailto:${c.email}`}
                        className="shrink-0 text-ink-400 hover:text-ink-700 px-1"
                        title={`メール: ${c.email}`}
                        aria-label={`${c.name} へメール送信`}
                      >
                        <span aria-hidden>✉</span>
                      </a>
                    ) : (
                      <span
                        className="shrink-0 text-ink-200 px-1 cursor-not-allowed"
                        title="メールアドレス未登録"
                        aria-hidden
                      >
                        ✉
                      </span>
                    )}
                  </div>
                  {c.title && (
                    <div className="text-[10px] text-ink-400 truncate">
                      {c.title}
                    </div>
                  )}
                  {(() => {
                    const lvl = highestLevel(c);
                    if (!lvl) return null;
                    const m = ROLE_LEVEL_META[lvl];
                    return (
                      <div className="mt-1">
                        <span
                          className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full border ${m.tone}`}
                        >
                          {m.label}
                        </span>
                      </div>
                    );
                  })()}
                  {((c.products && c.products.length > 0) ||
                    (c.functions && c.functions.length > 0)) && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {c.products?.map((code) => {
                        const p = productByCode[code as ProductCode];
                        if (!p) return null;
                        return (
                          <span
                            key={`prod-${code}`}
                            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-ink-50 border border-ink-100 text-ink-700"
                            title={p.name}
                          >
                            <span
                              className="inline-block w-1.5 h-1.5 rounded-full"
                              style={{ background: p.accent }}
                            />
                            {p.shortName}
                          </span>
                        );
                      })}
                      {c.functions?.map((fn) => (
                        <FunctionBadge key={`fn-${fn}`} fn={fn} />
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function SidebarField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-ink-400 w-16 shrink-0">{label}</dt>
      <dd className="text-ink-800 break-words flex-1">{value}</dd>
    </div>
  );
}

/* ──────────────── ヘルススコア + 30日トレンド ──────────────── */
//   30日トレンドは companyId からの決定的ハッシュで -10..+10 の差分を生成。
//   将来 health_snapshots の集計に置換予定。現在値は色のみ既存ロジック準拠。
function HealthWithTrend({
  companyId,
  color,
  contracts
}: {
  companyId: string;
  color: HealthColor;
  contracts: ActiveContract[];
}) {
  // 簡易ハッシュ → -10..+10
  let h = 0;
  for (let i = 0; i < companyId.length; i++) {
    h = (h * 31 + companyId.charCodeAt(i)) | 0;
  }
  const delta30 = ((Math.abs(h) % 21) - 10);
  const arrow = delta30 > 1 ? "↑" : delta30 < -1 ? "↓" : "→";
  const tone =
    delta30 > 1 ? "text-emerald-600" : delta30 < -1 ? "text-red-600" : "text-ink-400";
  return (
    <div className="inline-flex items-center gap-1.5">
      <CompanyHealthBadge color={color} contracts={contracts} />
      <span
        className={`inline-flex items-center text-[11px] tabular-nums ${tone}`}
        title="直近30日の変化"
      >
        <span aria-hidden>{arrow}</span>
        <span>
          {delta30 > 0 ? "+" : ""}
          {delta30}
        </span>
      </span>
    </div>
  );
}

/* ──────────────── 概要タブ ──────────────── */
//   ビジョン / 企業ジャーニー / 直近の動き / 健康スコア / 過去契約事業 のみに整理。
//   事業ジャーニーは契約・更新タブに移管。組織図・契約中研修・企業情報は別タブ/削除。
function OverviewTab({
  company,
  companyId,
  companyJourney,
  companyStageDefs,
  companySuggestion,
  contracts,
  logs,
  weeklyReviews,
  lifecycleSnapshots,
  pastContracts,
  companyVision,
  companyVisionLogs,
  latestHealthByContract,
  cccBreakdown,
  stakeholders,
  innerRingsComputed
}: {
  company: Company;
  companyId: string;
  companyJourney: CompanyJourney | null;
  companyStageDefs: JourneyStageDefinition[];
  companySuggestion?: JourneySuggestion;
  contracts: ActiveContract[];
  logs: MeetingLog[];
  weeklyReviews: WeeklyReview[];
  lifecycleSnapshots: ContractLifecycleSnapshot[];
  pastContracts: ActiveContract[];
  companyVision?: CompanyVision | null;
  companyVisionLogs?: CompanyVisionLog[];
  latestHealthByContract: Record<string, import("@/lib/repository/types").HealthSnapshot>;
  cccBreakdown?: CccBreakdown;
  stakeholders: Stakeholder[];
  innerRingsComputed: Record<
    string,
    { suggestedTier: "core" | "active" | "casual" | "at_risk"; reasons: string[] }
  >;
}) {
  // 直近の動き: 面談ログ + 週次レビューを時系列でマージ
  const recentActivity = buildRecentActivity(logs, weeklyReviews, 6);

  return (
    <section className="space-y-4">
      {/* 1. 企業ビジョン */}
      <CompanyVisionSection
        companyId={companyId}
        vision={companyVision ?? null}
        logs={companyVisionLogs ?? []}
      />

      {/* 2. 企業ジャーニー */}
      <CompanyJourneySection
        companyId={companyId}
        companyJourney={companyJourney}
        stageDefs={companyStageDefs}
        suggestion={companySuggestion}
      />

      {/* 3. 直近の動き + 4. CCC スコア (2カラム) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentActivitySection items={recentActivity} />
        {cccBreakdown ? (
          <CccSection breakdown={cccBreakdown} />
        ) : (
          <CompanyHealthSection
            contracts={contracts}
            latestHealthByContract={latestHealthByContract}
          />
        )}
      </div>

      {/* 4.5 Inner Rings (F5): コア候補発見動線 — CCC セクションの直下に配置 */}
      <InnerRingsSection
        companyId={companyId}
        stakeholders={stakeholders}
        computedByStakeholder={innerRingsComputed}
      />

      {/* 5. 過去契約事業 */}
      {lifecycleSnapshots.length > 0 && (
        <section className="liquid-surface p-5 space-y-3">
          <div>
            <div className="text-sm font-semibold text-ink-700">過去契約事業</div>
            <div className="mt-0.5 text-[11px] text-ink-500">
              解約・更新成功・期満了の時点で凍結された記録 (改変不可)
            </div>
          </div>
          <ContractHistorySection
            snapshots={lifecycleSnapshots}
            contracts={pastContracts}
          />
        </section>
      )}
    </section>
  );
}

/* ──────────────── 直近の動き ──────────────── */
type RecentActivityItem = {
  id: string;
  date: string;
  kind: "meeting" | "weekly";
  label: string;
  summary?: string;
  authorName?: string;
};

function buildRecentActivity(
  logs: MeetingLog[],
  weeklyReviews: WeeklyReview[],
  limit: number
): RecentActivityItem[] {
  const items: RecentActivityItem[] = [];
  for (const l of logs) {
    items.push({
      id: l.id,
      date: l.date,
      kind: "meeting",
      label: l.title,
      summary: l.summary,
      authorName: l.authorName
    });
  }
  for (const w of weeklyReviews) {
    items.push({
      id: w.id,
      date: w.weekStart,
      kind: "weekly",
      label: `週次レビュー ${w.weekLabel} (${w.weekStart})`,
      summary: [w.good, w.more].filter(Boolean).join(" / ") || undefined,
      authorName: w.authorName
    });
  }
  return items
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, limit);
}

function RecentActivitySection({ items }: { items: RecentActivityItem[] }) {
  return (
    <section className="liquid-surface p-5 space-y-3">
      <div>
        <div className="text-sm font-semibold text-ink-700">直近の動き</div>
        <div className="mt-0.5 text-[11px] text-ink-500">
          ログ・週次レビュー（直近）
        </div>
      </div>
      {items.length === 0 ? (
        <div className="text-[12px] text-ink-500 py-4 text-center bg-ink-50/40 rounded-md border border-dashed border-ink-200">
          直近の記録はまだありません
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
              className="rounded-md border border-ink-100 bg-white p-2.5"
            >
              <div className="flex items-center gap-2">
                <span
                  className={[
                    "text-[10px] px-1.5 py-0.5 rounded font-medium",
                    it.kind === "meeting"
                      ? "bg-sky-50 text-sky-700 border border-sky-100"
                      : "bg-violet-50 text-violet-700 border border-violet-100"
                  ].join(" ")}
                >
                  {it.kind === "meeting" ? "ログ" : "週次"}
                </span>
                <span className="text-[11px] text-ink-500">
                  {it.date}
                </span>
                {it.authorName && (
                  <span className="text-[10px] text-ink-400 ml-auto">
                    {it.authorName}
                  </span>
                )}
              </div>
              <div className="text-sm font-medium text-ink-900 mt-1">
                {it.label}
              </div>
              {it.summary && (
                <p className="text-[11px] text-ink-700 mt-0.5 leading-relaxed line-clamp-2">
                  {it.summary}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ──────────────── 健康スコア（契約ごと） ──────────────── */
function CompanyHealthSection({
  contracts,
  latestHealthByContract
}: {
  contracts: ActiveContract[];
  latestHealthByContract: Record<string, import("@/lib/repository/types").HealthSnapshot>;
}) {
  return (
    <section className="liquid-surface p-5 space-y-3">
      <div>
        <div className="text-sm font-semibold text-ink-700">健康スコア</div>
        <div className="mt-0.5 text-[11px] text-ink-500">
          契約 (商材×期) ごとの Health 状況
        </div>
      </div>
      {contracts.length === 0 ? (
        <div className="text-[12px] text-ink-500 py-4 text-center bg-ink-50/40 rounded-md border border-dashed border-ink-200">
          現行契約なし
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.map((c) => {
            // 最新 snapshot があれば factors から breakdown を再計算 (実シグナル由来)。
            // 無ければ Contract から推定 (mock 互換のフォールバック)。
            const snap = latestHealthByContract[c.id];
            const breakdown = snap
              ? computeHealthScore(snap.factors, snap.computedAt)
              : computeFromContract(c);
            return (
              <div
                key={c.id}
                className="rounded-md border border-ink-100 bg-white p-3 space-y-2"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <ProductBadge code={c.product} size="sm" />
                  {hasMultipleCourses(c.product) && (
                    <span className="text-[10px] text-ink-500">
                      {courseShortName(c.product, c.courseKey)}
                    </span>
                  )}
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-ink-50 text-ink-700 border border-ink-100">
                    {cycleLabel(c.product, c.cycleNumber)}
                  </span>
                  <span
                    className={[
                      "ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold",
                      breakdown.color === "green"
                        ? "bg-blue-50 text-blue-700 border border-blue-100"
                        : breakdown.color === "yellow"
                        ? "bg-amber-50 text-amber-700 border border-amber-100"
                        : "bg-rose-50 text-rose-700 border border-rose-100"
                    ].join(" ")}
                  >
                    {breakdown.color.toUpperCase()} ({breakdown.score})
                  </span>
                </div>
                <HealthExplain breakdown={breakdown} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ──────────────── 組織図タブ ──────────────── */
function OrgChartTab({
  companyId,
  contacts,
  allCycles,
  onUpdateContact,
  initialParticipants
}: {
  companyId: string;
  contacts: Contact[];
  allCycles: ActiveContract[];
  onUpdateContact: (next: Contact) => void;
  initialParticipants?: Participant[];
}) {
  // 担当者ゼロでも参加者の追加導線を残すため早期 return しない
  return (
    <section className="space-y-4">
      <ContactOrgTree
        companyId={companyId}
        contacts={contacts}
        allCycles={allCycles}
        onUpdate={onUpdateContact}
        initialParticipants={initialParticipants}
      />

      {contacts.length > 0 && (
      <details className="liquid-surface p-5 group">
        <summary className="cursor-pointer text-sm font-semibold text-ink-700 hover:text-ink-900 select-none">
          カード一覧表示（{contacts.length}名）
        </summary>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-ink-100 p-3 bg-white"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-sm font-semibold text-ink-900">
                  {c.name}
                </div>
                {c.isPrimary && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-blue/10 text-brand-blue border border-brand-blue/20">
                    主担当
                  </span>
                )}
                {(c.functions ?? []).map((f) => (
                  <FunctionBadge key={f} fn={f} />
                ))}
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
              {c.note && (
                <div className="mt-2 text-[11px] text-ink-700 bg-ink-50/70 border border-ink-100 rounded-lg px-2 py-1.5 whitespace-pre-wrap">
                  <span className="text-[10px] text-ink-500 font-semibold">
                    備考:{" "}
                  </span>
                  {c.note}
                </div>
              )}
            </div>
          ))}
        </div>
      </details>
      )}
    </section>
  );
}

// 旧 CustomerJourneySection / JourneyContractCard は廃止 (事業ジャーニーに統合)

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

/* ──────────────── ログタブ (メール / 電話 / 面談・商談) ──────────────── */
function LogsTab({
  logs,
  companyId,
  contacts,
  members
}: {
  logs: MeetingLog[];
  companyId: string;
  contacts: Contact[];
  members: { id: string; name: string }[];
}) {
  const typeLabel: Record<MeetingLog["type"], string> = {
    mtg: "面談",
    mail: "メール",
    call: "電話"
  };
  const { user: currentUser, name: currentUserName } = useCurrentUser();
  const currentUserId = currentUser?.id;
  const [addOpen, setAddOpen] = useState(false);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-ink-500">
          全 {logs.length} 件のログ（電話 / 面談）
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="px-4 py-2 rounded-full bg-ink-900 hover:bg-ink-800 text-white text-sm"
        >
          ＋ ログを追加
        </button>
      </div>

      <AddLogModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        companyId={companyId}
        defaultAuthor={currentUserName ?? "自分"}
        defaultAuthorId={currentUserId ?? undefined}
        contacts={contacts}
        members={members}
      />

      {logs.length === 0 && (
        <div className="liquid-surface p-8 text-center text-sm text-ink-500">
          ログはまだありません。右上の「＋ ログを追加」から記録できます。
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
            <p className="mt-1.5 text-sm text-ink-700 leading-relaxed whitespace-pre-line">
              {l.summary}
            </p>
            {l.notionUrl && (
              <a
                href={l.notionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-600 hover:text-ink-900 underline"
              >
                <span>📝</span>
                Notion 議事録を開く
              </a>
            )}

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
/* ──────────────── ToDo タブ ────────────────
   3 サブカテゴリ:
     - オンボ: contractOnboardingItems (productOnboardingTemplates から展開)
     - 事業別ToDo: program_company_tasks (Phase 2 後半で repo 連携。現状は placeholder)
     - 個社ToDo: CompanyTasksSection (既存)
   右上: 契約中事業の切替タブ */
function TodoTab({
  companyId,
  companyName,
  contracts,
  allCycles,
  items,
  tasks,
  members,
  programData
}: {
  companyId: string;
  companyName: string;
  contracts: ActiveContract[];
  allCycles: ActiveContract[];
  items: ContractOnboardingItem[];
  tasks: CompanyTask[];
  members: { id: string; name: string }[];
  programData: ProgramBundle[];
}) {
  const productCodes = Array.from(new Set(contracts.map((c) => c.product)));
  const [selectedCode, setSelectedCode] = useState<ProductCode | "all">("all");
  const [subcat, setSubcat] = useState<"onboarding" | "program" | "company">(
    "onboarding"
  );

  const filteredContracts =
    selectedCode === "all"
      ? contracts
      : contracts.filter((c) => c.product === selectedCode);
  const filteredItems = items.filter((it) =>
    filteredContracts.some((c) => c.id === it.contractId)
  );

  return (
    <section className="space-y-4">
      {/* ヘッダ: サブカテゴリタブ + 事業切替 (上部のメインタブ直下に固定) */}
      <div className="sticky top-[190px] z-10 -mx-2 px-2 py-2 bg-white/90 backdrop-blur flex items-center justify-between flex-wrap gap-3 border-b border-ink-100">
        <div className="inline-flex items-center gap-1 p-1 rounded-md bg-ink-100/70 border border-ink-100">
          {([
            { key: "onboarding", label: "オンボ" },
            { key: "program", label: "事業別ToDo" },
            { key: "company", label: "個社ToDo" }
          ] as const).map((s) => {
            const active = subcat === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSubcat(s.key)}
                className={[
                  "px-3 py-1 rounded text-xs transition",
                  active
                    ? "bg-white shadow-sm font-semibold text-ink-900"
                    : "text-ink-500 hover:text-ink-700"
                ].join(" ")}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {productCodes.length > 0 && (
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-ink-100/70 border border-ink-100">
            <button
              type="button"
              onClick={() => setSelectedCode("all")}
              className={[
                "px-3 py-1 rounded-full text-xs transition",
                selectedCode === "all"
                  ? "bg-white shadow-sm font-semibold text-ink-900"
                  : "text-ink-500 hover:text-ink-700"
              ].join(" ")}
            >
              すべて
            </button>
            {productCodes.map((code) => {
              const p = productByCode[code];
              const active = selectedCode === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setSelectedCode(code)}
                  className={[
                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition",
                    active
                      ? "bg-white shadow-sm font-semibold text-ink-900"
                      : "text-ink-500 hover:text-ink-700"
                  ].join(" ")}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: p.accent }}
                  />
                  {p.shortName}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* サブカテゴリ別本体 */}
      {subcat === "onboarding" && (
        <OnboardingTab
          contracts={filteredContracts}
          items={filteredItems}
          members={members}
          today={new Date().toISOString().slice(0, 10)}
        />
      )}
      {subcat === "program" && (
        <ProgramSubTab
          companyId={companyId}
          companyName={companyName}
          programData={programData}
          selectedCode={selectedCode}
          members={members}
        />
      )}
      {subcat === "company" && (
        <CompanyTasksSection
          companyId={companyId}
          initialTasks={tasks}
          contracts={(selectedCode === "all"
            ? allCycles
            : allCycles.filter((c) => c.product === selectedCode)
          ).map((c) => ({
            id: c.id,
            label: `${c.product} / ${c.courseKey ?? "-"} (${cycleLabel(c.product, c.cycleNumber)})`
          }))}
          members={members}
        />
      )}
    </section>
  );
}

/* オンボサブカテゴリ — /onboarding/[contractId] と同等の ChecklistView を契約ごとに描画 */
/* 事業別ToDo サブカテゴリ — 該当 term ごとに ProgramMatrix を当社 1 行で表示 */
function ProgramSubTab({
  companyId,
  companyName,
  programData,
  selectedCode,
  members
}: {
  companyId: string;
  companyName: string;
  programData: ProgramBundle[];
  selectedCode: ProductCode | "all";
  members: { id: string; name: string }[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const filtered = selectedCode === "all"
    ? programData
    : programData.filter((b) => b.term.productCode === selectedCode);

  if (filtered.length === 0) {
    return (
      <section className="liquid-surface p-10 text-center text-sm text-ink-500">
        この企業に紐づく事業別ToDo はありません
      </section>
    );
  }

  return (
    <section className="space-y-5">
      {filtered.map((b) => (
        <ProgramChecklistCard
          key={b.term.id}
          bundle={b}
          companyId={companyId}
          members={members}
          today={today}
        />
      ))}
    </section>
  );
}

/* 事業別ToDo を オンボ仕様 (カテゴリ別アコーディオン + チェックリスト) で描画 */
function ProgramChecklistCard({
  bundle,
  companyId,
  members,
  today
}: {
  bundle: ProgramBundle;
  companyId: string;
  members: { id: string; name: string }[];
  today: string;
}) {
  const p = productByCode[bundle.term.productCode as ProductCode];
  const accent = p?.accent ?? "#3D9EFF";

  // この企業のセルだけ抽出 (programData は対象企業の cells が前提だが念のため)
  const myCells = bundle.cells.filter((c) => c.companyId === companyId);
  const cellByTemplate = new Map(myCells.map((c) => [c.templateId, c]));

  const userMap = new Map(members.map((m) => [m.id, m.name]));

  const [cells, setCells] = useState(myCells);
  const [, startTransition] = useTransition();

  const cellByTemplateState = new Map(cells.map((c) => [c.templateId, c]));

  // 集計
  let total = 0;
  let done = 0;
  let overdue = 0;
  for (const t of bundle.templates) {
    const cell = cellByTemplateState.get(t.id) ?? cellByTemplate.get(t.id);
    if (!cell || cell.status === "not_applicable" || cell.status === "skipped") continue;
    total++;
    if (cell.status === "done") done++;
    if (
      (cell.status === "pending" || cell.status === "in_progress") &&
      cell.dueDate &&
      cell.dueDate < today
    )
      overdue++;
  }

  // カテゴリ別グルーピング (templateの順に並んでいる前提を維持)
  const grouped = new Map<ProgramTaskCategory | "uncategorized", typeof bundle.templates>();
  for (const t of bundle.templates) {
    const key = (t.category ?? "uncategorized") as ProgramTaskCategory | "uncategorized";
    const arr = grouped.get(key) ?? [];
    arr.push(t);
    grouped.set(key, arr);
  }

  const [openCats, setOpenCats] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(Array.from(grouped.keys()).map((k) => [k, true]))
  );

  function toggleStatus(cellId: string, current: ProgramCellStatus) {
    const next: ProgramCellStatus = current === "done" ? "pending" : "done";
    setCells((prev) =>
      prev.map((c) =>
        c.id === cellId
          ? {
              ...c,
              status: next,
              completedAt: next === "done" ? new Date().toISOString() : undefined
            }
          : c
      )
    );
    startTransition(async () => {
      try {
        await setProgramCellStatus(cellId, bundle.term.id, next);
      } catch (e) {
        console.error(e);
        // ロールバック
        setCells((prev) =>
          prev.map((c) => (c.id === cellId ? { ...c, status: current } : c))
        );
      }
    });
  }

  return (
    <div className="liquid-surface p-5 space-y-4">
      {/* ヘッダ — オンボ仕様に揃える */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ProductBadge code={bundle.term.productCode as ProductCode} />
            {bundle.term.courseKey && (
              <span
                className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  color: accent,
                  background: `${accent}14`,
                  border: `1px solid ${accent}33`
                }}
              >
                {courseShortName(
                  bundle.term.productCode as ProductCode,
                  bundle.term.courseKey
                )}
              </span>
            )}
            <span className="text-sm font-semibold text-ink-900">
              {bundle.term.label}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[11px] text-ink-500">全体</div>
          <div className="text-base font-bold text-ink-900 tabular-nums">
            {done}/{total}
          </div>
          {overdue > 0 && (
            <div className="text-[11px] text-rose-500">期日超過 {overdue}件</div>
          )}
        </div>
      </div>

      {/* 進捗バー */}
      <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${total > 0 ? (done / total) * 100 : 0}%`,
            background: accent
          }}
        />
      </div>

      {/* カテゴリ別アコーディオン */}
      <div className="space-y-2">
        {Array.from(grouped.entries()).map(([cat, tpls]) => {
          let catDone = 0;
          let catTotal = 0;
          for (const t of tpls) {
            const cell = cellByTemplateState.get(t.id);
            if (!cell || cell.status === "not_applicable" || cell.status === "skipped")
              continue;
            catTotal++;
            if (cell.status === "done") catDone++;
          }
          const catLabel =
            cat === "uncategorized"
              ? "未分類"
              : PROGRAM_TASK_CATEGORY_LABEL[cat as ProgramTaskCategory];
          const open = openCats[cat] ?? true;
          return (
            <div key={cat} className="rounded-xl border border-ink-100 bg-white">
              <button
                type="button"
                onClick={() =>
                  setOpenCats((prev) => ({ ...prev, [cat]: !open }))
                }
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-ink-50 rounded-xl"
              >
                <span className="text-xs text-ink-500">{open ? "▼" : "▶"}</span>
                <span className="text-sm font-semibold text-ink-800">
                  {catLabel}
                </span>
                <span className="text-[11px] text-ink-500 tabular-nums">
                  {catDone}/{catTotal}
                </span>
                <div className="ml-auto w-32 h-1 rounded-full bg-ink-100 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${catTotal > 0 ? (catDone / catTotal) * 100 : 0}%`,
                      background: accent
                    }}
                  />
                </div>
              </button>
              {open && (
                <ul className="border-t border-ink-100 divide-y divide-ink-100">
                  {tpls.map((t) => {
                    const cell = cellByTemplateState.get(t.id);
                    const status: ProgramCellStatus = cell?.status ?? "pending";
                    const isDone = status === "done";
                    const isOverdue =
                      cell?.dueDate &&
                      cell.dueDate < today &&
                      (status === "pending" || status === "in_progress");
                    const ownerId = cell?.assignedTo ?? t.defaultAssigneeTo;
                    const ownerName = ownerId ? userMap.get(ownerId) : undefined;
                    const due = cell?.dueDate ?? t.defaultDueDate;
                    return (
                      <li
                        key={t.id}
                        className={[
                          "flex items-start gap-3 px-4 py-2.5 text-xs",
                          isOverdue ? "bg-rose-50/40" : ""
                        ].join(" ")}
                      >
                        <button
                          type="button"
                          disabled={!cell}
                          onClick={() => cell && toggleStatus(cell.id, status)}
                          aria-label={`${t.label} を ${
                            isDone ? "未完了" : "完了"
                          } にする`}
                          className={[
                            "mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center text-white text-[11px] shrink-0 transition",
                            isDone
                              ? "border-transparent"
                              : "bg-white border-ink-300 hover:border-ink-500",
                            !cell ? "opacity-50 cursor-not-allowed" : ""
                          ].join(" ")}
                          style={isDone ? { background: accent } : undefined}
                        >
                          {isDone ? "✓" : ""}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={[
                                "text-sm",
                                isDone
                                  ? "line-through text-ink-400"
                                  : "text-ink-900"
                              ].join(" ")}
                            >
                              {t.label}
                            </span>
                            {status !== "pending" && status !== "done" && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-ink-50 border border-ink-200 text-ink-600">
                                {PROGRAM_CELL_STATUS_LABEL[status]}
                              </span>
                            )}
                            {isOverdue && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-semibold">
                                期限切れ
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-3 text-[11px] text-ink-500">
                            {due && <span>期日 {due.replace(/-/g, "/")}</span>}
                            {ownerName && <span>担当 {ownerName}</span>}
                            {cell?.completedAt && (
                              <span className="text-emerald-600">
                                完了日 {cell.completedAt.slice(0, 10).replace(/-/g, "/")}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OnboardingTab({
  contracts,
  items,
  members,
  today
}: {
  contracts: ActiveContract[];
  items: ContractOnboardingItem[];
  members: { id: string; name: string }[];
  today: string;
}) {
  if (contracts.length === 0) {
    return (
      <section className="liquid-surface p-10 text-center text-sm text-ink-500">
        対象の契約がありません
      </section>
    );
  }

  return (
    <section className="space-y-5">
      {contracts.map((contract) => {
        const p = productByCode[contract.product];
        const template = productOnboardingTemplates[contract.product];
        const contractItems = items.filter((i) => i.contractId === contract.id);
        // 進捗集計
        let done = 0;
        let overdue = 0;
        let total = 0;
        for (const i of contractItems) {
          if (i.status === "not_applicable") continue;
          total++;
          if (i.status === "done") done++;
          if (
            (i.status === "todo" || i.status === "doing" || i.status === "overdue") &&
            i.dueDate &&
            i.dueDate < today
          ) {
            overdue++;
          }
        }

        return (
          <div key={contract.id} className="liquid-surface p-5 space-y-4">
            {/* ヘッダ */}
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
                  <span className="text-[11px] text-ink-500">
                    {cycleLabel(contract.product, contract.cycleNumber)}
                  </span>
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
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-500">
                  <span>
                    開始 <span className="text-ink-700">{contract.startDate.replace(/-/g, "/")}</span>
                  </span>
                  <span>
                    担当 <span className="text-ink-700">{contract.ownerName}</span>
                  </span>
                  <span>
                    参加者 <span className="text-ink-700">{contract.participants}名</span>
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[11px] text-ink-500">全体</div>
                <div className="text-base font-bold text-ink-900 tabular-nums">
                  {done}/{total}
                </div>
                {overdue > 0 && (
                  <div className="text-[11px] text-rose-500">期日超過 {overdue}件</div>
                )}
              </div>
            </div>

            {/* 進捗バー */}
            <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${total > 0 ? (done / total) * 100 : 0}%`,
                  background: p.accent
                }}
              />
            </div>

            {/* /onboarding/[contractId] と同じチェックリスト UI */}
            <ChecklistView
              contractId={contract.id}
              template={template}
              items={contractItems}
              accent={p.accent}
              users={members}
              today={today}
            />
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

/* ──────────────── 企業ジャーニー (会社単位・永続) ──────────────── */
function CompanyJourneySection({
  companyId,
  companyJourney,
  stageDefs,
  suggestion
}: {
  companyId: string;
  companyJourney: CompanyJourney | null;
  stageDefs: JourneyStageDefinition[];
  suggestion?: JourneySuggestion;
}) {
  if (stageDefs.length === 0) return null;
  return (
    <JourneyStageBar
      title="企業ジャーニー"
      subtitle="この企業のNEOへの関わり方 (会社単位・永続)"
      customizeHref="/settings/journey-stages?type=company"
      stages={stageDefs}
      currentStageKey={companyJourney?.currentStageKey ?? null}
      stageEnteredAt={companyJourney?.stageEnteredAt}
      suggestion={suggestion}
      warnOnRegression={true}
      onChangeStage={async (input) => {
        const r = await setCompanyJourneyStageAction({
          companyId,
          toStageKey: input.toStageKey,
          acknowledgeRegression: input.acknowledgeRegression,
          note: input.note
        });
        return r;
      }}
    />
  );
}

/* ──────────────── 事業ジャーニー (商材×期 単位) ──────────────── */
function BusinessJourneyGroupSection({
  companyId,
  contracts,
  businessJourneys,
  stageDefs,
  suggestions,
  checkpointStatusesByContract
}: {
  companyId: string;
  contracts: ActiveContract[];
  businessJourneys: BusinessJourney[];
  stageDefs: JourneyStageDefinition[];
  suggestions: Record<string, JourneySuggestion>;
  checkpointStatusesByContract: Record<string, JourneyCheckpointStatus[]>;
}) {
  if (contracts.length === 0 || stageDefs.length === 0) return null;
  return (
    <div className="liquid-surface p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-sm font-semibold text-ink-700">事業ジャーニー</div>
          <div className="mt-0.5 text-[11px] text-ink-500">
            事業 (商材×期) ごとの契約更新+アップセルへの進捗
          </div>
        </div>
        <a
          href="/settings/journey-stages?type=business"
          className="text-[11px] text-ink-500 hover:text-ink-700 underline-offset-2 hover:underline"
        >
          ステージをカスタム
        </a>
      </div>
      <div className="space-y-4">
        {contracts.map((c) => {
          const bj = businessJourneys.find((b) => b.contractId === c.id) ?? null;
          return (
            <BusinessJourneyCard
              key={c.id}
              contract={c}
              businessJourney={bj}
              stageDefs={stageDefs}
              suggestion={suggestions[c.id]}
              checkpointStatuses={checkpointStatusesByContract[c.id] ?? []}
              companyId={companyId}
            />
          );
        })}
      </div>
    </div>
  );
}

/* 個別 契約カード — 内諾遷移時に NextCycleModal をインターセプト */
function BusinessJourneyCard({
  contract,
  businessJourney,
  stageDefs,
  suggestion,
  checkpointStatuses,
  companyId
}: {
  contract: ActiveContract;
  businessJourney: BusinessJourney | null;
  stageDefs: JourneyStageDefinition[];
  suggestion?: JourneySuggestion;
  checkpointStatuses: JourneyCheckpointStatus[];
  companyId: string;
}) {
  const product = productByCode[contract.product];
  const cycle = cycleLabel(contract.product, contract.cycleNumber);

  // 次期作成モーダルの state
  const [nextCycleDefaults, setNextCycleDefaults] = useState<NextCycleDefaults | null>(
    null
  );

  const buildNextCycleDefaults = (): NextCycleDefaults => {
    // 既存契約終了日 + 1日 を次期開始日のデフォルトに
    const start = contract.endDate
      ? new Date(new Date(contract.endDate).getTime() + 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    // 次期終了日 = 次期開始 + (現契約期間と同じ日数)
    let endStr = "";
    if (contract.startDate && contract.endDate) {
      const span =
        new Date(contract.endDate).getTime() -
        new Date(contract.startDate).getTime();
      const e = new Date(new Date(start).getTime() + span);
      endStr = e.toISOString().slice(0, 10);
    }
    return {
      currentContractId: contract.id,
      companyId,
      productCode: contract.product,
      productLabel: product.name,
      defaultStartDate: start,
      defaultEndDate: endStr,
      defaultMrr: contract.mrr ?? 0,
      defaultOwnerName: contract.ownerName ?? "",
      defaultParticipants: contract.participants ?? 0,
      defaultCourseKey: contract.courseKey ?? "",
      nextCycleNumber: contract.cycleNumber + 1,
      cycleUnit: product.cycleUnit
    };
  };

  return (
    <div className="rounded-xl border border-ink-100 bg-white p-3">
      <div className="flex items-center gap-2 mb-2">
        <ProductBadge code={contract.product} size="sm" />
        <span className="text-[12px] font-semibold text-ink-800">
          {product.name}
        </span>
        <span className="text-[11px] text-ink-500">
          {contract.courseKey ? courseShortName(contract.product, contract.courseKey) : "-"}
        </span>
        <span className="ml-1 px-1.5 py-0.5 rounded bg-ink-50 text-[10px] text-ink-700 border border-ink-100">
          {cycle}
        </span>
        {contract.endDate && (
          <span className="ml-auto text-[10px] text-ink-500">
            契約終了 {contract.endDate}
          </span>
        )}
        <BusinessLifecyclePanel
          contractId={contract.id}
          companyId={companyId}
          currentState={businessJourney?.lifecycleState ?? "active"}
        />
      </div>
      <JourneyStageBar
        title=""
        customizeHref="/settings/journey-stages?type=business"
        stages={stageDefs}
        currentStageKey={businessJourney?.currentStageKey ?? null}
        stageEnteredAt={businessJourney?.stageEnteredAt}
        suggestion={suggestion}
        warnOnRegression={false}
        onChangeStage={async (input) => {
          // 「8.内諾 (consent)」への遷移はモーダルでインターセプト
          if (input.toStageKey === "consent") {
            setNextCycleDefaults(buildNextCycleDefaults());
            // ステージ自体の変更はモーダル確定時に createNextCycleAction が実施
            return { ok: true };
          }
          const r = await setBusinessJourneyStageAction({
            contractId: contract.id,
            companyId,
            toStageKey: input.toStageKey,
            acknowledgeRegression: input.acknowledgeRegression,
            note: input.note
          });
          return r;
        }}
      />
      <div className="mt-3">
        <JourneyCheckpointPanel
          journeyType="business"
          subjectId={contract.id}
          companyId={companyId}
          stage={
            stageDefs.find((s) => s.stageKey === businessJourney?.currentStageKey) ??
            null
          }
          statuses={checkpointStatuses}
        />
      </div>

      <NextCycleModal
        open={nextCycleDefaults !== null}
        defaults={nextCycleDefaults}
        onClose={() => setNextCycleDefaults(null)}
      />
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
//   契約中の事業ごとに右上ボタンで切り替え。
//   各事業の事業ジャーニー + 既存の Cycle ブロック + 解約モーダル。
function ContractsTab({
  allCycles,
  successPlans,
  businessJourneys,
  businessStageDefs,
  businessSuggestions,
  checkpointStatusesByContract,
  companyId,
  canManageContracts = false,
  churnSignalsByContract,
  vocItemsByCompany
}: {
  allCycles: ActiveContract[];
  successPlans: SuccessPlan[];
  businessJourneys: BusinessJourney[];
  businessStageDefs: JourneyStageDefinition[];
  businessSuggestions: Record<string, JourneySuggestion>;
  checkpointStatusesByContract: Record<string, JourneyCheckpointStatus[]>;
  companyId: string;
  canManageContracts?: boolean;
  churnSignalsByContract: Record<string, ChurnSignalRecord[]>;
  vocItemsByCompany: VocItemRecord[];
}) {
  const cycleIds = new Set(allCycles.map((c) => c.id));
  const [records, setRecords] = useState<ChurnRecord[]>(
    initialChurnRecords.filter((r) => cycleIds.has(r.contractId))
  );
  const [churnTarget, setChurnTarget] = useState<ActiveContract | null>(null);
  // 契約 CRUD モーダルの開閉状態
  const [contractFormMode, setContractFormMode] = useState<"create" | "edit" | null>(null);
  const [editingContract, setEditingContract] = useState<ActiveContract | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ActiveContract | null>(null);

  // 研修ごとにグルーピング
  const byProduct = new Map<ProductCode, ActiveContract[]>();
  allCycles.forEach((c) => {
    const arr = byProduct.get(c.product) ?? [];
    arr.push(c);
    byProduct.set(c.product, arr);
  });

  const productCodes = Array.from(byProduct.keys());
  const [selectedCode, setSelectedCode] = useState<ProductCode | null>(
    productCodes[0] ?? null
  );

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

  const activeCode = selectedCode ?? productCodes[0];
  const cycles = (byProduct.get(activeCode) ?? []).slice().sort(
    (a, b) => a.cycleNumber - b.cycleNumber
  );
  const current =
    cycles.find((c) => c.status !== "renewed" && c.status !== "churned") ??
    cycles[cycles.length - 1];
  const currentPlan = successPlans.find((sp) => sp.contractId === current.id);

  // この事業の現行サイクルだけ事業ジャーニーカードを出す（過去サイクルは履歴セクションに）
  const journeyContracts = cycles.filter(
    (c) => c.status !== "renewed" && c.status !== "churned"
  );

  return (
    <section className="space-y-4">
      {/* 契約管理 (CRUD) — role_permissions.contract_manage で許可されている時だけ表示 */}
      {canManageContracts && (
        <div className="liquid-surface p-4 flex items-center justify-between gap-3">
          <div className="text-xs text-ink-500">
            <span className="text-ink-700 font-medium">契約管理</span> ・ 新規契約の追加 / 既存契約の編集 / 解約
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingContract(null);
              setContractFormMode("create");
            }}
            className="text-xs px-3 py-1.5 rounded-md bg-ink-900 text-white hover:bg-ink-800"
          >
            ＋ 新規契約を追加
          </button>
        </div>
      )}

      {/* 事業切替 */}
      {productCodes.length > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-ink-500">
            契約中の事業を切替
          </div>
          <ProductTabs
            codes={productCodes}
            selected={activeCode}
            onChange={setSelectedCode}
          />
        </div>
      )}

      {/* 事業ジャーニー (現行契約のみ) */}
      <BusinessJourneyGroupSection
        companyId={companyId}
        contracts={journeyContracts}
        businessJourneys={businessJourneys}
        stageDefs={businessStageDefs}
        suggestions={businessSuggestions}
        checkpointStatusesByContract={checkpointStatusesByContract}
      />

      {/* 既存: 事業内サイクル + 解約モーダル */}
      <ProductCyclesBlock
        key={activeCode}
        code={activeCode}
        cycles={cycles}
        current={current}
        plan={currentPlan}
        churnRecords={records}
        onChurnClick={(c) => setChurnTarget(c)}
        churnSignals={churnSignalsByContract[current.id] ?? []}
        vocItems={vocItemsByCompany}
      />

      {/* 契約管理: 各契約の編集・解約 (role_permissions.contract_manage 必須) */}
      {canManageContracts && (
        <div className="liquid-surface p-4">
          <div className="text-xs text-ink-700 font-medium mb-3">
            この事業の全契約 (編集・解約)
          </div>
          <div className="space-y-2">
            {cycles.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-white border border-ink-100 text-xs"
              >
                <div className="min-w-0">
                  <span className="text-ink-900 font-medium">第{c.cycleNumber}期</span>
                  <span className="ml-2 text-ink-500">
                    {c.startDate}
                    {c.endDate ? ` 〜 ${c.endDate}` : ""}
                  </span>
                  <span className="ml-2 text-ink-500">担当: {c.ownerName}</span>
                  <span
                    className={[
                      "ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] border",
                      c.status === "churned"
                        ? "border-rose-200 text-rose-700 bg-rose-50"
                        : c.status === "renewed"
                          ? "border-ink-200 text-ink-500 bg-ink-50"
                          : "border-emerald-200 text-emerald-700 bg-emerald-50"
                    ].join(" ")}
                  >
                    {c.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingContract(c);
                      setContractFormMode("edit");
                    }}
                    className="text-ink-700 px-2 py-1 rounded border border-ink-200 hover:bg-ink-50"
                  >
                    編集
                  </button>
                  {c.status !== "churned" && c.status !== "renewed" && (
                    <button
                      type="button"
                      onClick={() => setCancelTarget(c)}
                      className="text-rose-600 px-2 py-1 rounded border border-rose-200 hover:bg-rose-50"
                    >
                      解約
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 解約履歴 (この事業の) */}
      <ChurnHistorySection
        records={records.filter((r) =>
          cycles.some((c) => c.id === r.contractId)
        )}
        cycles={cycles}
      />

      {churnTarget && (
        <ChurnModal
          contract={churnTarget}
          existing={records.find((r) => r.contractId === churnTarget.id)}
          onClose={() => setChurnTarget(null)}
          onSave={handleSave}
        />
      )}

      {contractFormMode && (
        <ContractFormModal
          mode={contractFormMode}
          companyId={companyId}
          initial={editingContract ?? undefined}
          onClose={() => {
            setContractFormMode(null);
            setEditingContract(null);
          }}
        />
      )}

      {cancelTarget && (
        <CancelContractModal
          contract={cancelTarget}
          companyId={companyId}
          onClose={() => setCancelTarget(null)}
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
  // アカデミア解約時のみ「評議会単独契約に切替」オプションを表示
  const isAcademia = contract.product === "academia";
  const [switchToHyogikai, setSwitchToHyogikai] = useState<boolean>(false);
  const [hyogikaiStart, setHyogikaiStart] = useState<string>(churnedAt);
  const [hyogikaiEnd, setHyogikaiEnd] = useState<string>(() => {
    const d = new Date(churnedAt);
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [hyogikaiMrr, setHyogikaiMrr] = useState<number>(150_000);
  const [switchPending, setSwitchPending] = useState<boolean>(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAcademia && switchToHyogikai) {
      setSwitchPending(true);
      setSwitchError(null);
      try {
        const { switchAcademiaToHyogikaiAction } = await import(
          "./hyogikai-switch-actions"
        );
        const r = await switchAcademiaToHyogikaiAction({
          academiaContractId: contract.id,
          companyId: contract.companyId,
          newStartDate: hyogikaiStart,
          newEndDate: hyogikaiEnd,
          mrr: hyogikaiMrr,
          ownerName: contract.ownerName,
          participants: contract.participants
        });
        if (!r.ok) {
          setSwitchError(r.message);
          setSwitchPending(false);
          return;
        }
      } catch (err) {
        setSwitchError((err as Error).message);
        setSwitchPending(false);
        return;
      }
      setSwitchPending(false);
    }
    // ⚠️ 通常の解約レコード保存
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

            {isAcademia && (
              <div className="pt-3 border-t border-ink-100">
                <label className="inline-flex items-start gap-2 text-body text-ink-700 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={switchToHyogikai}
                    onChange={(e) => setSwitchToHyogikai(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded accent-violet-600"
                  />
                  <span>
                    <span className="font-medium">解約後に評議会単独契約へ切替</span>
                    <span className="text-caption text-ink-500 block">
                      アカデミア期間中も評議会に参加していたため、会員資格は継続扱い。新規契約として作成します。
                    </span>
                  </span>
                </label>
                {switchToHyogikai && (
                  <div className="ml-6 space-y-2 rounded-lg bg-violet-50/50 border border-violet-200 p-3">
                    <Field label="評議会単独契約 開始日" required>
                      <input
                        type="date"
                        required
                        value={hyogikaiStart}
                        onChange={(e) => setHyogikaiStart(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm bg-white"
                      />
                    </Field>
                    <Field label="評議会単独契約 終了日" required>
                      <input
                        type="date"
                        required
                        value={hyogikaiEnd}
                        onChange={(e) => setHyogikaiEnd(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm bg-white"
                      />
                    </Field>
                    <Field label="評議会単独 MRR (円)">
                      <input
                        type="number"
                        min={0}
                        value={hyogikaiMrr}
                        onChange={(e) => setHyogikaiMrr(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm bg-white"
                      />
                    </Field>
                    {switchError && (
                      <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded p-2">
                        {switchError}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

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
              disabled={switchPending}
              className="px-4 py-2 rounded-full bg-ink-900 text-white text-sm hover:opacity-90 disabled:opacity-50"
            >
              {switchPending ? "切替処理中..." : "保存"}
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
  onChurnClick,
  churnSignals,
  vocItems
}: {
  code: ProductCode;
  cycles: ActiveContract[];
  current: ActiveContract;
  plan?: SuccessPlan;
  churnRecords: ChurnRecord[];
  onChurnClick: (c: ActiveContract) => void;
  churnSignals: ChurnSignalRecord[];
  vocItems: VocItemRecord[];
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
      <CurrentCyclePanel
        contract={current}
        plan={plan}
        churnSignals={churnSignals}
        vocItems={vocItems}
      />
    </div>
  );
}

function CurrentCyclePanel({
  contract,
  plan,
  churnSignals,
  vocItems
}: {
  contract: ActiveContract;
  plan?: SuccessPlan;
  churnSignals: ChurnSignalRecord[];
  vocItems: VocItemRecord[];
}) {
  const p = productByCode[contract.product];
  const endDate = contract.endDate;
  const daysToEnd = endDate
    ? Math.ceil((new Date(endDate).getTime() - new Date("2026-04-24").getTime()) / (1000 * 60 * 60 * 24))
    : null;
  // 旧 generateRenewalMilestones は廃止。期日付きToDoは事業別ToDoに統合済み
  const renewalColor: Record<"green" | "yellow" | "red", string> = {
    green: "#3B82F6",
    yellow: "#F59E0B",
    red: "#EF4444"
  };
  const { snapshots } = useHealthSnapshots(contract.id);
  // 最新 snapshot があればその factors から breakdown を再計算 (実シグナル由来)。
  // 無ければ Contract から推定 (Phase A 時の暫定挙動 / mock onboarding シード由来)。
  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const breakdown = latestSnapshot
    ? computeHealthScore(latestSnapshot.factors, latestSnapshot.computedAt)
    : computeFromContract(contract);
  const healthColor = breakdown.color;
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
        <ContractChurnSignals signals={churnSignals} />
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
        <CompanyVocList items={vocItems} />
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

      {/* 中央: 更新タスクは事業別ToDo (program_company_tasks) に統合済み。
          ステージ進捗は事業ジャーニー (BusinessJourneyCard) のチェックポイントで管理 */}
      <div className="space-y-3 lg:col-span-2">
        <div className="text-caption font-semibold text-neutral-700">更新タスク</div>
        <div className="text-caption text-neutral-500">
          更新フェーズの期日付きToDoは「事業別ToDo」へ統合されました。
          ステージ進捗は下部の事業ジャーニーのチェックポイントを参照してください。
        </div>
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
function MailTab({
  companyId,
  emailThreads,
  emailMessages
}: {
  companyId: string;
  emailThreads: EmailThread[];
  emailMessages: EmailMessage[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const threads = emailThreads
    .filter((t) => t.companyId === companyId)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

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
          // 旧 mock 由来の slaDeadline は repo モデルに無いため SLA 警告は当面無効
          const overdue = false;
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
                    担当: {t.assigneeUserId ?? "未割当"} ・ 最終更新: {t.updatedAt}
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
                        <span className="font-medium text-ink-700">{m.senderEmail}</span>
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

// =====================================================================
// 担当者の組織図（樹形図）
// scope（NEO全体 / 各事業）× level（役員/決裁者/責任者/担当者）で配置。
// 兼務は同一人物が複数 scope/level に出現する形で自然表現する。
// =====================================================================

const ROLE_LEVEL_META: Record<ContactRoleLevel, { label: string; tone: string }> = {
  executive: { label: "担当役員", tone: "bg-purple-50 border-purple-200 text-purple-800" },
  approver:  { label: "決裁者",   tone: "bg-rose-50 border-rose-200 text-rose-800" },
  lead:      { label: "担当責任者", tone: "bg-amber-50 border-amber-200 text-amber-800" },
  member:    { label: "担当者",   tone: "bg-sky-50 border-sky-200 text-sky-800" }
};
const ROLE_LEVEL_ORDER: ContactRoleLevel[] = ["executive", "approver", "lead", "member"];

const FUNCTION_META: Record<ContactFunction, { label: string; tone: string }> = {
  contract:   { label: "契約",   tone: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  pr:         { label: "広報",   tone: "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700" },
  invitation: { label: "招待",   tone: "bg-cyan-50 border-cyan-200 text-cyan-700" },
  liaison:    { label: "連絡",   tone: "bg-slate-50 border-slate-200 text-slate-700" }
};

const COMMUNITY_META: Record<ContactCommunityTier, { label: string; tone: string; dot: string }> = {
  core:    { label: "コア",     tone: "bg-amber-100 text-amber-900 border-amber-300",   dot: "#D97706" },
  active:  { label: "アクティブ", tone: "bg-sky-100 text-sky-800 border-sky-200",         dot: "#0EA5E9" },
  casual:  { label: "カジュアル", tone: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "#10B981" },
  at_risk: { label: "離脱危機",   tone: "bg-rose-100 text-rose-800 border-rose-200",       dot: "#E11D48" }
};

const PERSONALITY_META: Record<ContactPersonality, { label: string; tone: string }> = {
  playful_leader:  { label: "Playfulリーダー", tone: "bg-violet-50 text-violet-800 border-violet-200" },
  playful_thinker: { label: "Playfulシンカー", tone: "bg-indigo-50 text-indigo-800 border-indigo-200" },
  narepan:         { label: "ナレパン",        tone: "bg-orange-50 text-orange-800 border-orange-200" },
  gardon:          { label: "ガードン",        tone: "bg-stone-100 text-stone-800 border-stone-300" }
};

function FunctionBadge({ fn }: { fn: ContactFunction }) {
  const m = FUNCTION_META[fn];
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${m.tone}`}>
      {m.label}
    </span>
  );
}

function scopeLabel(scope: ContactRoleScope): string {
  if (scope === "overall") return "NEO全体";
  return productByCode[scope]?.shortName ?? scope;
}

function scopeAccent(scope: ContactRoleScope): string {
  if (scope === "overall") return "#475569";
  return productByCode[scope]?.accent ?? "#475569";
}

function ContactOrgTree({
  companyId,
  contacts,
  allCycles,
  onUpdate,
  initialParticipants
}: {
  companyId: string;
  contacts: Contact[];
  allCycles: ActiveContract[];
  onUpdate: (next: Contact) => void;
  initialParticipants?: Participant[];
}) {
  const [editing, setEditing] = useState<Contact | null>(null);
  // 参加者状態 (組織図タブ内に統合表示)
  // initialParticipants が渡されていれば supabase 由来データを使う、無ければ mock fallback
  const [participantList, setParticipantList] = useState<Participant[]>(() =>
    initialParticipants
      ? initialParticipants
      : allParticipants.filter((p) => p.companyId === companyId)
  );
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(
    null
  );
  const [addingParticipant, setAddingParticipant] = useState(false);
  const isParticipantEmailDuplicate = (email: string, excludeId?: string) => {
    const norm = email.trim().toLowerCase();
    if (!norm) return false;
    return participantList.some(
      (p) => p.id !== excludeId && p.email.trim().toLowerCase() === norm
    );
  };
  const updateParticipant = (next: Participant) =>
    setParticipantList((prev) => prev.map((p) => (p.id === next.id ? next : p)));
  const contactByIdMap = new Map(contacts.map((c) => [c.id, c]));
  // 出現するすべての scope を抽出。担当者ゼロでも参加者の追加ができるよう、契約商材も候補に含める
  const scopes: ContactRoleScope[] = [];
  const seen = new Set<ContactRoleScope>();
  const pushScope = (s: ContactRoleScope) => {
    if (!seen.has(s)) {
      seen.add(s);
      scopes.push(s);
    }
  };
  for (const c of contacts) {
    for (const r of c.roles ?? []) pushScope(r.scope);
  }
  for (const cycle of allCycles) {
    pushScope(cycle.product as ContactRoleScope);
  }
  scopes.sort((a, b) => (a === "overall" ? -1 : b === "overall" ? 1 : 0));

  // 事業フィルタ (overall=全社) と期フィルタの状態
  const [selectedScope, setSelectedScope] = useState<ContactRoleScope>(
    scopes[0] ?? "overall"
  );
  // 選択 scope が "overall" 以外の場合は商材コードと一致 → 該当商材の期一覧
  const cyclesForSelected =
    selectedScope === "overall"
      ? []
      : allCycles
          .filter((c) => (c.product as string) === (selectedScope as string))
          .sort((a, b) => a.cycleNumber - b.cycleNumber);
  // 選択中の期キー: "common" = 全期共通, それ以外は ActiveContract.id
  const [selectedTermKey, setSelectedTermKey] = useState<string>(
    cyclesForSelected[0]?.id ?? "common"
  );
  // scope 切替時に期もリセット (該当事業に期があれば最新期、無ければ全期共通)
  useEffect(() => {
    setSelectedTermKey(cyclesForSelected[0]?.id ?? "common");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScope]);

  // 選択期に対応する cycleNumber。"common" or overall は undefined。
  const activeCycleNo: number | undefined =
    selectedTermKey === "common" || selectedScope === "overall"
      ? undefined
      : cyclesForSelected.find((c) => c.id === selectedTermKey)?.cycleNumber;
  // 参加者セクション (期に紐づく) の互換用エイリアス。全期共通選択時は undefined。
  const selectedContractId: string | undefined =
    selectedTermKey === "common" ? undefined : selectedTermKey;

  // ロールが「現在の scope × 期」に表示されるべきか
  // - scope 不一致 → false
  // - cycleNo 未指定 (全期共通) → 常に true
  // - cycleNo 一致 → true
  const isRoleVisibleHere = (r: ContactRole, scope: ContactRoleScope) =>
    r.scope === scope &&
    (r.cycleNo == null || r.cycleNo === activeCycleNo);

  if (scopes.length === 0) {
    return (
      <div className="text-xs text-ink-500">
        担当ロール未登録です（一覧表示で確認してください）
      </div>
    );
  }

  // 選択 scope×期 に該当する役割を持つ担当者だけを表示。
  const filteredContacts = contacts.filter((c) =>
    (c.roles ?? []).some((r) => isRoleVisibleHere(r, selectedScope))
  );

  // 各 contact の scope/level 一覧 (現在 scope×期 に絞ったものを表示)
  const rolesByContact = (c: Contact) =>
    (c.roles ?? [])
      .filter((r) => isRoleVisibleHere(r, selectedScope))
      .map((r) => ({ scope: r.scope, level: r.level }));

  return (
    <div className="space-y-3">
      {/* 事業 (scope) + 期 切替バー — 参加者タブと同じ操作感に揃える */}
      <div className="liquid-surface p-3 space-y-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-ink-500 mr-1">事業</span>
          {scopes.map((scope) => {
            const accent = scopeAccent(scope);
            const active = scope === selectedScope;
            // 担当者数バッジ: 当該 scope に属するロールがあるかで集計。
            // 期未確定の段階では cycleNo を考慮せず scope のみで数える (UI 統一感を優先)。
            const count = contacts.filter((c) =>
              (c.roles ?? []).some((r) => r.scope === scope)
            ).length;
            return (
              <button
                key={scope}
                type="button"
                onClick={() => setSelectedScope(scope)}
                className={[
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition border",
                  active
                    ? "bg-ink-900 text-white border-ink-900"
                    : "bg-white border-ink-200 text-ink-700 hover:bg-ink-50"
                ].join(" ")}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ background: accent }}
                />
                {scopeLabel(scope)}
                <span className="text-[10px] opacity-70 tabular-nums">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 期ボタン — 商材選択時のみ表示。「全期共通」+ 各期で組織図メンバーを切替える。 */}
        {selectedScope !== "overall" && cyclesForSelected.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-ink-500 mr-1">期</span>
            {/* 全期共通: cycleNo 未指定のロールのみ表示 */}
            {(() => {
              const active = selectedTermKey === "common";
              return (
                <button
                  key="common"
                  type="button"
                  onClick={() => setSelectedTermKey("common")}
                  className={[
                    "px-2.5 py-1 rounded-full text-xs transition border",
                    active
                      ? "bg-ink-900 text-white border-ink-900"
                      : "bg-white border-ink-200 text-ink-700 hover:bg-ink-50"
                  ].join(" ")}
                  title="期に紐づかない全期共通の担当者のみを表示"
                >
                  全期共通
                </button>
              );
            })()}
            {cyclesForSelected.map((c) => {
              const active = c.id === selectedTermKey;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedTermKey(c.id)}
                  className={[
                    "px-2.5 py-1 rounded-full text-xs transition border",
                    active
                      ? "bg-ink-900 text-white border-ink-900"
                      : "bg-white border-ink-200 text-ink-700 hover:bg-ink-50"
                  ].join(" ")}
                  title={`${c.startDate} 〜 ${c.endDate ?? ""}`}
                >
                  {cycleLabel(c.product, c.cycleNumber)}
                  {c.status === "renewed" && (
                    <span className="ml-1 text-[9px] opacity-70">(終了)</span>
                  )}
                  {c.status === "churned" && (
                    <span className="ml-1 text-[9px] opacity-70">(解約)</span>
                  )}
                </button>
              );
            })}
            <span className="ml-auto text-[10px] text-ink-400">
              全期共通ロールはどの期でも常に表示
            </span>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-ink-100 bg-white overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-ink-50/60 text-ink-600">
            <tr>
              <th className="text-left font-medium px-3 py-2 whitespace-nowrap">
                氏名
              </th>
              <th className="text-left font-medium px-3 py-2 whitespace-nowrap">
                所属 / 役職
              </th>
              <th className="text-left font-medium px-3 py-2 whitespace-nowrap">
                役割
              </th>
              <th className="text-left font-medium px-3 py-2 whitespace-nowrap">
                関与度
              </th>
              <th className="text-left font-medium px-3 py-2 whitespace-nowrap">
                パーソナリティ
              </th>
              <th className="text-left font-medium px-3 py-2 whitespace-nowrap">
                機能
              </th>
              <th className="text-left font-medium px-3 py-2 max-w-[280px]">
                備考
              </th>
              <th className="text-right font-medium px-3 py-2 w-24 whitespace-nowrap">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {filteredContacts.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-ink-400 py-6">
                  この事業に紐づく担当者は登録されていません
                </td>
              </tr>
            )}
            {filteredContacts.map((c) => {
              const roles = rolesByContact(c);
              return (
                <tr key={c.id} className="hover:bg-ink-50/40 align-top">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setEditing(c)}
                        className="font-medium text-ink-900 hover:underline"
                        title="クリックで編集"
                      >
                        {c.name}
                      </button>
                      {c.isPrimary && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                          主担当
                        </span>
                      )}
                    </div>
                    {c.email && (
                      <div className="text-[10px] text-ink-500 truncate">
                        {c.email}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-ink-700">
                    <div>{c.department || "—"}</div>
                    <div className="text-[10px] text-ink-500">{c.title}</div>
                  </td>
                  <td className="px-3 py-2">
                    {roles.length === 0 ? (
                      <span className="text-ink-400">—</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {roles.map((r, i) => {
                          const accent = scopeAccent(r.scope);
                          const meta = ROLE_LEVEL_META[r.level];
                          return (
                            <li
                              key={`${r.scope}-${r.level}-${i}`}
                              className="flex items-center gap-1.5"
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ background: accent }}
                              />
                              <span
                                className="text-[10px]"
                                style={{ color: accent }}
                              >
                                {scopeLabel(r.scope)}
                              </span>
                              <span
                                className={`text-[10px] px-1 py-0 rounded border ${meta.tone}`}
                              >
                                {meta.label}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {c.community ? (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full border whitespace-nowrap ${COMMUNITY_META[c.community].tone}`}
                      >
                        {COMMUNITY_META[c.community].label}
                      </span>
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {(c.personality ?? []).length === 0 ? (
                      <span className="text-ink-400">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {(c.personality ?? []).map((p) => (
                          <span
                            key={p}
                            className={`text-[10px] px-1.5 py-0.5 rounded-full border ${PERSONALITY_META[p].tone}`}
                          >
                            {PERSONALITY_META[p].label}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {(c.functions ?? []).length === 0 ? (
                      <span className="text-ink-400">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {(c.functions ?? []).map((f) => (
                          <FunctionBadge key={f} fn={f} />
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-ink-700 max-w-[280px]">
                    {c.note ? (
                      <div className="line-clamp-2 whitespace-pre-wrap">
                        {c.note}
                      </div>
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <Link
                        href={`/inbox?contact=${encodeURIComponent(c.email)}`}
                        className="text-[10px] text-ink-500 hover:text-brand-blue"
                        title={`${c.email} とのメールを表示`}
                      >
                        ✉
                      </Link>
                      <button
                        type="button"
                        onClick={() => setEditing(c)}
                        className="text-[11px] text-ink-500 hover:text-ink-700"
                        title="編集"
                      >
                        ✎ 編集
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 参加者セクション (商材+期 が選択されているときのみ表示) */}
      {selectedScope !== "overall" && selectedContractId && (() => {
        const contract = cyclesForSelected.find(
          (c) => c.id === selectedContractId
        );
        if (!contract) return null;
        const peopleForCycle = participantList.filter(
          (p) => p.contractId === selectedContractId
        );
        const termLabel = participantTermByProduct[contract.product] ?? "参加者";
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="text-xs font-semibold text-ink-700">
                {termLabel} ({peopleForCycle.length}名)
              </div>
              <button
                type="button"
                onClick={() => setAddingParticipant(true)}
                className="px-3 py-1 rounded-full bg-ink-900 text-white text-xs hover:bg-ink-700"
              >
                + 追加
              </button>
            </div>
            {peopleForCycle.length === 0 ? (
              <div className="rounded-xl border border-ink-100 bg-white p-6 text-center text-xs text-ink-400">
                この期の{termLabel}は登録されていません
              </div>
            ) : (
              <ParticipantContractList
                contractId={selectedContractId}
                contract={contract}
                people={peopleForCycle}
                contactById={contactByIdMap}
                onEdit={setEditingParticipant}
                termLabel={termLabel}
              />
            )}
          </div>
        );
      })()}

      {editing && (
        <ContactEditDialog
          contact={editing}
          availableScopes={scopes}
          allCycles={allCycles}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            onUpdate(next);
            setEditing(null);
          }}
        />
      )}

      {editingParticipant && (
        <ParticipantEditDialog
          participant={editingParticipant}
          productCode={
            allCycles.find((c) => c.id === editingParticipant.contractId)?.product
          }
          contacts={contacts}
          isEmailDuplicate={(email) =>
            isParticipantEmailDuplicate(email, editingParticipant.id)
          }
          onClose={() => setEditingParticipant(null)}
          onSave={(next) => {
            if (isParticipantEmailDuplicate(next.email, next.id)) return;
            updateParticipant(next);
            setEditingParticipant(null);
          }}
        />
      )}

      {addingParticipant && selectedContractId && selectedScope !== "overall" && (() => {
        const contract = cyclesForSelected.find(
          (c) => c.id === selectedContractId
        );
        if (!contract) return null;
        const termLabel = participantTermByProduct[contract.product] ?? "参加者";
        return (
          <ParticipantAddDialog
            companyId={companyId}
            contractId={selectedContractId}
            productCode={contract.product}
            termLabel={termLabel}
            contacts={contacts}
            isEmailDuplicate={(email) => isParticipantEmailDuplicate(email)}
            onClose={() => setAddingParticipant(false)}
            onSave={(next) => {
              setParticipantList((prev) => [...prev, next]);
              setAddingParticipant(false);
            }}
          />
        );
      })()}
    </div>
  );
}

/* ──────────────── 参加者タブ ────────────────
   契約 (=期/サイクル) ごとに参加者をグルーピングして表示。
   担当者と同等のタグ (関与度・性質・機能) と備考を編集できる。
   状態は本コンポーネント内 (useState) のみで保持。永続化は将来の participantRepo に委譲予定。 */
function ParticipantsTab({
  companyId,
  allCycles,
  contacts
}: {
  companyId: string;
  allCycles: ActiveContract[];
  contacts: Contact[];
}) {
  const initial = allParticipants.filter((p) => p.companyId === companyId);
  const [list, setList] = useState<Participant[]>(initial);
  const [editing, setEditing] = useState<Participant | null>(null);
  const contactById = new Map(contacts.map((c) => [c.id, c]));

  const cycleById = new Map(allCycles.map((c) => [c.id, c]));

  // 参加者がひもづく契約を商材→期 でグルーピング (allCycles 由来のみ。未知 contractId は "other" 商材として扱う)
  const productSet = new Set<ProductCode>();
  const contractsByProduct = new Map<ProductCode, ActiveContract[]>();
  for (const p of list) {
    const c = cycleById.get(p.contractId);
    if (!c) continue;
    productSet.add(c.product);
    const arr = contractsByProduct.get(c.product) ?? [];
    if (!arr.find((x) => x.id === c.id)) arr.push(c);
    contractsByProduct.set(c.product, arr);
  }
  // 期番号で昇順
  for (const arr of contractsByProduct.values()) {
    arr.sort((a, b) => a.cycleNumber - b.cycleNumber);
  }
  const productCodes = Array.from(productSet);

  const [selectedProduct, setSelectedProduct] = useState<ProductCode | undefined>(
    productCodes[0]
  );
  const cyclesForSelected = selectedProduct
    ? contractsByProduct.get(selectedProduct) ?? []
    : [];
  // 選択中の期 (contractId)。商材切替時にリセット
  const [selectedContractId, setSelectedContractId] = useState<string | undefined>(
    cyclesForSelected[0]?.id
  );
  // 商材選択が変わったら、選択期を当該商材の最新期に合わせる
  useEffect(() => {
    setSelectedContractId(cyclesForSelected[0]?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct]);

  const [viewMode, setViewMode] = useState<"card" | "list">("list");
  const [adding, setAdding] = useState(false);

  // メールアドレス重複チェック (大文字小文字無視。空文字 / 編集中の自分自身は除外)
  function isEmailDuplicate(email: string, excludeId?: string): boolean {
    const norm = email.trim().toLowerCase();
    if (!norm) return false;
    return list.some(
      (p) => p.id !== excludeId && p.email.trim().toLowerCase() === norm
    );
  }

  if (list.length === 0 || productCodes.length === 0) {
    return (
      <section className="liquid-surface p-10 text-center text-sm text-ink-500">
        この企業の参加者はまだ登録されていません
      </section>
    );
  }

  function updateParticipant(next: Participant) {
    setList((prev) => prev.map((p) => (p.id === next.id ? next : p)));
  }

  const selectedContract = selectedContractId
    ? cycleById.get(selectedContractId)
    : undefined;
  const selectedPeople = selectedContractId
    ? list.filter((p) => p.contractId === selectedContractId)
    : [];
  const termLabel = selectedProduct
    ? participantTermByProduct[selectedProduct]
    : "参加者";

  return (
    <section className="space-y-4">
      {/* 研修 (商材) ボタン + ビューモード */}
      <div className="liquid-surface p-3 space-y-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-ink-500 mr-1">研修</span>
          {productCodes.map((code) => {
            const p = productByCode[code];
            const active = code === selectedProduct;
            return (
              <button
                key={code}
                type="button"
                onClick={() => setSelectedProduct(code)}
                className={[
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition border",
                  active
                    ? "bg-ink-900 text-white border-ink-900"
                    : "bg-white border-ink-200 text-ink-700 hover:bg-ink-50"
                ].join(" ")}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ background: p.accent }}
                />
                {p.shortName}
                <span className="text-[10px] opacity-70 tabular-nums">
                  {(contractsByProduct.get(code) ?? []).reduce(
                    (s, c) =>
                      s +
                      list.filter((pp) => pp.contractId === c.id).length,
                    0
                  )}
                </span>
              </button>
            );
          })}
          <div className="ml-auto inline-flex items-center gap-2">
            <div className="inline-flex items-center gap-1 p-0.5 rounded-full bg-ink-50 border border-ink-100">
              {(["list", "card"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setViewMode(m)}
                  className={[
                    "px-2.5 py-0.5 rounded-full text-[11px] transition",
                    viewMode === m
                      ? "bg-white shadow-sm font-semibold text-ink-900"
                      : "text-ink-500 hover:text-ink-700"
                  ].join(" ")}
                >
                  {m === "card" ? "カード" : "一覧"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAdding(true)}
              disabled={!selectedContractId}
              className="px-3 py-1 rounded-full bg-ink-900 text-white text-xs hover:bg-ink-700 disabled:opacity-40 disabled:cursor-not-allowed"
              title={selectedContractId ? "選択中の期に追加" : "先に研修と期を選択してください"}
            >
              + 追加
            </button>
          </div>
        </div>

        {/* 期 (cycle) ボタン */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-ink-500 mr-1">期</span>
          {cyclesForSelected.length === 0 ? (
            <span className="text-[11px] text-ink-400">
              選択中の研修に紐づく期はありません
            </span>
          ) : (
            cyclesForSelected.map((c) => {
              const active = c.id === selectedContractId;
              const peopleCount = list.filter(
                (p) => p.contractId === c.id
              ).length;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedContractId(c.id)}
                  className={[
                    "px-2.5 py-1 rounded-full text-xs transition border",
                    active
                      ? "bg-ink-900 text-white border-ink-900"
                      : "bg-white border-ink-200 text-ink-700 hover:bg-ink-50"
                  ].join(" ")}
                  title={`${c.startDate} 〜 ${c.endDate ?? ""}`}
                >
                  {cycleLabel(c.product, c.cycleNumber)}
                  <span className="ml-1 text-[10px] opacity-70 tabular-nums">
                    {peopleCount}
                  </span>
                  {c.status === "renewed" && (
                    <span className="ml-1 text-[9px] opacity-70">(終了)</span>
                  )}
                  {c.status === "churned" && (
                    <span className="ml-1 text-[9px] opacity-70">(解約)</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 本体: 選択された contract の参加者を、カード or 一覧で表示 */}
      {selectedContract && selectedContractId && (
        viewMode === "card" ? (
          <ParticipantContractGroup
            contractId={selectedContractId}
            contract={selectedContract}
            people={selectedPeople}
            contactById={contactById}
            onEdit={setEditing}
            termLabel={termLabel}
          />
        ) : (
          <ParticipantContractList
            contractId={selectedContractId}
            contract={selectedContract}
            people={selectedPeople}
            contactById={contactById}
            onEdit={setEditing}
            termLabel={termLabel}
          />
        )
      )}

      {editing && (
        <ParticipantEditDialog
          participant={editing}
          productCode={cycleById.get(editing.contractId)?.product}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            // 既存編集時もメール重複ガード
            if (isEmailDuplicate(next.email, next.id)) {
              return;
            }
            updateParticipant(next);
            setEditing(null);
          }}
          isEmailDuplicate={(email) => isEmailDuplicate(email, editing.id)}
        />
      )}

      {adding && selectedContractId && selectedContract && (
        <ParticipantAddDialog
          companyId={companyId}
          contractId={selectedContractId}
          productCode={selectedContract.product}
          termLabel={termLabel}
          isEmailDuplicate={(email) => isEmailDuplicate(email)}
          onClose={() => setAdding(false)}
          onSave={(next) => {
            setList((prev) => [...prev, next]);
            setAdding(false);
          }}
        />
      )}
    </section>
  );
}

/* 契約 (=期) ごとの参加者グループ。
   - セッション (回) 別フィルタ
   - 兼任 (担当者と同一人物) バッジ表示
   - 商材ごとのカスタム属性表示 */
function ParticipantContractGroup({
  contractId,
  contract,
  people,
  contactById,
  onEdit,
  termLabel = "参加者"
}: {
  contractId: string;
  contract: ActiveContract | undefined;
  people: Participant[];
  contactById: Map<string, Contact>;
  onEdit: (p: Participant) => void;
  /** 商材ごとの呼称 (例: "アカデミア生", "評議員") */
  termLabel?: string;
}) {
  const productCode = contract?.product;
  const product = productCode ? productByCode[productCode] : undefined;
  const accent = product?.accent ?? "#94A3B8";
  const fieldSchema = productCode
    ? participantFieldSchemas[productCode] ?? []
    : [];
  const fieldLabelByKey = new Map(fieldSchema.map((f) => [f.key, f.label]));
  const fieldOptionLabel = (key: string, value: string): string => {
    const f = fieldSchema.find((x) => x.key === key);
    if (!f) return value;
    if (f.type === "select" && f.options) {
      return f.options.find((o) => o.value === value)?.label ?? value;
    }
    return value;
  };

  // 当該契約のセッション (回ごとの絞り込みに使用)
  const contractSessions = allSessionsData
    .filter((s) => s.contractId === contractId)
    .sort((a, b) => a.sessionNumber - b.sessionNumber);
  const [sessionFilter, setSessionFilter] = useState<string>("all");

  const visiblePeople =
    sessionFilter === "all"
      ? people
      : people.filter((p) => {
          const sess = contractSessions.find((s) => s.id === sessionFilter);
          return sess ? sess.expectedParticipantIds.includes(p.id) : true;
        });

  return (
    <div className="liquid-surface p-5 space-y-4">
      {/* ヘッダ */}
      <div className="flex items-center gap-2 flex-wrap">
        {productCode && <ProductBadge code={productCode} />}
        {contract && hasMultipleCourses(contract.product) && (
          <span
            className="text-[11px] font-medium px-2 py-0.5 rounded-full"
            style={{
              color: accent,
              background: `${accent}14`,
              border: `1px solid ${accent}33`
            }}
          >
            {courseShortName(contract.product, contract.courseKey)}
          </span>
        )}
        {contract && (
          <span className="text-[11px] text-ink-500">
            {cycleLabel(contract.product, contract.cycleNumber)}
          </span>
        )}
        <span className="ml-auto text-[11px] text-ink-500 tabular-nums">
          {termLabel} {visiblePeople.length}/{people.length}名
        </span>
      </div>

      {/* セッション (回) フィルタ */}
      {contractSessions.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="text-ink-500 mr-1">回:</span>
          <button
            type="button"
            onClick={() => setSessionFilter("all")}
            className={[
              "px-2 py-0.5 rounded-full border text-[11px] transition",
              sessionFilter === "all"
                ? "bg-ink-900 text-white border-ink-900"
                : "bg-white border-ink-200 text-ink-600 hover:bg-ink-50"
            ].join(" ")}
          >
            全回
          </button>
          {contractSessions.map((s) => {
            const active = sessionFilter === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSessionFilter(s.id)}
                className={[
                  "px-2 py-0.5 rounded-full border text-[11px] transition",
                  active
                    ? "bg-ink-900 text-white border-ink-900"
                    : "bg-white border-ink-200 text-ink-600 hover:bg-ink-50"
                ].join(" ")}
                title={s.title}
              >
                第{s.sessionNumber}回
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {visiblePeople.map((p) => {
          const linked = p.linkedContactId
            ? contactById.get(p.linkedContactId)
            : undefined;
          return (
            <div
              key={p.id}
              className="rounded-xl border border-ink-100 bg-white p-3"
            >
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-full bg-ink-100 flex items-center justify-center text-xs text-ink-700 shrink-0">
                  {p.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-ink-900 truncate">
                      {p.name}
                    </span>
                    {linked && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100"
                        title={`担当者${linked.name} と同一人物 (兼任)`}
                      >
                        兼任 / 担当者
                      </span>
                    )}
                    {p.continuingFromPrev && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                        継続
                      </span>
                    )}
                    {p.status === "dropped" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-100">
                        脱落
                      </span>
                    )}
                    {p.seniority && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-ink-50 border border-ink-200 text-ink-600">
                        {p.seniority === "exec"
                          ? "役員"
                          : p.seniority === "senior"
                          ? "管理職"
                          : p.seniority === "mid"
                          ? "中堅"
                          : "若手"}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-ink-500 truncate">
                    {[p.department, p.title ?? p.role]
                      .filter(Boolean)
                      .join(" ／ ") || "—"}
                  </div>
                  {p.email && (
                    <div className="mt-0.5 text-[11px] text-ink-500 truncate">
                      {p.email}
                    </div>
                  )}
                  {(p.community ||
                    (p.personality ?? []).length > 0 ||
                    (p.functions ?? []).length > 0) && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {p.community && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full border ${COMMUNITY_META[p.community].tone}`}
                        >
                          {COMMUNITY_META[p.community].label}
                        </span>
                      )}
                      {(p.personality ?? []).map((pp) => (
                        <span
                          key={pp}
                          className={`text-[10px] px-1.5 py-0.5 rounded-full border ${PERSONALITY_META[pp].tone}`}
                        >
                          {PERSONALITY_META[pp].label}
                        </span>
                      ))}
                      {(p.functions ?? []).map((f) => (
                        <FunctionBadge key={f} fn={f} />
                      ))}
                    </div>
                  )}
                  {/* 商材固有のカスタム属性 */}
                  {p.customFields &&
                    Object.keys(p.customFields).length > 0 && (
                      <dl className="mt-2 grid grid-cols-1 gap-y-0.5 text-[11px]">
                        {Object.entries(p.customFields).map(([key, value]) => {
                          if (!value) return null;
                          const label = fieldLabelByKey.get(key) ?? key;
                          return (
                            <div key={key} className="flex items-baseline gap-1.5">
                              <dt className="text-ink-400 shrink-0">{label}</dt>
                              <dd className="text-ink-700 break-words">
                                {fieldOptionLabel(key, value)}
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                    )}
                  {p.note && (
                    <div className="mt-2 text-[11px] text-ink-700 bg-ink-50/70 border border-ink-100 rounded-lg px-2 py-1.5 whitespace-pre-wrap">
                      <span className="text-[10px] text-ink-500 font-semibold">
                        備考:{" "}
                      </span>
                      {p.note}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onEdit(p)}
                    className="text-[11px] text-ink-500 hover:text-ink-700"
                    title="プロファイル編集"
                  >
                    ✎ 編集
                  </button>
                  {p.email && (
                    <a
                      href={`mailto:${p.email}`}
                      className="text-[11px] text-ink-500 hover:text-brand-blue"
                      title={`メール: ${p.email}`}
                    >
                      ✉ メール
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* 参加者一覧表示 (テーブル形式)。商材ごとのカスタム項目を列に展開する。 */
function ParticipantContractList({
  contractId,
  contract,
  people,
  contactById,
  onEdit,
  termLabel = "参加者"
}: {
  contractId: string;
  contract: ActiveContract | undefined;
  people: Participant[];
  contactById: Map<string, Contact>;
  onEdit: (p: Participant) => void;
  termLabel?: string;
}) {
  const productCode = contract?.product;
  const fieldSchema = productCode
    ? participantFieldSchemas[productCode] ?? []
    : [];
  const fieldOptionLabel = (key: string, value: string): string => {
    const f = fieldSchema.find((x) => x.key === key);
    if (!f) return value;
    if (f.type === "select" && f.options) {
      return f.options.find((o) => o.value === value)?.label ?? value;
    }
    return value;
  };

  // 当該契約のセッション (回フィルタ)
  const contractSessions = allSessionsData
    .filter((s) => s.contractId === contractId)
    .sort((a, b) => a.sessionNumber - b.sessionNumber);
  const [sessionFilter, setSessionFilter] = useState<string>("all");
  const visiblePeople =
    sessionFilter === "all"
      ? people
      : people.filter((p) => {
          const sess = contractSessions.find((s) => s.id === sessionFilter);
          return sess ? sess.expectedParticipantIds.includes(p.id) : true;
        });

  return (
    <div className="liquid-surface p-3 space-y-3">
      {/* 上部: セッションフィルタ + カウント */}
      <div className="flex items-center gap-2 flex-wrap px-1">
        {contractSessions.length > 0 && (
          <>
            <span className="text-[11px] text-ink-500 mr-1">回</span>
            <button
              type="button"
              onClick={() => setSessionFilter("all")}
              className={[
                "px-2 py-0.5 rounded-full border text-[11px] transition",
                sessionFilter === "all"
                  ? "bg-ink-900 text-white border-ink-900"
                  : "bg-white border-ink-200 text-ink-600 hover:bg-ink-50"
              ].join(" ")}
            >
              全回
            </button>
            {contractSessions.map((s) => {
              const active = sessionFilter === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSessionFilter(s.id)}
                  className={[
                    "px-2 py-0.5 rounded-full border text-[11px] transition",
                    active
                      ? "bg-ink-900 text-white border-ink-900"
                      : "bg-white border-ink-200 text-ink-600 hover:bg-ink-50"
                  ].join(" ")}
                  title={s.title}
                >
                  第{s.sessionNumber}回
                </button>
              );
            })}
          </>
        )}
        <span className="ml-auto text-[11px] text-ink-500 tabular-nums">
          {termLabel} {visiblePeople.length}/{people.length}名
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-ink-50/60 text-ink-600">
            <tr>
              <th className="text-left font-medium px-2 py-2">{termLabel}</th>
              <th className="text-left font-medium px-2 py-2">所属 / 役職</th>
              <th className="text-left font-medium px-2 py-2">タグ</th>
              {fieldSchema.map((f) => (
                <th
                  key={f.key}
                  className="text-left font-medium px-2 py-2 whitespace-nowrap"
                >
                  {f.label}
                </th>
              ))}
              <th className="text-left font-medium px-2 py-2">備考</th>
              <th className="text-right font-medium px-2 py-2 w-20">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {visiblePeople.length === 0 && (
              <tr>
                <td
                  colSpan={4 + fieldSchema.length + 1}
                  className="text-center text-ink-400 py-6"
                >
                  該当する{termLabel}はいません
                </td>
              </tr>
            )}
            {visiblePeople.map((p) => {
              const linked = p.linkedContactId
                ? contactById.get(p.linkedContactId)
                : undefined;
              return (
                <tr key={p.id} className="hover:bg-ink-50/40">
                  <td className="px-2 py-2 align-top">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-ink-900">{p.name}</span>
                      {linked && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100"
                          title={`担当者${linked.name} と同一人物 (兼任)`}
                        >
                          兼任
                        </span>
                      )}
                      {p.continuingFromPrev && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                          継続
                        </span>
                      )}
                      {p.status === "dropped" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-100">
                          脱落
                        </span>
                      )}
                    </div>
                    {p.email && (
                      <div className="text-[10px] text-ink-500 mt-0.5">
                        {p.email}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 align-top text-ink-700">
                    <div>{p.department ?? "—"}</div>
                    <div className="text-[10px] text-ink-500">
                      {p.title ?? p.role ?? ""}
                    </div>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <div className="flex flex-wrap gap-1">
                      {p.community && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full border ${COMMUNITY_META[p.community].tone}`}
                        >
                          {COMMUNITY_META[p.community].label}
                        </span>
                      )}
                      {(p.personality ?? []).map((pp) => (
                        <span
                          key={pp}
                          className={`text-[10px] px-1.5 py-0.5 rounded-full border ${PERSONALITY_META[pp].tone}`}
                        >
                          {PERSONALITY_META[pp].label}
                        </span>
                      ))}
                      {(p.functions ?? []).map((f) => (
                        <FunctionBadge key={f} fn={f} />
                      ))}
                    </div>
                  </td>
                  {fieldSchema.map((f) => {
                    const v = p.customFields?.[f.key];
                    return (
                      <td
                        key={f.key}
                        className="px-2 py-2 align-top text-ink-700"
                      >
                        {v ? fieldOptionLabel(f.key, v) : "—"}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 align-top text-ink-600 max-w-[280px]">
                    <div className="line-clamp-2 whitespace-pre-wrap">
                      {p.note ?? ""}
                    </div>
                  </td>
                  <td className="px-2 py-2 align-top text-right">
                    <button
                      type="button"
                      onClick={() => onEdit(p)}
                      className="text-[11px] text-ink-500 hover:text-ink-700"
                      title="プロファイル編集"
                    >
                      ✎ 編集
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* 参加者プロファイル編集ダイアログ
   担当者用 ContactEditDialog の参加者向けサブセット
   (役職・連絡先・関与度・性質・機能・備考・継続フラグ) */
function ParticipantEditDialog({
  participant,
  productCode,
  contacts = [],
  isEmailDuplicate,
  onClose,
  onSave
}: {
  participant: Participant;
  /** 商材コード — 渡されると商材固有のカスタム項目を編集UIに展開 */
  productCode?: ProductCode;
  /** 兼任候補となる担当者一覧 — 渡されると 兼任 link UI を表示 */
  contacts?: Contact[];
  /** 既存参加者のメールと重複しているか (自分自身は除外して呼び出される) */
  isEmailDuplicate?: (email: string) => boolean;
  onClose: () => void;
  onSave: (next: Participant) => void;
}) {
  const [linkedContactId, setLinkedContactId] = useState<string>(
    participant.linkedContactId ?? ""
  );
  const [department, setDepartment] = useState(participant.department ?? "");
  const [title, setTitle] = useState(participant.title ?? participant.role ?? "");
  const [email, setEmail] = useState(participant.email);
  const [tel, setTel] = useState(participant.tel ?? "");
  const fieldSchema = productCode
    ? participantFieldSchemas[productCode] ?? []
    : [];
  const [customFields, setCustomFields] = useState<Record<string, string>>(
    participant.customFields ?? {}
  );
  const setCustomField = (key: string, value: string) =>
    setCustomFields((prev) => ({ ...prev, [key]: value }));
  const [community, setCommunity] = useState<ContactCommunityTier | undefined>(
    participant.community
  );
  const [personality, setPersonality] = useState<ContactPersonality[]>(
    participant.personality ?? []
  );
  const togglePersonality = (p: ContactPersonality) =>
    setPersonality((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  const [functions, setFunctions] = useState<ContactFunction[]>(
    participant.functions ?? []
  );
  const toggleFunction = (f: ContactFunction) =>
    setFunctions((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  const [note, setNote] = useState(participant.note ?? "");
  const [continuing, setContinuing] = useState(
    participant.continuingFromPrev ?? false
  );
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const submit = () => {
    // 空欄のカスタム項目は保存しない
    const cleanedCustom = Object.fromEntries(
      Object.entries(customFields).filter(([, v]) => v && v.length > 0)
    );
    onSave({
      ...participant,
      department: department || undefined,
      title: title || undefined,
      email,
      tel: tel || undefined,
      community,
      personality,
      functions,
      note: note || undefined,
      continuingFromPrev: continuing,
      linkedContactId: linkedContactId || undefined,
      customFields: Object.keys(cleanedCustom).length > 0 ? cleanedCustom : undefined
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-ink-900/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="text-sm font-semibold text-ink-900">
            {participant.name}
          </div>
          <div className="text-[11px] text-ink-500">参加者プロファイル編集</div>
        </div>

        {/* 担当者との兼任リンク */}
        {contacts.length > 0 && (
          <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-3 space-y-1.5">
            <label className="block text-xs">
              <span className="text-ink-500">兼任 (担当者と紐付け)</span>
              <select
                value={linkedContactId}
                onChange={(e) => setLinkedContactId(e.target.value)}
                className="mt-1 w-full px-2 py-1.5 rounded-md border border-ink-200 text-sm bg-white"
              >
                <option value="">紐付けなし</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.department ?? "—"} / {c.title ?? "—"})
                  </option>
                ))}
              </select>
            </label>
            <div className="text-[10px] text-ink-500">
              同一人物の担当者がいる場合に紐付けると 兼任 バッジが表示されます。
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs">
            <span className="text-ink-500">所属</span>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded-md border border-ink-200 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-ink-500">役職</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded-md border border-ink-200 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-ink-500">メール</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={[
                "mt-1 w-full px-2 py-1.5 rounded-md border text-sm",
                isEmailDuplicate?.(email)
                  ? "border-rose-400 bg-rose-50/40"
                  : "border-ink-200"
              ].join(" ")}
            />
            {isEmailDuplicate?.(email) && (
              <div className="mt-1 text-[11px] text-rose-600">
                同じメールアドレスの参加者が既に登録されています
              </div>
            )}
          </label>
          <label className="block text-xs">
            <span className="text-ink-500">電話</span>
            <input
              type="tel"
              value={tel}
              onChange={(e) => setTel(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded-md border border-ink-200 text-sm"
            />
          </label>
        </div>

        <div>
          <div className="text-xs text-ink-500 mb-1.5">コミュニティ関与度</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(COMMUNITY_META) as ContactCommunityTier[]).map((tier) => {
              const active = community === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setCommunity(active ? undefined : tier)}
                  className={[
                    "text-[11px] px-2 py-0.5 rounded-full border",
                    active
                      ? COMMUNITY_META[tier].tone
                      : "bg-white border-ink-200 text-ink-500 hover:bg-ink-50"
                  ].join(" ")}
                >
                  {COMMUNITY_META[tier].label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-xs text-ink-500 mb-1.5">パーソナリティ</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(PERSONALITY_META) as ContactPersonality[]).map((p) => {
              const active = personality.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePersonality(p)}
                  className={[
                    "text-[11px] px-2 py-0.5 rounded-full border",
                    active
                      ? PERSONALITY_META[p].tone
                      : "bg-white border-ink-200 text-ink-500 hover:bg-ink-50"
                  ].join(" ")}
                >
                  {PERSONALITY_META[p].label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-xs text-ink-500 mb-1.5">機能タグ</div>
          <div className="flex flex-wrap gap-1.5">
            {(["contract", "pr", "invitation", "liaison"] as ContactFunction[]).map(
              (f) => {
                const active = functions.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleFunction(f)}
                    className={[
                      "text-[11px] px-2 py-0.5 rounded-full border",
                      active
                        ? FUNCTION_META[f].tone
                        : "bg-white border-ink-200 text-ink-500 hover:bg-ink-50"
                    ].join(" ")}
                  >
                    {FUNCTION_META[f].label}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* 商材ごとのカスタム項目 (productCode が渡されたときのみ) */}
        {fieldSchema.length > 0 && (
          <div>
            <div className="text-xs text-ink-500 mb-1.5">
              事業固有の項目{productCode ? ` (${productByCode[productCode]?.shortName})` : ""}
            </div>
            <div className="grid grid-cols-1 gap-2">
              {fieldSchema.map((f) => {
                const v = customFields[f.key] ?? "";
                if (f.type === "select") {
                  return (
                    <label key={f.key} className="block text-xs">
                      <span className="text-ink-500">{f.label}</span>
                      <select
                        value={v}
                        onChange={(e) => setCustomField(f.key, e.target.value)}
                        className="mt-1 w-full px-2 py-1.5 rounded-md border border-ink-200 text-sm bg-white"
                      >
                        <option value="">未設定</option>
                        {(f.options ?? []).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                }
                return (
                  <label key={f.key} className="block text-xs">
                    <span className="text-ink-500">{f.label}</span>
                    <input
                      type="text"
                      value={v}
                      onChange={(e) => setCustomField(f.key, e.target.value)}
                      placeholder={f.hint}
                      className="mt-1 w-full px-2 py-1.5 rounded-md border border-ink-200 text-sm"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <label className="block text-xs">
          <span className="text-ink-500">備考</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="mt-1 w-full px-2 py-1.5 rounded-md border border-ink-200 text-sm"
            placeholder="趣味嗜好・関係性・関係構築のヒントなど"
          />
        </label>

        <label className="flex items-center gap-2 text-xs text-ink-700">
          <input
            type="checkbox"
            checked={continuing}
            onChange={(e) => setContinuing(e.target.checked)}
          />
          前期からの継続参加
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-full text-xs text-ink-700 border border-ink-200 hover:bg-ink-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!email.trim() || (isEmailDuplicate?.(email) ?? false)}
            className="px-3 py-1.5 rounded-full text-xs text-white bg-ink-900 hover:bg-ink-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            保存
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ──────────────── 参加者追加ダイアログ ────────────────
   - 必須: 氏名 / メール
   - メールは既存参加者と重複していたらエラー (DB保存ガード)
   - 商材ごとのカスタム項目も入力可
   将来的に外部コミュニティポータル (Slack / Discord / Notion 等) からの一括同期 を予定。
   そのときは email を一意キーに付き合わせるため、ここでも email 必須・重複不可に揃えている。 */
function ParticipantAddDialog({
  companyId,
  contractId,
  productCode,
  termLabel,
  contacts = [],
  isEmailDuplicate,
  onClose,
  onSave
}: {
  companyId: string;
  contractId: string;
  productCode?: ProductCode;
  termLabel: string;
  /** 兼任候補となる担当者一覧 — 渡されると先頭で選択UIを出す */
  contacts?: Contact[];
  isEmailDuplicate: (email: string) => boolean;
  onClose: () => void;
  onSave: (next: Participant) => void;
}) {
  // 入力モード: "new" = 新規入力 (デフォルト) / "linked" = 既存担当者から兼任として登録
  const [mode, setMode] = useState<"new" | "linked">("new");
  const [linkedContactId, setLinkedContactId] = useState<string>("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [tel, setTel] = useState("");
  const [community, setCommunity] = useState<ContactCommunityTier | undefined>();
  const [personality, setPersonality] = useState<ContactPersonality[]>([]);

  // 担当者を選択したら、参加者フォームをその情報で埋める
  const applyContact = (contactId: string) => {
    setLinkedContactId(contactId);
    const c = contacts.find((x) => x.id === contactId);
    if (!c) return;
    setName(c.name);
    setDepartment(c.department ?? "");
    setTitle(c.title ?? "");
    setEmail(c.email);
    setTel(c.tel ?? "");
    setCommunity(c.community);
    setPersonality(c.personality ?? []);
    setFunctions(c.functions ?? []);
    setNote(c.note ?? "");
  };

  // タイプ中の email が既存担当者の email と一致したら「兼任候補」として通知
  const emailMatchedContact = email
    ? contacts.find(
        (c) => c.email.trim().toLowerCase() === email.trim().toLowerCase()
      )
    : undefined;
  const togglePersonality = (p: ContactPersonality) =>
    setPersonality((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  const [functions, setFunctions] = useState<ContactFunction[]>([]);
  const toggleFunction = (f: ContactFunction) =>
    setFunctions((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  const [note, setNote] = useState("");
  const [continuing, setContinuing] = useState(false);
  const fieldSchema = productCode
    ? participantFieldSchemas[productCode] ?? []
    : [];
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const setCustomField = (key: string, value: string) =>
    setCustomFields((prev) => ({ ...prev, [key]: value }));

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const dup = isEmailDuplicate(email);
  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && !dup;

  const submit = () => {
    if (!canSubmit) return;
    const cleanedCustom = Object.fromEntries(
      Object.entries(customFields).filter(([, v]) => v && v.length > 0)
    );
    const next: Participant = {
      id: `pa-new-${Date.now()}`,
      companyId,
      contractId,
      name: name.trim(),
      email: email.trim(),
      role: title || undefined,
      title: title || undefined,
      tel: tel || undefined,
      department: department || undefined,
      status: "active",
      joinedAt: new Date().toISOString().slice(0, 10),
      community,
      personality,
      functions,
      note: note || undefined,
      continuingFromPrev: continuing,
      linkedContactId:
        mode === "linked"
          ? linkedContactId || undefined
          : emailMatchedContact?.id,
      customFields:
        Object.keys(cleanedCustom).length > 0 ? cleanedCustom : undefined
    };
    onSave(next);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-ink-900/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="text-sm font-semibold text-ink-900">
            {termLabel} を追加
          </div>
          <div className="text-[11px] text-ink-500">
            メールアドレスで重複チェックされます (大文字小文字無視)
          </div>
        </div>

        {/* 兼任モード切替: 既存担当者から選ぶ / 新規入力 */}
        {contacts.length > 0 && (
          <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-3 space-y-2">
            <div className="flex items-center gap-1 p-0.5 rounded-full bg-white border border-ink-100 w-fit">
              {(["new", "linked"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    if (m === "new") {
                      // 新規モードへ切替時は兼任リンクを外す
                      setLinkedContactId("");
                    }
                  }}
                  className={[
                    "px-2.5 py-0.5 rounded-full text-[11px] transition",
                    mode === m
                      ? "bg-ink-900 text-white font-semibold"
                      : "text-ink-500 hover:text-ink-700"
                  ].join(" ")}
                >
                  {m === "linked" ? "担当者から選ぶ (兼任)" : "新規入力"}
                </button>
              ))}
            </div>
            {mode === "linked" && (
              <div>
                <label className="block text-xs">
                  <span className="text-ink-500">既存担当者を選択</span>
                  <select
                    value={linkedContactId}
                    onChange={(e) => applyContact(e.target.value)}
                    className="mt-1 w-full px-2 py-1.5 rounded-md border border-ink-200 text-sm bg-white"
                  >
                    <option value="">— 選択してください —</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.department ?? "—"} / {c.title ?? "—"})
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-1.5 text-[10px] text-ink-500">
                  選択すると氏名・所属・役職・メール・タグが自動入力されます。下のフォームで調整可能です。
                </div>
              </div>
            )}
            {/* 新規モード時、入力中 email が既存担当者と一致したら兼任候補を提示 */}
            {mode === "new" && emailMatchedContact && (
              <div className="rounded-md border border-blue-200 bg-blue-50/50 p-2 text-[11px] text-blue-800">
                同じメールアドレスの担当者「{emailMatchedContact.name}」が見つかりました。
                <button
                  type="button"
                  onClick={() => {
                    setMode("linked");
                    applyContact(emailMatchedContact.id);
                  }}
                  className="ml-2 underline font-medium hover:text-blue-900"
                >
                  兼任として登録する →
                </button>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs col-span-2">
            <span className="text-ink-500">氏名 *</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full px-2 py-1.5 rounded-md border border-ink-200 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-ink-500">所属</span>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded-md border border-ink-200 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-ink-500">役職</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded-md border border-ink-200 text-sm"
            />
          </label>
          <label className="block text-xs col-span-2">
            <span className="text-ink-500">メール *</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={[
                "mt-1 w-full px-2 py-1.5 rounded-md border text-sm",
                dup ? "border-rose-400 bg-rose-50/40" : "border-ink-200"
              ].join(" ")}
            />
            {dup && (
              <div className="mt-1 text-[11px] text-rose-600">
                同じメールアドレスの参加者が既に登録されています
              </div>
            )}
          </label>
          <label className="block text-xs">
            <span className="text-ink-500">電話</span>
            <input
              type="tel"
              value={tel}
              onChange={(e) => setTel(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded-md border border-ink-200 text-sm"
            />
          </label>
        </div>

        <div>
          <div className="text-xs text-ink-500 mb-1.5">コミュニティ関与度</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(COMMUNITY_META) as ContactCommunityTier[]).map((tier) => {
              const active = community === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setCommunity(active ? undefined : tier)}
                  className={[
                    "text-[11px] px-2 py-0.5 rounded-full border",
                    active
                      ? COMMUNITY_META[tier].tone
                      : "bg-white border-ink-200 text-ink-500 hover:bg-ink-50"
                  ].join(" ")}
                >
                  {COMMUNITY_META[tier].label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-xs text-ink-500 mb-1.5">パーソナリティ</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(PERSONALITY_META) as ContactPersonality[]).map((p) => {
              const active = personality.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePersonality(p)}
                  className={[
                    "text-[11px] px-2 py-0.5 rounded-full border",
                    active
                      ? PERSONALITY_META[p].tone
                      : "bg-white border-ink-200 text-ink-500 hover:bg-ink-50"
                  ].join(" ")}
                >
                  {PERSONALITY_META[p].label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-xs text-ink-500 mb-1.5">機能タグ</div>
          <div className="flex flex-wrap gap-1.5">
            {(["contract", "pr", "invitation", "liaison"] as ContactFunction[]).map(
              (f) => {
                const active = functions.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleFunction(f)}
                    className={[
                      "text-[11px] px-2 py-0.5 rounded-full border",
                      active
                        ? FUNCTION_META[f].tone
                        : "bg-white border-ink-200 text-ink-500 hover:bg-ink-50"
                    ].join(" ")}
                  >
                    {FUNCTION_META[f].label}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {fieldSchema.length > 0 && (
          <div>
            <div className="text-xs text-ink-500 mb-1.5">
              事業固有の項目{productCode ? ` (${productByCode[productCode]?.shortName})` : ""}
            </div>
            <div className="grid grid-cols-1 gap-2">
              {fieldSchema.map((f) => {
                const v = customFields[f.key] ?? "";
                if (f.type === "select") {
                  return (
                    <label key={f.key} className="block text-xs">
                      <span className="text-ink-500">{f.label}</span>
                      <select
                        value={v}
                        onChange={(e) => setCustomField(f.key, e.target.value)}
                        className="mt-1 w-full px-2 py-1.5 rounded-md border border-ink-200 text-sm bg-white"
                      >
                        <option value="">未設定</option>
                        {(f.options ?? []).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                }
                return (
                  <label key={f.key} className="block text-xs">
                    <span className="text-ink-500">{f.label}</span>
                    <input
                      type="text"
                      value={v}
                      onChange={(e) => setCustomField(f.key, e.target.value)}
                      placeholder={f.hint}
                      className="mt-1 w-full px-2 py-1.5 rounded-md border border-ink-200 text-sm"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <label className="block text-xs">
          <span className="text-ink-500">備考</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="mt-1 w-full px-2 py-1.5 rounded-md border border-ink-200 text-sm"
          />
        </label>

        <label className="flex items-center gap-2 text-xs text-ink-700">
          <input
            type="checkbox"
            checked={continuing}
            onChange={(e) => setContinuing(e.target.checked)}
          />
          前期からの継続参加
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-full text-xs text-ink-700 border border-ink-200 hover:bg-ink-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="px-3 py-1.5 rounded-full text-xs text-white bg-ink-900 hover:bg-ink-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {(mode === "linked" && linkedContactId) ||
            (mode === "new" && emailMatchedContact)
              ? "兼任として追加"
              : "追加"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// =====================================================================
// 担当者の編集ダイアログ
// 関与度（コア/アクティブ/カジュアル/離脱危機）と性質タグを手動設定。
// 関与度には自動おすすめを併記し、ワンクリック適用できる。
// =====================================================================

function ContactEditDialog({
  contact,
  availableScopes,
  allCycles,
  onClose,
  onSave
}: {
  contact: Contact;
  availableScopes: ContactRoleScope[];
  allCycles: ActiveContract[];
  onClose: () => void;
  onSave: (next: Contact) => void;
}) {
  const [community, setCommunity] = useState<ContactCommunityTier | undefined>(
    contact.community
  );
  const [personality, setPersonality] = useState<ContactPersonality[]>(
    contact.personality ?? []
  );
  const togglePersonality = (p: ContactPersonality) =>
    setPersonality((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  const [roles, setRoles] = useState<ContactRole[]>(contact.roles ?? []);

  // 編集対象の期キー: "common" = 全期共通, "<product>#<cycleNo>" = 当該事業×期
  const [editingTermKey, setEditingTermKey] = useState<string>("common");
  // (scope, cycleNo) 組合せの一覧。overall は "common" にまとめる前提。
  const cyclesByScope: Record<string, number[]> = {};
  for (const c of allCycles) {
    const code = c.product as string;
    (cyclesByScope[code] ??= []).push(c.cycleNumber);
  }
  for (const k of Object.keys(cyclesByScope)) {
    cyclesByScope[k] = Array.from(new Set(cyclesByScope[k])).sort((a, b) => a - b);
  }
  const productScopes = availableScopes.filter(
    (s) => s !== "overall"
  ) as Exclude<ContactRoleScope, "overall">[];
  const termChips: {
    key: string;
    label: string;
    scope: ContactRoleScope;
    cycleNo?: number;
  }[] = [{ key: "common", label: "全期共通", scope: "overall" }];
  for (const s of productScopes) {
    for (const n of cyclesByScope[s] ?? []) {
      termChips.push({
        key: `${s}#${n}`,
        label: `${scopeLabel(s)} 第${n}期`,
        scope: s,
        cycleNo: n
      });
    }
  }
  const editingTerm =
    termChips.find((t) => t.key === editingTermKey) ?? termChips[0];
  // 各 scope 行に対する「現在編集中の cycleNo」を返す。
  // - 全期共通タブ: 全 scope について undefined (= 全期共通ロールを編集)
  // - 期タブ: その期の scope と一致する行のみ cycleNo を、他は undefined。
  //   overall 行は cycleNo を持たない仕様なので常に undefined。
  const cycleNoForRowScope = (rowScope: ContactRoleScope): number | undefined => {
    if (editingTerm.key === "common") return undefined;
    if (rowScope === "overall") return undefined;
    if (rowScope === editingTerm.scope) return editingTerm.cycleNo;
    return undefined;
  };
  const sameRole = (
    r: ContactRole,
    scope: ContactRoleScope,
    level: ContactRoleLevel,
    cycleNo: number | undefined
  ) =>
    r.scope === scope &&
    r.level === level &&
    (r.cycleNo ?? undefined) === cycleNo;
  const hasRole = (scope: ContactRoleScope, level: ContactRoleLevel) => {
    const cycleNo = cycleNoForRowScope(scope);
    return roles.some((r) => sameRole(r, scope, level, cycleNo));
  };
  // 「他期に同じ scope×level 設定がある」ヒント表示用
  const hasRoleInOtherTerm = (
    scope: ContactRoleScope,
    level: ContactRoleLevel
  ) => {
    const cycleNo = cycleNoForRowScope(scope);
    return roles.some(
      (r) =>
        r.scope === scope &&
        r.level === level &&
        (r.cycleNo ?? undefined) !== cycleNo
    );
  };
  const toggleRole = (scope: ContactRoleScope, level: ContactRoleLevel) => {
    const cycleNo = cycleNoForRowScope(scope);
    setRoles((prev) =>
      prev.some((r) => sameRole(r, scope, level, cycleNo))
        ? prev.filter((r) => !sameRole(r, scope, level, cycleNo))
        : [
            ...prev,
            cycleNo == null ? { scope, level } : { scope, level, cycleNo }
          ]
    );
  };
  const [functions, setFunctions] = useState<ContactFunction[]>(
    contact.functions ?? []
  );
  const toggleFunction = (f: ContactFunction) =>
    setFunctions((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  const [email, setEmail] = useState<string>(contact.email);
  const [tel, setTel] = useState<string>(contact.tel ?? "");
  const [department, setDepartment] = useState<string>(contact.department);
  const [title, setTitle] = useState<string>(contact.title);
  const [note, setNote] = useState<string>(contact.note ?? "");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-ink-900/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-ink-500">担当者を編集</div>
            <div className="text-lg font-semibold text-ink-900">{contact.name}</div>
            <div className="text-[11px] text-ink-500">
              {contact.department} ・ {contact.title}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-400 hover:text-ink-700 text-lg leading-none"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        {/* 連絡先 */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-ink-700">連絡先</div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[11px] text-ink-500">
              メールアドレス
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-ink-200 px-2 py-1 text-sm"
              />
            </label>
            <label className="block text-[11px] text-ink-500">
              電話番号
              <input
                type="tel"
                value={tel}
                onChange={(e) => setTel(e.target.value)}
                placeholder="090-1234-5678"
                className="mt-0.5 w-full rounded-lg border border-ink-200 px-2 py-1 text-sm"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[11px] text-ink-500">
              部署
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-ink-200 px-2 py-1 text-sm"
              />
            </label>
            <label className="block text-[11px] text-ink-500">
              役職
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-ink-200 px-2 py-1 text-sm"
              />
            </label>
          </div>
        </div>

        {/* コミュニティ関与度 */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-ink-700">
            コミュニティ関与度
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(["core", "active", "casual", "at_risk"] as ContactCommunityTier[]).map(
              (t) => {
                const active = community === t;
                const m = COMMUNITY_META[t];
                return (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setCommunity(t)}
                    className={[
                      "text-xs px-2.5 py-1.5 rounded-lg border text-left",
                      active ? m.tone + " border-current" : "bg-white border-ink-200 text-ink-700 hover:bg-ink-50"
                    ].join(" ")}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                      style={{ background: m.dot }}
                    />
                    {m.label}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* 担当ロール（scope × level × 期） */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-ink-700">担当ロール</div>
            <div className="text-[10px] text-ink-400">
              期を切替えてスコープ × 役割をチェック（兼務可）
            </div>
          </div>
          {/* 期切替チップ: 全期共通 + 各 (商材, 期) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-ink-500 mr-0.5">期</span>
            {termChips.map((t) => {
              const active = t.key === editingTermKey;
              const accent =
                t.scope === "overall" ? "#475569" : scopeAccent(t.scope);
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setEditingTermKey(t.key)}
                  className={[
                    "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] border transition",
                    active
                      ? "bg-ink-900 text-white border-ink-900"
                      : "bg-white border-ink-200 text-ink-700 hover:bg-ink-50"
                  ].join(" ")}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ background: accent }}
                  />
                  {t.label}
                </button>
              );
            })}
          </div>
          <div className="text-[10px] text-ink-500">
            編集中: <span className="font-medium text-ink-700">{editingTerm.label}</span>
            {editingTerm.key !== "common" && (
              <span className="ml-1 text-ink-400">
                (NEO全体行は常に「全期共通」として保存)
              </span>
            )}
          </div>
          <div className="rounded-lg border border-ink-100 overflow-hidden">
            <table className="w-full text-[11px]">
              <thead className="bg-ink-50 text-ink-600">
                <tr>
                  <th className="text-left px-2 py-1 font-medium">スコープ</th>
                  {ROLE_LEVEL_ORDER.map((lv) => (
                    <th key={lv} className="px-1 py-1 font-medium text-center">
                      {ROLE_LEVEL_META[lv].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {availableScopes.map((scope) => {
                  // 期タブ編集中で、この行が当該事業以外なら「全期共通として書込」
                  // 注釈を控えめに表示する。
                  const isCrossTermRow =
                    editingTerm.key !== "common" &&
                    scope !== "overall" &&
                    scope !== editingTerm.scope;
                  return (
                  <tr key={scope} className="border-t border-ink-100">
                    <td className="px-2 py-1">
                      <span
                        className="inline-flex items-center gap-1"
                        style={{ color: scopeAccent(scope) }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: scopeAccent(scope) }}
                        />
                        {scopeLabel(scope)}
                        {isCrossTermRow && (
                          <span className="ml-1 text-[9px] text-ink-400">
                            (全期共通)
                          </span>
                        )}
                      </span>
                    </td>
                    {ROLE_LEVEL_ORDER.map((lv) => (
                      <td key={lv} className="px-1 py-1 text-center">
                        <label className="inline-flex items-center justify-center gap-0.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={hasRole(scope, lv)}
                            onChange={() => toggleRole(scope, lv)}
                            className="cursor-pointer"
                            aria-label={`${scopeLabel(scope)} ${ROLE_LEVEL_META[lv].label}`}
                          />
                          {hasRoleInOtherTerm(scope, lv) && (
                            <span
                              className="text-[9px] leading-none text-ink-400"
                              title="他の期に同じ役割の設定あり"
                            >
                              •
                            </span>
                          )}
                        </label>
                      </td>
                    ))}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 機能タグ（契約/広報/招待/連絡） */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-ink-700">機能タグ</div>
            <div className="text-[10px] text-ink-400">複数選択可</div>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {(["contract", "pr", "invitation", "liaison"] as ContactFunction[]).map(
              (f) => {
                const active = functions.includes(f);
                const m = FUNCTION_META[f];
                return (
                  <button
                    type="button"
                    key={f}
                    onClick={() => toggleFunction(f)}
                    aria-pressed={active}
                    className={[
                      "text-xs px-2 py-1.5 rounded-lg border flex items-center justify-center gap-1",
                      active
                        ? m.tone + " border-current"
                        : "bg-white border-ink-200 text-ink-700 hover:bg-ink-50"
                    ].join(" ")}
                  >
                    <span className="text-[10px]">{active ? "✓" : "　"}</span>
                    {m.label}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* 性質タグ（複数選択可） */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-ink-700">性質タグ</div>
            <div className="text-[10px] text-ink-400">
              複数選択可（タップで切り替え）
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(["playful_leader", "playful_thinker", "narepan", "gardon"] as ContactPersonality[]).map(
              (p) => {
                const active = personality.includes(p);
                const m = PERSONALITY_META[p];
                return (
                  <button
                    type="button"
                    key={p}
                    onClick={() => togglePersonality(p)}
                    aria-pressed={active}
                    className={[
                      "text-xs px-2.5 py-1.5 rounded-lg border text-left flex items-center gap-1.5",
                      active ? m.tone + " border-current" : "bg-white border-ink-200 text-ink-700 hover:bg-ink-50"
                    ].join(" ")}
                  >
                    <span className="text-[10px]">{active ? "✓" : "　"}</span>
                    {m.label}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* 備考（自由記述） */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-ink-700">備考</div>
            <div className="text-[10px] text-ink-400">
              趣味嗜好・関係性・関係構築のヒント等
            </div>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="例: 野球好き / 元 営業出身で現場経験豊富 / 家族の話題に乗ってくれる"
            className="w-full resize-y rounded-lg border border-ink-200 px-2 py-1.5 text-sm focus:outline-none focus:border-brand-blue"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-ink-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg border border-ink-200 text-ink-700 hover:bg-ink-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() =>
              onSave({
                ...contact,
                email,
                tel: tel.trim() ? tel.trim() : undefined,
                department,
                title,
                community,
                personality: personality.length > 0 ? personality : undefined,
                roles: roles.length > 0 ? roles : undefined,
                functions: functions.length > 0 ? functions : undefined,
                note: note.trim() ? note.trim() : undefined
              })
            }
            className="px-4 py-1.5 text-sm rounded-lg bg-ink-900 text-white hover:opacity-90"
          >
            保存
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
