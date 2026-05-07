"use client";

// /programs/[termId] のタブ式ビュー (期ハブ)
// 概要 / 参加企業 / オンボーディング / ToDo の 4 タブ。
// 既存の ProgramMatrix (ToDo タブ) はそのまま再利用。

import { useState, useTransition } from "react";
import Link from "next/link";
import { ProgramMatrix, ProgramMatrixLegend } from "./ProgramMatrix";
import { ContractFormModal } from "@/app/companies/[id]/ContractFormModal";
import { updateProgramTerm } from "../termActions";
import type {
  ProgramTerm,
  ProgramTaskTemplate,
  ProgramCompanyTask,
  ProgramTermStatus,
  Contract,
  ContractOnboardingItem
} from "@/lib/repository/types";

type Tab = "overview" | "participants" | "onboarding" | "todo";

const STATUS_LABEL: Record<ProgramTermStatus, string> = {
  draft: "下書き",
  active: "開講中",
  closed: "終了",
  archived: "アーカイブ"
};

export function TermHubView({
  term,
  templates,
  cells,
  participants,
  onboardingItems,
  companyMap,
  users,
  today,
  canManageTerm,
  canManageContracts,
  productAccent,
  productShortName,
  productCourseLabel
}: {
  term: ProgramTerm;
  templates: ProgramTaskTemplate[];
  cells: ProgramCompanyTask[];
  participants: { contract: Contract; companyName: string }[];
  onboardingItems: ContractOnboardingItem[];
  companyMap: Record<string, string>;
  users: { id: string; name: string }[];
  today: string;
  canManageTerm: boolean;
  canManageContracts: boolean;
  productAccent: string;
  productShortName: string;
  productCourseLabel: string | null;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [addContractOpen, setAddContractOpen] = useState<{
    companyId: string;
  } | null>(null);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: "概要" },
    { key: "participants", label: "参加企業", count: participants.length },
    { key: "onboarding", label: "オンボーディング" },
    { key: "todo", label: "ToDo" }
  ];

  return (
    <main className="mx-auto max-w-[1600px] px-6 py-8 space-y-6">
      <header className="space-y-2">
        <div className="text-xs text-ink-500">
          <Link href="/" className="hover:text-ink-700">
            ダッシュボード
          </Link>
          <span className="mx-1">/</span>
          <Link
            href={`/dashboard/${term.productCode}`}
            className="hover:text-ink-700"
          >
            {productShortName} ダッシュボード
          </Link>
          <span className="mx-1">/</span>
          <Link href="/programs" className="hover:text-ink-700">
            期管理
          </Link>
          <span className="mx-1">/</span>
          <span>{term.label}</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-ink-900">{term.label}</h1>
          <span
            className="text-[12px] font-medium px-2.5 py-0.5 rounded-full"
            style={{
              color: productAccent,
              background: `${productAccent}14`,
              border: `1px solid ${productAccent}33`
            }}
          >
            {productShortName}
          </span>
          {productCourseLabel && (
            <span className="text-[12px] px-2.5 py-0.5 rounded-full bg-ink-50 border border-ink-100 text-ink-700">
              {productCourseLabel}
            </span>
          )}
          {term.cycleNo != null && (
            <span className="text-[12px] px-2.5 py-0.5 rounded-full bg-ink-50 border border-ink-100 text-ink-700">
              第{term.cycleNo}期
            </span>
          )}
          <span
            className={[
              "text-[12px] px-2.5 py-0.5 rounded-full border",
              term.status === "active"
                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                : term.status === "closed"
                  ? "bg-ink-50 text-ink-500 border-ink-100"
                  : "bg-amber-50 text-amber-700 border-amber-100"
            ].join(" ")}
          >
            {STATUS_LABEL[term.status]}
          </span>
        </div>
      </header>

      {/* タブ */}
      <nav className="flex items-center gap-1 border-b border-ink-100">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={[
                "px-3 py-2 text-sm border-b-2 transition",
                active
                  ? "border-ink-900 text-ink-900 font-medium"
                  : "border-transparent text-ink-500 hover:text-ink-700"
              ].join(" ")}
            >
              {t.label}
              {t.count !== undefined && (
                <span className="ml-1.5 text-[11px] text-ink-500">{t.count}</span>
              )}
            </button>
          );
        })}
      </nav>

      {tab === "overview" && (
        <OverviewTab
          term={term}
          canManageTerm={canManageTerm}
          accent={productAccent}
        />
      )}
      {tab === "participants" && (
        <ParticipantsTab
          term={term}
          participants={participants}
          canManageContracts={canManageContracts}
          onAddContract={(companyId) => setAddContractOpen({ companyId })}
        />
      )}
      {tab === "onboarding" && (
        <OnboardingTab
          participants={participants}
          onboardingItems={onboardingItems}
          today={today}
          accent={productAccent}
        />
      )}
      {tab === "todo" && (
        <section className="space-y-4">
          <ProgramMatrixLegend />
          <ProgramMatrix
            termId={term.id}
            templates={templates}
            companyIds={participants.map((p) => p.contract.companyId)}
            companyMap={companyMap}
            users={users}
            initialCells={cells}
            today={today}
          />
          {canManageTerm && (
            <div className="text-right">
              <Link
                href={`/programs/${term.id}/edit`}
                className="text-xs px-3 py-1.5 rounded-full border border-ink-200 text-ink-700 hover:bg-ink-50"
              >
                ✎ タスク列テンプレを編集
              </Link>
            </div>
          )}
        </section>
      )}

      {addContractOpen && (
        <ContractFormModal
          mode="create"
          companyId={addContractOpen.companyId}
          // term のスコープを初期値として設定 (ContractFormModal の defaults を参考にしやすく)
          initial={undefined}
          onClose={() => setAddContractOpen(null)}
        />
      )}
    </main>
  );
}

// ─────────────────────────────────────────────
// 概要タブ (A1)
// ─────────────────────────────────────────────
function OverviewTab({
  term,
  canManageTerm,
  accent
}: {
  term: ProgramTerm;
  canManageTerm: boolean;
  accent: string;
}) {
  const [label, setLabel] = useState(term.label);
  const [startedAt, setStartedAt] = useState(term.startedAt ?? "");
  const [closedAt, setClosedAt] = useState(term.closedAt ?? "");
  const [status, setStatus] = useState<ProgramTermStatus>(term.status);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onSave = () => {
    setError(null);
    setSaved(null);
    start(async () => {
      const r = await updateProgramTerm({
        termId: term.id,
        label,
        startedAt: startedAt.trim() === "" ? null : startedAt,
        closedAt: closedAt.trim() === "" ? null : closedAt,
        status
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setSaved(new Date().toLocaleTimeString("ja-JP"));
    });
  };

  return (
    <section className="space-y-4">
      <div className="liquid-surface p-5 space-y-4">
        <div>
          <div className="text-sm font-semibold text-ink-700">期の基本情報</div>
          <div className="mt-0.5 text-[11px] text-ink-500">
            この期のラベル・開始日・終了日・状態を編集します
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-xs text-ink-700">
            ラベル
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={!canManageTerm}
              className="mt-1 w-full border border-ink-200 rounded-md px-2 py-1.5 text-sm disabled:bg-ink-50"
            />
          </label>
          <label className="text-xs text-ink-700">
            状態
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProgramTermStatus)}
              disabled={!canManageTerm}
              className="mt-1 w-full border border-ink-200 rounded-md px-2 py-1.5 text-sm disabled:bg-ink-50"
            >
              <option value="draft">draft (下書き)</option>
              <option value="active">active (開講中)</option>
              <option value="closed">closed (終了)</option>
              <option value="archived">archived</option>
            </select>
          </label>
          <label className="text-xs text-ink-700">
            開始日
            <input
              type="date"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              disabled={!canManageTerm}
              className="mt-1 w-full border border-ink-200 rounded-md px-2 py-1.5 text-sm disabled:bg-ink-50"
            />
          </label>
          <label className="text-xs text-ink-700">
            終了日
            <input
              type="date"
              value={closedAt}
              onChange={(e) => setClosedAt(e.target.value)}
              disabled={!canManageTerm}
              className="mt-1 w-full border border-ink-200 rounded-md px-2 py-1.5 text-sm disabled:bg-ink-50"
            />
          </label>
        </div>
        {error && <div className="text-xs text-rose-600">{error}</div>}
        {saved && <div className="text-xs text-emerald-700">{saved} に保存しました</div>}
        {canManageTerm ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onSave}
              disabled={pending}
              className="text-xs px-3 py-1.5 rounded-md text-white"
              style={{ background: accent }}
            >
              {pending ? "保存中…" : "保存"}
            </button>
          </div>
        ) : (
          <div className="text-[11px] text-ink-500">
            この期を編集する権限がありません (role_permissions.program_term_manage)
          </div>
        )}
      </div>

      <div className="liquid-surface p-5 space-y-2">
        <div className="text-sm font-semibold text-ink-700">スコープ</div>
        <div className="text-xs text-ink-500 grid grid-cols-2 gap-2">
          <div>
            研修: <span className="text-ink-900 font-medium">{term.productCode}</span>
          </div>
          <div>
            コース:{" "}
            <span className="text-ink-900 font-medium">
              {term.courseKey ?? "全コース共通"}
            </span>
          </div>
          <div>
            期 (cycleNo):{" "}
            <span className="text-ink-900 font-medium">
              {term.cycleNo != null ? `第${term.cycleNo}期` : "—"}
            </span>
          </div>
          <div>
            ID:{" "}
            <code className="text-[10px] text-ink-500 bg-ink-50 px-1 rounded">
              {term.id}
            </code>
          </div>
        </div>
        <div className="text-[11px] text-ink-500 mt-2">
          ※ スコープ (productCode / courseKey / cycleNo) の変更は別途マイグレーションが必要なため UI から不可。
          別スコープに変更したい場合は新しい期を作って tasks をコピーしてください。
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// 参加企業タブ (A2)
// ─────────────────────────────────────────────
function ParticipantsTab({
  term,
  participants,
  canManageContracts,
  onAddContract
}: {
  term: ProgramTerm;
  participants: { contract: Contract; companyName: string }[];
  canManageContracts: boolean;
  onAddContract: (companyId: string) => void;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-ink-700">
            この期の参加企業 ({participants.length} 社)
          </div>
          <div className="mt-0.5 text-[11px] text-ink-500">
            研修 {term.productCode}
            {term.courseKey ? ` ・ コース ${term.courseKey}` : ""}
            {term.cycleNo != null ? ` ・ 第${term.cycleNo}期` : ""} の active な契約が自動で参加します
          </div>
        </div>
        {canManageContracts && (
          <Link
            href={`/companies/new?product=${term.productCode}${term.courseKey ? `&course=${term.courseKey}` : ""}${term.cycleNo != null ? `&cycle=${term.cycleNo}` : ""}`}
            className="text-xs px-3 py-1.5 rounded-md bg-ink-900 text-white hover:bg-ink-800"
          >
            ＋ 新規企業 + 契約を追加
          </Link>
        )}
      </div>
      {participants.length === 0 ? (
        <div className="liquid-surface p-10 text-center text-sm text-ink-500">
          まだ参加企業がいません。既存企業に契約を追加するか、新規企業を登録してください。
        </div>
      ) : (
        <div className="liquid-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-ink-500 border-b border-ink-100">
                <th className="px-4 py-3 font-medium">企業</th>
                <th className="px-3 py-3 font-medium">担当</th>
                <th className="px-3 py-3 font-medium">参加人数</th>
                <th className="px-3 py-3 font-medium">期間</th>
                <th className="px-3 py-3 font-medium">状態</th>
                <th className="px-3 py-3 font-medium w-32">操作</th>
              </tr>
            </thead>
            <tbody>
              {participants.map(({ contract, companyName }) => (
                <tr
                  key={contract.id}
                  className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50"
                >
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/companies/${contract.companyId}`}
                      className="hover:underline"
                    >
                      {companyName}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-ink-700">{contract.ownerName}</td>
                  <td className="px-3 py-3 text-ink-700 tabular-nums">
                    {contract.participants}名
                  </td>
                  <td className="px-3 py-3 text-ink-500 text-[11px]">
                    {contract.startDate}
                    {contract.endDate ? ` 〜 ${contract.endDate}` : ""}
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-[11px] px-2 py-0.5 rounded border border-ink-200 text-ink-700 bg-white">
                      {contract.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/companies/${contract.companyId}`}
                        className="text-[11px] text-ink-700 px-2 py-1 rounded border border-ink-200 hover:bg-ink-50 whitespace-nowrap"
                      >
                        企業ページ
                      </Link>
                      {canManageContracts && (
                        <button
                          type="button"
                          onClick={() => onAddContract(contract.companyId)}
                          className="text-[11px] text-ink-700 px-2 py-1 rounded border border-ink-200 hover:bg-ink-50 whitespace-nowrap"
                          title="この企業に新しい契約を追加"
                        >
                          ＋ 契約追加
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────
// オンボーディングタブ (A3)
// 各 contract のチェックリスト進捗を集計して表示
// ─────────────────────────────────────────────
function OnboardingTab({
  participants,
  onboardingItems,
  today,
  accent
}: {
  participants: { contract: Contract; companyName: string }[];
  onboardingItems: ContractOnboardingItem[];
  today: string;
  accent: string;
}) {
  const itemsByContract = new Map<string, ContractOnboardingItem[]>();
  for (const i of onboardingItems) {
    const arr = itemsByContract.get(i.contractId) ?? [];
    arr.push(i);
    itemsByContract.set(i.contractId, arr);
  }

  const rows = participants.map(({ contract, companyName }) => {
    const items = itemsByContract.get(contract.id) ?? [];
    let total = 0;
    let done = 0;
    let overdue = 0;
    for (const i of items) {
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
    return {
      contract,
      companyName,
      total,
      done,
      overdue,
      pct: total === 0 ? 0 : Math.round((done / total) * 100)
    };
  });

  if (rows.length === 0) {
    return (
      <section className="liquid-surface p-10 text-center text-sm text-ink-500">
        参加企業がいないためオンボの集計対象がありません
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="text-sm font-semibold text-ink-700">
        参加企業ごとのオンボ進捗
      </div>
      <div className="text-[11px] text-ink-500 -mt-2">
        各社の <code>contract_onboarding_items</code>{" "}
        を集計。詳細は「オンボ詳細」リンクから契約別チェックリストへ
      </div>
      <div className="liquid-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-ink-500 border-b border-ink-100">
              <th className="px-4 py-3 font-medium">企業</th>
              <th className="px-3 py-3 font-medium w-40">進捗</th>
              <th className="px-3 py-3 font-medium">完了/全</th>
              <th className="px-3 py-3 font-medium">期日超過</th>
              <th className="px-3 py-3 font-medium w-32">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.contract.id}
                className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50"
              >
                <td className="px-4 py-3 font-medium">{r.companyName}</td>
                <td className="px-3 py-3">
                  <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden w-32">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${r.pct}%`, background: accent }}
                    />
                  </div>
                  <div className="text-[10px] text-ink-500 mt-0.5">{r.pct}%</div>
                </td>
                <td className="px-3 py-3 tabular-nums text-ink-700">
                  {r.done}/{r.total}
                </td>
                <td className="px-3 py-3 tabular-nums">
                  {r.overdue > 0 ? (
                    <span className="text-rose-600 font-medium">{r.overdue} 件</span>
                  ) : (
                    <span className="text-ink-500">—</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <Link
                    href={`/onboarding/${r.contract.id}`}
                    className="text-[11px] text-ink-700 px-2 py-1 rounded border border-ink-200 hover:bg-ink-50 whitespace-nowrap"
                  >
                    オンボ詳細 →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
