"use client";

import { useState } from "react";
import Link from "next/link";
import { ProductBadge } from "@/components/ProductBadge";
import type {
  Company,
  Contact,
  MeetingLog
} from "@/lib/mock/entities";
// コース表示に対応
import { ProductCode, productByCode, yen, hasMultipleCourses, courseShortName, courseName } from "@/lib/mock/data";
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

type Tab = "overview" | "contracts" | "logs" | "onboarding" | "mail";

const tabs: { key: Tab; label: string }[] = [
  { key: "overview", label: "概要" },
  { key: "contracts", label: "契約・参加者" },
  { key: "logs", label: "面談ログ" },
  { key: "onboarding", label: "オンボ" },
  { key: "mail", label: "メール" }
];

function healthBg(color: Company["healthColor"]) {
  return color === "green" ? "#10B981" : color === "yellow" ? "#F59E0B" : "#EF4444";
}

function healthLabel(color: Company["healthColor"]) {
  return color === "green" ? "Green" : color === "yellow" ? "Yellow" : "Red";
}

export function CompanyDetail({
  company,
  contacts,
  logs,
  contracts,
  items
}: {
  company: Company;
  contacts: Contact[];
  logs: MeetingLog[];
  contracts: ActiveContract[];
  items: ContractOnboardingItem[];
}) {
  const [tab, setTab] = useState<Tab>("overview");

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
            background: healthBg(company.healthColor),
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
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink-900">
              {company.name}
            </h1>
            <div className="mt-3 flex items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 liquid-chip">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: healthBg(company.healthColor) }}
                />
                Health: {healthLabel(company.healthColor)}
              </span>
              <span className="text-ink-500">MRR</span>
              <span className="text-ink-900 font-semibold">{yen(company.mrr)}</span>
              <span className="text-ink-500">最終接点</span>
              <span className="text-ink-700">{company.lastTouchDays}日前</span>
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
        <OverviewTab company={company} contacts={contacts} contracts={contracts} />
      )}
      {tab === "contracts" && <ContractsPlaceholder />}
      {tab === "logs" && <LogsTab logs={logs} />}
      {tab === "onboarding" && (
        <OnboardingTab contracts={contracts} items={items} />
      )}
      {tab === "mail" && <MailPlaceholder />}
    </main>
  );
}

/* ──────────────── 概要タブ ──────────────── */
function OverviewTab({
  company,
  contacts,
  contracts
}: {
  company: Company;
  contacts: Contact[];
  contracts: ActiveContract[];
}) {
  return (
    <section className="space-y-4">
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
  const inProgress = contracts.filter((c) => c.onboardingStatus === "in_progress").length;
  const running = contracts.filter((c) => c.onboardingStatus === "complete").length;

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
  const isOnboarding = contract.onboardingStatus === "in_progress";
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
                      contract.onboardingStatus === "complete"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                        : "bg-amber-50 text-amber-700 border-amber-100"
                    ].join(" ")}
                  >
                    {contract.onboardingStatus === "complete"
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

/* ──────────────── プレースホルダ ──────────────── */
function ContractsPlaceholder() {
  return (
    <section className="liquid-surface p-12 text-center">
      <div className="text-sm text-ink-500">
        契約・参加者タブは準備中です
      </div>
      <div className="text-xs text-ink-500 mt-2">
        契約詳細、参加者一覧、出席・進捗などを表示予定
      </div>
    </section>
  );
}

function MailPlaceholder() {
  return (
    <section className="liquid-surface p-12 text-center">
      <div className="text-sm text-ink-500">メールタブは準備中です</div>
      <div className="text-xs text-ink-500 mt-2">
        Gmail/Outlook連携によるスレッド表示を予定
      </div>
    </section>
  );
}
