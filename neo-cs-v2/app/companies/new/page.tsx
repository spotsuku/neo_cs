"use client";

// 企業登録ウィザード (1問〜数問単位の順次入力 + 確認 → 一括保存)
//
// 設計:
//   - Step 1: 法人情報 / Step 2: 担当窓口 / Step 3: 契約 / Step 4: アサイン / Step 5: 確認
//   - 各 Step でバリデーション (errors) を出し、進める時のみ次へ遷移
//   - 進行中は localStorage に下書き保存 (useDraftPersistence)
//   - 確認 Step で saveCompanyWizard (Server Action) を呼んで一括作成
//   - 保存後 /companies/[id] へリダイレクト
//   - mock / supabase 両ドライバで動作 (REPO_DRIVER 切替時もそのまま)

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { useDraftPersistence } from "@/lib/hooks/useDraftPersistence";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useActiveMembers } from "@/lib/hooks/useActiveMembers";
import {
  saveCompanyWizard,
  type WizardSavePayload
} from "./actions";
import type { ProductCode, AssignmentRole } from "@/lib/repository/types";

// ─────────────────────────────────────────────
// 選択肢マスタ
// ─────────────────────────────────────────────
const industries = [
  "IT・ソフトウェア",
  "製造業",
  "小売・流通",
  "金融・保険",
  "建設・不動産",
  "医療・福祉",
  "教育",
  "コンサルティング",
  "鉄道・運輸",
  "卸売",
  "その他"
];

const employeeSizes = [
  "1〜50名",
  "51〜100名",
  "101〜300名",
  "301〜500名",
  "501〜1000名",
  "1001名以上"
];

const productOptions: { code: ProductCode; label: string }[] = [
  { code: "academia", label: "アカデミア" },
  { code: "hyogikai", label: "評議会" },
  { code: "aiken", label: "AI研" },
  { code: "commu", label: "コミュ" }
];

const contractDurationOptions = [
  { value: "6", label: "6ヶ月" },
  { value: "12", label: "12ヶ月 (1年)" },
  { value: "24", label: "24ヶ月 (2年)" },
  { value: "36", label: "36ヶ月 (3年)" }
];

// ─────────────────────────────────────────────
// 型
// ─────────────────────────────────────────────
type ContractDraft = {
  product: ProductCode | "";
  startDate: string;
  durationMonths: string; // "6" | "12" | "24" | "36" | "" (=スキップ)
  annualRevenue: string;  // 円, カンマOK
  participants: string;
};

type AssignmentDraft = {
  primaryUserId: string;
  secondaryUserId: string;
  salesOwnerUserId: string;
};

type FormState = {
  // Step 1
  name: string;
  kana: string;
  corporateNumber: string;
  industry: string;
  employeeSize: string;
  websiteUrl: string;
  foundedYear: string;
  address: string;
  // Step 2
  contactName: string;
  contactTitle: string;
  contactDept: string;
  contactEmail: string;
  contactTel: string;
  slackChannel: string;
  // Step 3
  contractsSkipped: boolean;
  contracts: ContractDraft[];
  // Step 4
  assignmentsSkipped: boolean;
  assignment: AssignmentDraft;
  // Step 5
  memo: string;
  /**
   * 0019_is_demo_flag.sql: 本番運用前のダミーデータかどうか。
   * 本番開始前は true 既定。本番開始後はこの初期値を false に変更する。
   */
  isDemo: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  kana: "",
  corporateNumber: "",
  industry: "",
  employeeSize: "",
  websiteUrl: "",
  foundedYear: "",
  address: "",
  contactName: "",
  contactTitle: "",
  contactDept: "",
  contactEmail: "",
  contactTel: "",
  slackChannel: "",
  contractsSkipped: false,
  contracts: [
    {
      product: "",
      startDate: "",
      durationMonths: "12",
      annualRevenue: "",
      participants: ""
    }
  ],
  assignmentsSkipped: false,
  assignment: {
    primaryUserId: "",
    secondaryUserId: "",
    salesOwnerUserId: ""
  },
  memo: "",
  // 本番開始前: true 既定 (デモデータとして登録)
  // 本番開始後: ここを false に切り替えれば全件本データとして入る
  isDemo: true
};

type SaveState = "idle" | "saving" | "saved" | "error";

const STEP_TITLES = [
  "法人情報",
  "担当窓口",
  "契約情報",
  "CS / 営業アサイン",
  "確認 & 保存"
] as const;

// ─────────────────────────────────────────────
// 共通スタイル
// ─────────────────────────────────────────────
const inputCls =
  "w-full px-3 py-2 rounded-lg border border-ink-100 text-sm focus:outline-none focus:border-ink-300";
const labelCls = "block text-xs text-ink-500 font-medium mb-1";

// ─────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────
function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[, ¥\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function addMonths(dateIso: string, months: number): string {
  if (!dateIso) return "";
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return "";
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function isValidEmail(s: string): boolean {
  if (!s) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// ─────────────────────────────────────────────
// メイン
// ─────────────────────────────────────────────
export default function NewCompanyWizardPage() {
  const router = useRouter();
  const { members, ready: membersReady } = useActiveMembers();

  // localStorage からの初期復元 (useState lazy initializer = 1回だけ実行)
  const computeInitial = (): {
    form: FormState;
    step: number;
    restored: boolean;
  } => {
    if (typeof window === "undefined") {
      return { form: EMPTY_FORM, step: 1, restored: false };
    }
    try {
      const raw = window.localStorage.getItem("neo-cs:draft:company:new:wizard");
      if (!raw) return { form: EMPTY_FORM, step: 1, restored: false };
      const env = JSON.parse(raw) as {
        payload?: { step?: number; form?: FormState };
      };
      const payload = env?.payload;
      if (!payload?.form) return { form: EMPTY_FORM, step: 1, restored: false };
      return {
        form: { ...EMPTY_FORM, ...payload.form },
        step: Math.min(Math.max(payload.step ?? 1, 1), STEP_TITLES.length),
        restored: true
      };
    } catch {
      return { form: EMPTY_FORM, step: 1, restored: false };
    }
  };

  const [step, setStep] = useState<number>(() => computeInitial().step);
  const [form, setForm] = useState<FormState>(() => computeInitial().form);
  const [dirty, setDirty] = useState<boolean>(() => computeInitial().restored);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [stepErrors, setStepErrors] = useState<string[]>([]);
  const restoredRef = useRef(false);

  const draftKey = "company:new:wizard";
  const { savedAt: localSavedAt, restore, markClean } = useDraftPersistence(
    draftKey,
    { step, form },
    dirty
  );

  // useDraftPersistence の savedAt を初回表示するため、restore を呼んで cacheに反映
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (dirty) restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── パッチユーティリティ ──
  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }
  function patchContract(idx: number, p: Partial<ContractDraft>) {
    setForm((f) => {
      const next = [...f.contracts];
      next[idx] = { ...next[idx], ...p };
      return { ...f, contracts: next };
    });
    setDirty(true);
  }
  function addContract() {
    setForm((f) => ({
      ...f,
      contracts: [
        ...f.contracts,
        {
          product: "",
          startDate: "",
          durationMonths: "12",
          annualRevenue: "",
          participants: ""
        }
      ]
    }));
    setDirty(true);
  }
  function removeContract(idx: number) {
    setForm((f) => ({
      ...f,
      contracts: f.contracts.filter((_, i) => i !== idx)
    }));
    setDirty(true);
  }
  function patchAssignment(p: Partial<AssignmentDraft>) {
    setForm((f) => ({ ...f, assignment: { ...f.assignment, ...p } }));
    setDirty(true);
  }

  // ── ステップ毎のバリデーション ──
  function validateStep(s: number): string[] {
    const errs: string[] = [];
    if (s === 1) {
      if (!form.name.trim()) errs.push("会社名は必須です");
      if (form.foundedYear && !/^\d{4}$/.test(form.foundedYear))
        errs.push("設立年は4桁の西暦で入力してください");
      if (form.websiteUrl && !/^https?:\/\//i.test(form.websiteUrl))
        errs.push("公式URLは http(s):// から始めてください");
    } else if (s === 2) {
      // 全項目任意。メール書式のみチェック
      if (!isValidEmail(form.contactEmail))
        errs.push("メールアドレスの形式が不正です");
    } else if (s === 3) {
      if (!form.contractsSkipped) {
        form.contracts.forEach((c, i) => {
          if (!c.product) errs.push(`契約${i + 1}: 研修プロダクトを選択してください`);
          if (!c.startDate) errs.push(`契約${i + 1}: 契約開始日を入力してください`);
        });
      }
    } else if (s === 4) {
      // 全任意
    }
    return errs;
  }

  function goNext() {
    const errs = validateStep(step);
    setStepErrors(errs);
    if (errs.length > 0) return;
    setStep((s) => Math.min(s + 1, STEP_TITLES.length));
  }
  function goBack() {
    setStepErrors([]);
    setStep((s) => Math.max(s - 1, 1));
  }

  // ── 保存 ──
  async function handleSave() {
    const errs = validateStep(1);
    if (errs.length > 0) {
      setStep(1);
      setStepErrors(errs);
      return;
    }
    setSaveState("saving");
    setSaveError(null);

    const primaryUser = members.find(
      (m) => m.id === form.assignment.primaryUserId
    );

    const contracts = form.contractsSkipped
      ? []
      : form.contracts
          .filter((c) => c.product && c.startDate)
          .map((c) => {
            const months = Number(c.durationMonths || "12");
            return {
              product: c.product as ProductCode,
              startDate: c.startDate,
              endDate: months ? addMonths(c.startDate, months) : undefined,
              annualRevenueJpy: c.annualRevenue
                ? parseAmount(c.annualRevenue)
                : undefined,
              participants: c.participants
                ? Number(c.participants) || 0
                : undefined
            };
          });

    const assignments: WizardSavePayload["assignments"] = [];
    if (!form.assignmentsSkipped) {
      const push = (userId: string, role: AssignmentRole) => {
        if (userId) assignments.push({ userId, role });
      };
      push(form.assignment.primaryUserId, "primary");
      push(form.assignment.secondaryUserId, "secondary");
      push(form.assignment.salesOwnerUserId, "sales_owner");
    }

    const payload: WizardSavePayload = {
      company: {
        name: form.name,
        kana: form.kana,
        industry: form.industry,
        employeeSize: form.employeeSize,
        address: form.address,
        websiteUrl: form.websiteUrl,
        foundedYear: form.foundedYear,
        corporateNumber: form.corporateNumber,
        memo: form.memo,
        isDemo: form.isDemo
      },
      contact: form.contactName.trim()
        ? {
            name: form.contactName,
            department: form.contactDept,
            title: form.contactTitle,
            email: form.contactEmail,
            tel: form.contactTel,
            slackChannel: form.slackChannel
          }
        : undefined,
      contracts,
      assignments,
      primaryOwnerName: primaryUser?.name
    };

    const result = await saveCompanyWizard(payload);
    if (result.ok) {
      setSaveState("saved");
      setDirty(false);
      markClean();
      router.push(`/companies/${result.companyId}`);
    } else {
      setSaveState("error");
      setSaveError(result.error);
    }
  }

  function handleCancelClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (dirty) {
      e.preventDefault();
      setCancelConfirmOpen(true);
    }
  }

  // ── 進捗バー ──
  const progressPct = useMemo(
    () => Math.round((step / STEP_TITLES.length) * 100),
    [step]
  );

  return (
    <>
      <TopNav current="/companies" />
      <main className="mx-auto max-w-[900px] px-6 py-8 space-y-6">
        {/* ヘッダー */}
        <div className="space-y-2">
          <div className="text-xs text-ink-500">
            <Link href="/companies" className="hover:text-ink-700">
              企業
            </Link>
            <span className="mx-1">/</span>
            <span>新規追加</span>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-ink-900">
                企業を追加 — ステップ {step} / {STEP_TITLES.length}
              </h1>
              <p className="text-sm text-ink-500 mt-1">
                {STEP_TITLES[step - 1]}
              </p>
            </div>
            <SaveStatus
              state={saveState}
              error={saveError}
              localSavedAt={localSavedAt}
            />
          </div>

          {/* 進捗バー */}
          <div className="space-y-1">
            <div className="h-1.5 w-full rounded-full bg-ink-50 overflow-hidden">
              <div
                className="h-full bg-ink-900 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <ol className="flex justify-between text-[11px] text-ink-500">
              {STEP_TITLES.map((t, i) => {
                const idx = i + 1;
                const isCurrent = step === idx;
                const isDone = step > idx;
                return (
                  <li
                    key={t}
                    className={`${
                      isCurrent
                        ? "text-ink-900 font-medium"
                        : isDone
                        ? "text-emerald-600"
                        : ""
                    }`}
                  >
                    {isDone ? "✓ " : ""}
                    {idx}. {t}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        {/* エラー */}
        {stepErrors.length > 0 && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 space-y-0.5">
            {stepErrors.map((e, i) => (
              <div key={i}>• {e}</div>
            ))}
          </div>
        )}

        {/* ステップ本体 */}
        <section className="liquid-surface p-6 space-y-5">
          {step === 1 && <Step1 form={form} patch={patch} />}
          {step === 2 && <Step2 form={form} patch={patch} />}
          {step === 3 && (
            <Step3
              form={form}
              patch={patch}
              patchContract={patchContract}
              addContract={addContract}
              removeContract={removeContract}
            />
          )}
          {step === 4 && (
            <Step4
              form={form}
              patch={patch}
              patchAssignment={patchAssignment}
              members={members}
              membersReady={membersReady}
            />
          )}
          {step === 5 && (
            <Step5 form={form} members={members} patch={patch} />
          )}
        </section>

        {/* ナビゲーション */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link
            href="/companies"
            onClick={handleCancelClick}
            className="px-4 py-2 rounded-full border border-ink-100 text-sm text-ink-700 hover:bg-ink-50"
          >
            キャンセル
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 1}
              className="px-4 py-2 rounded-full border border-ink-100 text-sm text-ink-700 hover:bg-ink-50 disabled:opacity-40"
            >
              ← 戻る
            </button>
            {step < STEP_TITLES.length ? (
              <button
                type="button"
                onClick={goNext}
                className="px-5 py-2 rounded-full bg-ink-900 text-white text-sm hover:bg-ink-700 shadow-liquid"
              >
                次へ →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={saveState === "saving" || saveState === "saved"}
                className="px-5 py-2 rounded-full bg-ink-900 text-white text-sm hover:bg-ink-700 shadow-liquid disabled:opacity-50"
              >
                {saveState === "saving" ? "保存中..." : "保存して企業を作成"}
              </button>
            )}
          </div>
        </div>

        <ConfirmDialog
          open={cancelConfirmOpen}
          title="編集中の内容を破棄しますか?"
          description="保存していない変更はすべて失われます。下書きの自動保存もクリアされます。"
          confirmLabel="破棄してキャンセル"
          tone="danger"
          onCancel={() => setCancelConfirmOpen(false)}
          onConfirm={() => {
            markClean();
            setDirty(false);
            setCancelConfirmOpen(false);
            router.push("/companies");
          }}
        />

        <footer className="pt-4 pb-4 text-center text-[11px] text-ink-500">
          NEO CS v3 — 企業登録ウィザード
        </footer>
      </main>
    </>
  );
}

// ─────────────────────────────────────────────
// Step 1: 法人情報
// ─────────────────────────────────────────────
function Step1({
  form,
  patch
}: {
  form: FormState;
  patch: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-ink-900">法人情報</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className={labelCls}>
            会社名 <span className="text-rose-500">*</span>
          </label>
          <input
            className={inputCls}
            placeholder="株式会社サンプル"
            value={form.name}
            onChange={(e) => patch("name", e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className={labelCls}>カナ</label>
          <input
            className={inputCls}
            placeholder="カブシキガイシャサンプル"
            value={form.kana}
            onChange={(e) => patch("kana", e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>法人番号 (13桁)</label>
          <input
            className={inputCls}
            placeholder="1234567890123"
            value={form.corporateNumber}
            onChange={(e) => patch("corporateNumber", e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>業種</label>
          <select
            className={inputCls}
            value={form.industry}
            onChange={(e) => patch("industry", e.target.value)}
          >
            <option value="">選択してください</option>
            {industries.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>従業員規模</label>
          <select
            className={inputCls}
            value={form.employeeSize}
            onChange={(e) => patch("employeeSize", e.target.value)}
          >
            <option value="">選択してください</option>
            {employeeSizes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>公式URL</label>
          <input
            className={inputCls}
            type="url"
            placeholder="https://example.com"
            value={form.websiteUrl}
            onChange={(e) => patch("websiteUrl", e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>設立年</label>
          <input
            className={inputCls}
            type="number"
            placeholder="2015"
            value={form.foundedYear}
            onChange={(e) => patch("foundedYear", e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>所在地</label>
          <input
            className={inputCls}
            placeholder="東京都渋谷区..."
            value={form.address}
            onChange={(e) => patch("address", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 2: 担当窓口
// ─────────────────────────────────────────────
function Step2({
  form,
  patch
}: {
  form: FormState;
  patch: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-ink-900">担当窓口 (任意)</h2>
      <p className="text-xs text-ink-500">
        企業側の主担当者を1名登録します。後から /companies/[id] で追加できます。
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>氏名</label>
          <input
            className={inputCls}
            placeholder="山田 太郎"
            value={form.contactName}
            onChange={(e) => patch("contactName", e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className={labelCls}>役職</label>
          <input
            className={inputCls}
            placeholder="人事部長"
            value={form.contactTitle}
            onChange={(e) => patch("contactTitle", e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>部署</label>
          <input
            className={inputCls}
            placeholder="人事部"
            value={form.contactDept}
            onChange={(e) => patch("contactDept", e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>メール</label>
          <input
            className={inputCls}
            type="email"
            placeholder="taro@example.com"
            value={form.contactEmail}
            onChange={(e) => patch("contactEmail", e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>電話</label>
          <input
            className={inputCls}
            type="tel"
            placeholder="03-1234-5678"
            value={form.contactTel}
            onChange={(e) => patch("contactTel", e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Slack ID / 連携チャンネル</label>
          <input
            className={inputCls}
            placeholder="#cs-sample-corp / @taro"
            value={form.slackChannel}
            onChange={(e) => patch("slackChannel", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 3: 契約情報 (任意)
// ─────────────────────────────────────────────
function Step3({
  form,
  patch,
  patchContract,
  addContract,
  removeContract
}: {
  form: FormState;
  patch: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  patchContract: (idx: number, p: Partial<ContractDraft>) => void;
  addContract: () => void;
  removeContract: (idx: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink-900">契約情報 (任意)</h2>
        <label className="inline-flex items-center gap-2 text-xs text-ink-700">
          <input
            type="checkbox"
            checked={form.contractsSkipped}
            onChange={(e) => patch("contractsSkipped", e.target.checked)}
          />
          営業未確定のためスキップ
        </label>
      </div>

      {form.contractsSkipped ? (
        <div className="rounded-lg border border-dashed border-ink-100 p-4 text-xs text-ink-500">
          契約情報の登録をスキップします。後から /companies/[id] で追加できます。
        </div>
      ) : (
        <div className="space-y-4">
          {form.contracts.map((c, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-ink-100 p-4 space-y-3 bg-ink-50/40"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-ink-700">
                  契約 #{idx + 1}
                </h3>
                {form.contracts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeContract(idx)}
                    className="text-[11px] text-rose-600 hover:underline"
                  >
                    削除
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>
                    プロダクト / コース{" "}
                    <span className="text-rose-500">*</span>
                  </label>
                  <select
                    className={inputCls}
                    value={c.product}
                    onChange={(e) =>
                      patchContract(idx, {
                        product: e.target.value as ProductCode | ""
                      })
                    }
                  >
                    <option value="">選択してください</option>
                    {productOptions.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>
                    契約開始日 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className={inputCls}
                    type="date"
                    value={c.startDate}
                    onChange={(e) =>
                      patchContract(idx, { startDate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className={labelCls}>契約期間</label>
                  <select
                    className={inputCls}
                    value={c.durationMonths}
                    onChange={(e) =>
                      patchContract(idx, { durationMonths: e.target.value })
                    }
                  >
                    {contractDurationOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>契約金額 (年額・円)</label>
                  <input
                    className={inputCls}
                    placeholder="3,600,000"
                    value={c.annualRevenue}
                    onChange={(e) =>
                      patchContract(idx, { annualRevenue: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className={labelCls}>参加者数</label>
                  <input
                    className={inputCls}
                    type="number"
                    placeholder="20"
                    value={c.participants}
                    onChange={(e) =>
                      patchContract(idx, { participants: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addContract}
            className="text-xs text-ink-700 hover:underline"
          >
            + 契約をもう1件追加
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 4: アサイン
// ─────────────────────────────────────────────
function Step4({
  form,
  patch,
  patchAssignment,
  members,
  membersReady
}: {
  form: FormState;
  patch: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  patchAssignment: (p: Partial<AssignmentDraft>) => void;
  members: ReturnType<typeof useActiveMembers>["members"];
  membersReady: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink-900">
          CS / 営業アサイン (任意)
        </h2>
        <label className="inline-flex items-center gap-2 text-xs text-ink-700">
          <input
            type="checkbox"
            checked={form.assignmentsSkipped}
            onChange={(e) => patch("assignmentsSkipped", e.target.checked)}
          />
          スキップ (後で /companies/[id] でアサイン)
        </label>
      </div>
      {!membersReady && (
        <div className="text-xs text-ink-500">メンバー一覧を読込中...</div>
      )}
      {!form.assignmentsSkipped && membersReady && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectMember
            label="CS 主担当 (primary)"
            value={form.assignment.primaryUserId}
            onChange={(v) => patchAssignment({ primaryUserId: v })}
            members={members}
          />
          <SelectMember
            label="CS 副担当 (secondary)"
            value={form.assignment.secondaryUserId}
            onChange={(v) => patchAssignment({ secondaryUserId: v })}
            members={members}
          />
          <SelectMember
            label="営業オーナー (sales_owner)"
            value={form.assignment.salesOwnerUserId}
            onChange={(v) => patchAssignment({ salesOwnerUserId: v })}
            members={members}
          />
        </div>
      )}
    </div>
  );
}

function SelectMember({
  label,
  value,
  onChange,
  members
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  members: ReturnType<typeof useActiveMembers>["members"];
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <select
        className={inputCls}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">未割当</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} ({m.role})
          </option>
        ))}
      </select>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 5: 確認
// ─────────────────────────────────────────────
function Step5({
  form,
  members,
  patch
}: {
  form: FormState;
  members: ReturnType<typeof useActiveMembers>["members"];
  patch: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  const memberName = (id: string) =>
    members.find((m) => m.id === id)?.name ?? "—";
  const productLabel = (code: string) =>
    productOptions.find((p) => p.code === code)?.label ?? code;

  return (
    <div className="space-y-5 text-sm">
      <h2 className="text-sm font-semibold text-ink-900">登録内容の確認</h2>

      <Section title="法人情報">
        <Row label="会社名" value={form.name} required />
        <Row label="カナ" value={form.kana} />
        <Row label="法人番号" value={form.corporateNumber} />
        <Row label="業種" value={form.industry} />
        <Row label="従業員規模" value={form.employeeSize} />
        <Row label="公式URL" value={form.websiteUrl} />
        <Row label="設立年" value={form.foundedYear} />
        <Row label="所在地" value={form.address} />
      </Section>

      <Section title="担当窓口">
        {form.contactName.trim() ? (
          <>
            <Row label="氏名" value={form.contactName} />
            <Row label="役職" value={form.contactTitle} />
            <Row label="部署" value={form.contactDept} />
            <Row label="メール" value={form.contactEmail} />
            <Row label="電話" value={form.contactTel} />
            <Row label="Slack" value={form.slackChannel} />
          </>
        ) : (
          <p className="text-xs text-ink-500">登録なし</p>
        )}
      </Section>

      <Section title="契約情報">
        {form.contractsSkipped || form.contracts.length === 0 ? (
          <p className="text-xs text-ink-500">スキップ</p>
        ) : (
          <ul className="space-y-2">
            {form.contracts
              .filter((c) => c.product)
              .map((c, i) => (
                <li
                  key={i}
                  className="rounded border border-ink-100 p-3 bg-white text-xs space-y-0.5"
                >
                  <div className="font-medium text-ink-900">
                    #{i + 1} {productLabel(c.product)}
                  </div>
                  <div className="text-ink-500">
                    開始: {c.startDate || "—"} / 期間: {c.durationMonths || "—"}ヶ月
                  </div>
                  <div className="text-ink-500">
                    年額: {c.annualRevenue || "—"} 円 / 参加者:{" "}
                    {c.participants || "—"}名
                  </div>
                </li>
              ))}
            {form.contracts.filter((c) => c.product).length === 0 && (
              <p className="text-xs text-ink-500">入力された契約なし</p>
            )}
          </ul>
        )}
      </Section>

      <Section title="アサイン">
        {form.assignmentsSkipped ? (
          <p className="text-xs text-ink-500">スキップ</p>
        ) : (
          <>
            <Row
              label="CS 主担当"
              value={memberName(form.assignment.primaryUserId)}
            />
            <Row
              label="CS 副担当"
              value={memberName(form.assignment.secondaryUserId)}
            />
            <Row
              label="営業オーナー"
              value={memberName(form.assignment.salesOwnerUserId)}
            />
          </>
        )}
      </Section>

      <Section title="メモ (任意)">
        <textarea
          className={`${inputCls} min-h-[80px] resize-y`}
          placeholder="社内共有メモ・特記事項など"
          value={form.memo}
          onChange={(e) => patch("memo", e.target.value)}
        />
      </Section>

      {/*
        🚧 デモデータフラグ (0019_is_demo_flag.sql)
        本番運用開始前のダミーデータ管理用。本番開始時は EMPTY_FORM の
        isDemo: true を false に変更し、本セクションを削除 or 説明文変更する。
      */}
      <Section title="🚧 デモデータ">
        <label className="inline-flex items-start gap-2 text-xs text-ink-700">
          <input
            type="checkbox"
            checked={form.isDemo}
            onChange={(e) => patch("isDemo", e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium text-ink-900">これはデモデータです</span>
            <span className="block text-ink-500 mt-0.5">
              チェックを付けると is_demo=true で登録され、後から /settings/demo-data
              で一括削除できます。本番運用が始まるまではONのまま登録してください。
            </span>
          </span>
        </label>
      </Section>
    </div>
  );
}

function Section({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-ink-700">{title}</h3>
      <div className="rounded-lg border border-ink-100 p-3 bg-white space-y-1">
        {children}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  required
}: {
  label: string;
  value?: string;
  required?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 text-xs">
      <span className="text-ink-500 w-20 shrink-0">{label}</span>
      <span className="text-ink-900 break-all">
        {value && value.trim() ? (
          value
        ) : (
          <span className={required ? "text-rose-500" : "text-ink-300"}>—</span>
        )}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// 保存ステータス表示
// ─────────────────────────────────────────────
function SaveStatus({
  state,
  error,
  localSavedAt
}: {
  state: SaveState;
  error: string | null;
  localSavedAt: string | null;
}) {
  if (state === "saving")
    return <span className="text-[11px] text-ink-500">保存中...</span>;
  if (state === "saved")
    return <span className="text-[11px] text-emerald-600">✓ 保存しました</span>;
  if (state === "error")
    return (
      <span className="text-[11px] text-rose-600">
        保存失敗: {error ?? "不明なエラー"}
      </span>
    );
  if (localSavedAt) {
    const t = localSavedAt.slice(11, 16);
    return <span className="text-[11px] text-ink-500">下書き保存 {t}</span>;
  }
  return null;
}
