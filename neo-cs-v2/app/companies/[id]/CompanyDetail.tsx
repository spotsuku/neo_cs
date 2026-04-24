"use client";

import { useState } from "react";
import Link from "next/link";
import { ProductBadge } from "@/components/ProductBadge";
import type {
  Company,
  Contact,
  MeetingLog,
  OnboardingTask
} from "@/lib/mock/entities";
import { ProductCode, productByCode, yen } from "@/lib/mock/data";

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
  tasks
}: {
  company: Company;
  contacts: Contact[];
  logs: MeetingLog[];
  tasks: OnboardingTask[];
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
        <OverviewTab company={company} contacts={contacts} />
      )}
      {tab === "contracts" && <ContractsPlaceholder />}
      {tab === "logs" && <LogsTab logs={logs} />}
      {tab === "onboarding" && <OnboardingTab tasks={tasks} />}
      {tab === "mail" && <MailPlaceholder />}
    </main>
  );
}

/* ──────────────── 概要タブ ──────────────── */
function OverviewTab({
  company,
  contacts
}: {
  company: Company;
  contacts: Contact[];
}) {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
            <ContractMiniCard key={code} code={code} />
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
    </section>
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

function ContractMiniCard({ code }: { code: ProductCode }) {
  const p = productByCode[code];
  return (
    <div className="liquid-surface p-4 relative overflow-hidden">
      <div
        className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-10"
        style={{ background: p.accent }}
      />
      <div className="flex items-center justify-between">
        <ProductBadge code={code} />
        <span className="text-[11px] text-ink-500">契約中</span>
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
function OnboardingTab({ tasks }: { tasks: OnboardingTask[] }) {
  const phases: {
    key: OnboardingTask["phase"];
    label: string;
  }[] = [
    { key: "prep", label: "準備 (Prep)" },
    { key: "kickoff", label: "キックオフ (Kickoff)" },
    { key: "run", label: "実施 (Run)" },
    { key: "close", label: "クロージング (Close)" }
  ];

  const statusStyle: Record<
    OnboardingTask["status"],
    { label: string; bg: string; color: string }
  > = {
    todo: { label: "未着手", bg: "#EEF0F3", color: "#6B7079" },
    doing: { label: "進行中", bg: "#DBEAFE", color: "#1D4ED8" },
    done: { label: "完了", bg: "#D1FAE5", color: "#047857" },
    overdue: { label: "期日超過", bg: "#FEE2E2", color: "#B91C1C" }
  };

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {phases.map((ph) => {
        const list = tasks.filter((t) => t.phase === ph.key);
        return (
          <div key={ph.key} className="liquid-surface p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-ink-700">
                {ph.label}
              </div>
              <span className="text-[11px] text-ink-500">{list.length} 件</span>
            </div>
            <div className="space-y-2">
              {list.map((t) => {
                const s = statusStyle[t.status];
                return (
                  <div
                    key={t.id}
                    className="rounded-xl border border-ink-100 p-3 bg-white"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm text-ink-900 font-medium">
                        {t.name}
                      </div>
                      <ProductBadge code={t.product} size="sm" />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: s.bg, color: s.color }}
                      >
                        {s.label}
                      </span>
                      <span className="text-[11px] text-ink-500">
                        {t.dueDate}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-ink-500">
                      担当: {t.assignee}
                    </div>
                  </div>
                );
              })}
              {list.length === 0 && (
                <div className="text-xs text-ink-500 py-4 text-center">
                  タスクなし
                </div>
              )}
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
