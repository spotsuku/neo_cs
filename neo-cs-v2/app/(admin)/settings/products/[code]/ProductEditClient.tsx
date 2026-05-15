"use client";

import Link from "next/link";
import { useState } from "react";
import { TopNav } from "@/components/nav/TopNav";
import { products, productByCode, ProductCode, productCourses } from "@/lib/master";
import CoursesEditor from "./CoursesEditor";
import { OnboardingTemplateEditor } from "./OnboardingTemplateEditor";
import {
  productOnboardingTemplates,
  OnboardingCategory,
  OnboardingTemplateItem,
  type ActiveContract
} from "@/lib/mock/onboarding";
import {
  sessions as allSessionsData,
  attendanceRecords as allAttendanceData
} from "@/lib/mock/participants";

type Product = (typeof products)[number];

type CompanyLite = { id: string; name: string };

type TabKey =
  | "basic"
  | "courses"
  | "contract"
  | "participants"
  | "onboarding"
  | "sessions";

const tabs: { key: TabKey; label: string }[] = [
  { key: "basic", label: "基本情報" },
  { key: "courses", label: "コース" },
  { key: "contract", label: "契約設定" },
  { key: "participants", label: "参加者" },
  { key: "onboarding", label: "オンボ項目" },
  { key: "sessions", label: "セッション一覧" }
];

export default function ProductEditClient({
  code,
  contracts,
  companies,
  onboardingTemplate,
  canManageOnboarding
}: {
  code: ProductCode;
  contracts: ActiveContract[];
  companies: CompanyLite[];
  onboardingTemplate: import("@/lib/repository/types").OnboardingTemplateCategoryRecord[];
  canManageOnboarding: boolean;
}) {
  const p = productByCode[code];
  const [tab, setTab] = useState<TabKey>("basic");
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const handleSave = () => {
    setSavedToast("保存しました");
    setTimeout(() => setSavedToast(null), 2000);
  };

  return (
    <>
      <TopNav current="/settings" />
      <main className="mx-auto max-w-[1720px] px-6 py-8 space-y-6">
        {/* パンくず */}
        <section>
          <div className="flex items-center gap-2 text-xs text-ink-500 font-medium">
            <Link href="/settings" className="hover:text-ink-700">設定</Link>
            <span>/</span>
            <Link href="/settings/products" className="hover:text-ink-700">研修マスタ</Link>
            <span>/</span>
            <span>{p.shortName}</span>
          </div>
          <div className="mt-1 flex items-end justify-between">
            <div>
              <h1 className="mt-1 text-xl font-bold tracking-tight flex items-center gap-3">
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ background: p.accent }}
                />
                <span style={{ color: p.accent }}>{p.name}</span>
              </h1>
              <div className="mt-1 text-sm text-ink-500">
                {p.type === "continuous" ? "継続型研修" : "単発型研修"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled
                title="準備中"
                className="px-4 py-2 rounded-full bg-white border border-ink-100 text-sm text-ink-400 cursor-not-allowed"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 rounded-full text-white text-sm shadow-liquid hover:opacity-90"
                style={{ background: p.accent }}
              >
                保存
              </button>
            </div>
          </div>
        </section>

        {/* タブ */}
        <section>
          <div className="flex items-center gap-1 border-b border-ink-100">
            {tabs.map((t) => {
              const active = t.key === tab;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={[
                    "px-4 py-2.5 text-sm transition relative",
                    active
                      ? "text-ink-900 font-semibold"
                      : "text-ink-500 hover:text-ink-700"
                  ].join(" ")}
                >
                  {t.label}
                  {active && (
                    <span
                      className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full"
                      style={{ background: p.accent }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* タブコンテンツ */}
        <section>
          {tab === "basic" && <BasicTab product={p} code={code} />}
          {tab === "courses" && <CoursesTab accent={p.accent} code={code} />}
          {tab === "contract" && <ContractTab product={p} />}
          {tab === "participants" && <ParticipantsTab product={p} />}
          {tab === "onboarding" && (
            <OnboardingTemplateEditor
              productCode={code}
              initialTemplate={onboardingTemplate}
              canManage={canManageOnboarding}
              productCourses={(productCourses[code] ?? []).map((c) => ({
                key: c.key,
                shortName: c.shortName
              }))}
            />
          )}
          {tab === "sessions" && (
            <SessionsTab
              accent={p.accent}
              code={code}
              contracts={contracts}
              companies={companies}
            />
          )}
        </section>

        <footer className="pt-8 pb-4 text-center text-[11px] text-ink-500">
          NEO CS v2 — 研修マスタ編集 / ダミーデータ
        </footer>
      </main>
      {savedToast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2 rounded-full bg-ink-900 text-white text-sm shadow-lg">
          {savedToast}
        </div>
      )}
    </>
  );
}

function Field({
  label,
  children,
  hint
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-500 mb-1.5">{label}</label>
      {children}
      {hint && <div className="mt-1 text-[11px] text-ink-500">{hint}</div>}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-xl bg-white border border-ink-100 text-sm text-ink-900 focus:outline-hidden focus:border-ink-300";

function BasicTab({ product, code }: { product: Product; code: ProductCode }) {
  const courseCount = productCourses[code].length;
  return (
    <div className="liquid-surface p-6 grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl">
      <Field label="研修名（正式）">
        <input className={inputCls} defaultValue={product.name} />
      </Field>
      <Field label="短縮名">
        <input className={inputCls} defaultValue={product.shortName} />
      </Field>
      <Field label="タイプ">
        <select className={inputCls} defaultValue={product.type}>
          <option value="continuous">継続型</option>
          <option value="one_shot">単発型</option>
        </select>
      </Field>
      <Field label="カテゴリ">
        <select className={inputCls} defaultValue="leadership">
          <option value="leadership">リーダーシップ</option>
          <option value="community">コミュニティ</option>
          <option value="ai">AI/テクノロジー</option>
          <option value="management">マネジメント</option>
        </select>
      </Field>
      <Field label="アクセントカラー">
        <div className="flex items-center gap-2">
          <input className={inputCls} defaultValue={product.accent} />
          <span
            className="w-8 h-8 rounded-lg border border-ink-100"
            style={{ background: product.accent }}
          />
        </div>
      </Field>
      <Field label="コース数" hint="「コース」タブで編集できます">
        <div
          className="px-3 py-2 rounded-xl bg-ink-50 border border-ink-100 text-sm text-ink-700"
        >
          {courseCount} コース
        </div>
      </Field>
      <div className="md:col-span-2">
        <Field label="説明">
          <textarea
            className={`${inputCls} h-24 resize-none`}
            defaultValue={`${product.name}は${product.type === "continuous" ? "12ヶ月継続型" : "単発型"}の研修プログラムです。`}
          />
        </Field>
      </div>
    </div>
  );
}

function CoursesTab({ accent, code }: { accent: string; code: ProductCode }) {
  // 初期表示は mock の seed (Supabase ドライバ時は CoursesEditor 内で listCoursesAction が DB の真値で上書きする)
  const initial = productCourses[code].map((c, idx) => ({
    productCode: code,
    courseKey: c.key,
    name: c.name,
    shortName: c.shortName,
    description: c.description,
    displayOrder: idx + 1
  }));
  return <CoursesEditor productCode={code} initialCourses={initial} accent={accent} />;
}

function ContractTab({ product }: { product: Product }) {
  return (
    <div className="liquid-surface p-6 grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl">
      <Field label="契約期間（ヶ月）" hint="継続型の場合のみ有効">
        <input
          className={inputCls}
          type="text"
          defaultValue={product.billingMonths ?? ""}
        />
      </Field>
      <Field label="自動更新">
        <select className={inputCls} defaultValue="true">
          <option value="true">有効</option>
          <option value="false">無効</option>
        </select>
      </Field>
      <Field label="更新リードタイム（日）" hint="契約終了の何日前から更新フローを開始するか">
        <input className={inputCls} type="text" defaultValue="90" />
      </Field>
      <Field label="請求サイクル">
        <select className={inputCls} defaultValue="annual">
          <option value="annual">年次一括</option>
          <option value="quarterly">四半期</option>
          <option value="monthly">月次</option>
        </select>
      </Field>
      <Field label="解約予告期間（日）">
        <input className={inputCls} type="text" defaultValue="60" />
      </Field>
      <Field label="価格（税別・参考）">
        <input className={inputCls} type="text" defaultValue="3,600,000" />
      </Field>
    </div>
  );
}

function ParticipantsTab({ product }: { product: Product }) {
  return (
    <div className="liquid-surface p-6 grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl">
      <Field label="参加枠デフォルト（名/社）" hint="participant_cap_default">
        <input
          className={inputCls}
          type="text"
          defaultValue={product.participantCap ?? ""}
        />
      </Field>
      <Field label="追加枠の可否">
        <select className={inputCls} defaultValue="true">
          <option value="true">可（有償）</option>
          <option value="false">不可</option>
        </select>
      </Field>
      <Field label="途中参加の可否">
        <select className={inputCls} defaultValue="false">
          <option value="true">可</option>
          <option value="false">不可</option>
        </select>
      </Field>
      <Field label="途中交代の可否">
        <select className={inputCls} defaultValue="true">
          <option value="true">可</option>
          <option value="false">不可</option>
        </select>
      </Field>
      <Field label="参加者最低年齢">
        <input className={inputCls} type="text" defaultValue="—" />
      </Field>
      <Field label="参加条件">
        <textarea
          className={`${inputCls} h-24 resize-none`}
          defaultValue="次世代リーダー候補（課長〜部長級）"
        />
      </Field>
    </div>
  );
}


const assigneeRoleOptions: { value: NonNullable<OnboardingTemplateItem["defaultAssigneeRole"]>; label: string }[] = [
  { value: "cs", label: "CS" },
  { value: "pr", label: "広報" },
  { value: "ops", label: "運営" },
  { value: "finance", label: "経理" }
];

function OnboardingTab({ accent, code }: { accent: string; code: ProductCode }) {
  const [categories, setCategories] = useState<OnboardingCategory[]>(() =>
    // deep copy so initial mock isn't mutated
    JSON.parse(JSON.stringify(productOnboardingTemplates[code]))
  );
  // この事業に複数コースがある場合のみ「対象コース」列を表示
  const courses = productCourses[code] ?? [];
  const showCourseSelector = courses.length > 1;

  const updateCategory = (catIdx: number, patch: Partial<OnboardingCategory>) => {
    setCategories((cs) => cs.map((c, i) => (i === catIdx ? { ...c, ...patch } : c)));
  };

  const moveCategory = (catIdx: number, dir: -1 | 1) => {
    setCategories((cs) => {
      const next = [...cs];
      const target = catIdx + dir;
      if (target < 0 || target >= next.length) return cs;
      [next[catIdx], next[target]] = [next[target], next[catIdx]];
      return next.map((c, i) => ({ ...c, order: i + 1 }));
    });
  };

  const removeCategory = (catIdx: number) => {
    setCategories((cs) => cs.filter((_, i) => i !== catIdx));
  };

  const addCategory = () => {
    setCategories((cs) => [
      ...cs,
      {
        key: `new-${Date.now()}`,
        label: "新規カテゴリ",
        order: cs.length + 1,
        items: []
      }
    ]);
  };

  const updateItem = (catIdx: number, itemIdx: number, patch: Partial<OnboardingTemplateItem>) => {
    setCategories((cs) =>
      cs.map((c, i) =>
        i === catIdx
          ? {
              ...c,
              items: c.items.map((it, j) => (j === itemIdx ? { ...it, ...patch } : it))
            }
          : c
      )
    );
  };

  const removeItem = (catIdx: number, itemIdx: number) => {
    setCategories((cs) =>
      cs.map((c, i) =>
        i === catIdx ? { ...c, items: c.items.filter((_, j) => j !== itemIdx) } : c
      )
    );
  };

  const addItem = (catIdx: number) => {
    setCategories((cs) =>
      cs.map((c, i) =>
        i === catIdx
          ? {
              ...c,
              items: [
                ...c.items,
                {
                  key: `new-${Date.now()}`,
                  name: "新規項目",
                  dueOffsetDays: 0,
                  required: false,
                  defaultAssigneeRole: "cs"
                }
              ]
            }
          : c
      )
    );
  };

  return (
    <div className="space-y-4">
      <div className="liquid-surface p-5 bg-ink-50/40">
        <div className="text-xs text-ink-700 leading-relaxed">
          「内諾から契約開始までに完了すべきチェックリスト」のテンプレート。契約発生時にこのテンプレから自動展開されます
        </div>
      </div>

      <div className="space-y-4">
        {categories.map((cat, catIdx) => (
          <div key={cat.key} className="liquid-surface p-5">
            {/* カテゴリヘッダ */}
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: `${accent}14`, color: accent }}
              >
                {catIdx + 1}
              </span>
              <input
                className={`${inputCls} py-1.5! max-w-xs font-semibold`}
                value={cat.label}
                onChange={(e) => updateCategory(catIdx, { label: e.target.value })}
              />
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => moveCategory(catIdx, -1)}
                  className="w-7 h-7 rounded-full border border-ink-100 text-xs text-ink-700 hover:bg-ink-50 disabled:opacity-30"
                  disabled={catIdx === 0}
                  aria-label="上へ"
                >
                  ▲
                </button>
                <button
                  onClick={() => moveCategory(catIdx, 1)}
                  className="w-7 h-7 rounded-full border border-ink-100 text-xs text-ink-700 hover:bg-ink-50 disabled:opacity-30"
                  disabled={catIdx === categories.length - 1}
                  aria-label="下へ"
                >
                  ▼
                </button>
                <button
                  onClick={() => removeCategory(catIdx)}
                  className="w-7 h-7 rounded-full border border-ink-100 text-xs text-rose-500 hover:bg-rose-50"
                  aria-label="カテゴリ削除"
                >
                  ×
                </button>
              </div>
            </div>

            {/* 項目テーブル */}
            <div className="mt-4 overflow-hidden rounded-xl border border-ink-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] text-ink-500 bg-ink-50 border-b border-ink-100">
                    <th className="px-3 py-2.5 font-medium">項目名</th>
                    <th className="px-3 py-2.5 font-medium w-32">期日オフセット(日)</th>
                    <th className="px-3 py-2.5 font-medium w-20">必須</th>
                    <th className="px-3 py-2.5 font-medium w-32">デフォルト担当</th>
                    {showCourseSelector && (
                      <th className="px-3 py-2.5 font-medium w-36">対象コース</th>
                    )}
                    <th className="px-3 py-2.5 font-medium w-14"></th>
                  </tr>
                </thead>
                <tbody>
                  {cat.items.map((it, itemIdx) => (
                    <tr key={itemIdx} className="border-b border-ink-50 last:border-0">
                      <td className="px-3 py-2">
                        <textarea
                          className={`${inputCls} py-1.5! h-9 resize-none`}
                          value={it.name}
                          onChange={(e) => updateItem(catIdx, itemIdx, { name: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          className={`${inputCls} py-1.5!`}
                          value={it.dueOffsetDays}
                          onChange={(e) =>
                            updateItem(catIdx, itemIdx, { dueOffsetDays: Number(e.target.value) })
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={it.required}
                          onChange={(e) =>
                            updateItem(catIdx, itemIdx, { required: e.target.checked })
                          }
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          className={`${inputCls} py-1.5!`}
                          value={it.defaultAssigneeRole ?? "cs"}
                          onChange={(e) =>
                            updateItem(catIdx, itemIdx, {
                              defaultAssigneeRole: e.target.value as OnboardingTemplateItem["defaultAssigneeRole"]
                            })
                          }
                        >
                          {assigneeRoleOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      {showCourseSelector && (
                        <td className="px-3 py-2">
                          <select
                            className={`${inputCls} py-1.5!`}
                            value={it.courseKey ?? ""}
                            onChange={(e) =>
                              updateItem(catIdx, itemIdx, {
                                courseKey: e.target.value === "" ? null : e.target.value
                              })
                            }
                          >
                            <option value="">全コース共通</option>
                            {courses.map((c) => (
                              <option key={c.key} value={c.key}>
                                {c.shortName ?? c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => removeItem(catIdx, itemIdx)}
                          className="text-rose-500 text-sm hover:underline"
                          aria-label="削除"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                  {cat.items.length === 0 && (
                    <tr>
                      <td colSpan={showCourseSelector ? 6 : 5} className="px-3 py-4 text-center text-xs text-ink-500">
                        項目がありません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3">
              <button
                onClick={() => addItem(catIdx)}
                className="w-full px-3 py-2 rounded-lg text-xs text-ink-500 hover:bg-ink-50 border border-dashed border-ink-100"
              >
                + 項目を追加
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={addCategory}
          className="w-full px-4 py-3 rounded-xl text-sm text-ink-700 hover:bg-ink-50 border border-dashed border-ink-200 bg-white"
        >
          + カテゴリを追加
        </button>
      </div>

      {/* フッタ */}
      <div className="liquid-surface p-4 flex items-center justify-end gap-2">
        <button
          type="button"
          disabled
          title="準備中"
          className="px-4 py-2 rounded-full bg-white border border-ink-100 text-sm text-ink-400 cursor-not-allowed"
        >
          キャンセル
        </button>
        <button
          type="button"
          disabled
          title="準備中: オンボテンプレの保存は別途実装予定"
          className="px-4 py-2 rounded-full text-white text-sm bg-ink-300 cursor-not-allowed"
        >
          保存（準備中）
        </button>
        <button
          type="button"
          disabled
          title="準備中"
          className="px-4 py-2 rounded-full bg-white border border-ink-100 text-sm text-ink-400 cursor-not-allowed"
        >
          既存契約に反映（準備中）
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// セッション一覧
// ─────────────────────────────────────────────

function SessionsTab({
  accent,
  code,
  contracts,
  companies
}: {
  accent: string;
  code: ProductCode;
  contracts: ActiveContract[];
  companies: CompanyLite[];
}) {
  const productContracts = contracts.filter((c) => c.product === code);
  const productContractIds = new Set(productContracts.map((c) => c.id));
  const productSessions = allSessionsData
    .filter((s) => productContractIds.has(s.contractId))
    .sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : 1));

  if (productSessions.length === 0) {
    return (
      <div className="liquid-surface p-10 text-center text-sm text-ink-500">
        この研修にはまだセッションが登録されていません
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="liquid-surface p-5 bg-ink-50/40 text-xs text-ink-700">
        この研修の全契約に紐づくセッションの一覧です。クリックで /attendance に遷移します
      </div>

      <div className="liquid-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-ink-500 bg-ink-50 border-b border-ink-100">
              <th className="px-4 py-2.5 font-medium">日付</th>
              <th className="px-3 py-2.5 font-medium">企業 / セッション</th>
              <th className="px-3 py-2.5 font-medium w-24">対象者</th>
              <th className="px-3 py-2.5 font-medium w-28">記録状況</th>
              <th className="px-3 py-2.5 font-medium w-24">出席率</th>
              <th className="px-3 py-2.5 font-medium w-20"></th>
            </tr>
          </thead>
          <tbody>
            {productSessions.map((s) => {
              const contract = productContracts.find((c) => c.id === s.contractId);
              const co = contract
                ? companies.find((x) => x.id === contract.companyId)
                : undefined;
              const expected = s.expectedParticipantIds.length;
              const recsForSession = allAttendanceData.filter(
                (r) => r.sessionId === s.id
              );
              const recorded = recsForSession.length;
              const attendedCount = recsForSession.filter(
                (r) => r.status === "present" || r.status === "late"
              ).length;
              const rate =
                expected === 0
                  ? 0
                  : attendedCount /
                    Math.max(expected, recorded > 0 ? recorded : expected);
              return (
                <tr
                  key={s.id}
                  className="border-b border-ink-50 last:border-0 hover:bg-ink-50/40"
                >
                  <td className="px-4 py-2.5 text-ink-700 whitespace-nowrap">
                    {s.scheduledAt}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-ink-900 font-medium">
                      {co?.name ?? contract?.companyId ?? "—"}
                    </div>
                    <div className="text-[11px] text-ink-500">
                      第{s.sessionNumber}回 ・ {s.title}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-ink-700">{expected} 名</td>
                  <td className="px-3 py-2.5">
                    {s.completedAt ? (
                      recorded > 0 ? (
                        <span
                          className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                          style={{ background: "#10B98114", color: "#10B981" }}
                        >
                          記録済
                        </span>
                      ) : (
                        <span
                          className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                          style={{ background: "#EF444414", color: "#EF4444" }}
                        >
                          未記録
                        </span>
                      )
                    ) : (
                      <span
                        className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                        style={{ background: "#94A3B814", color: "#64748B" }}
                      >
                        予定
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-ink-700">
                    {recorded > 0 ? `${Math.round(rate * 100)}%` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Link
                      href={`/attendance?sessionId=${s.id}`}
                      className="text-xs hover:underline whitespace-nowrap"
                      style={{ color: accent }}
                    >
                      入力 →
                    </Link>
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
