"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { companyRepo, DEFAULT_ORG_ID } from "@/lib/repository";
import { useDraftPersistence } from "@/lib/hooks/useDraftPersistence";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { ProductCode } from "@/lib/mock/data";

const industries = [
  "IT・ソフトウェア",
  "製造業",
  "小売・流通",
  "金融・保険",
  "建設・不動産",
  "医療・福祉",
  "教育",
  "コンサルティング",
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

const csOwners = ["古野 健太", "佐藤 美咲", "田中 拓也", "鈴木 結衣"];
const salesOwners = ["山田 直樹", "高橋 涼", "中村 葵", "小林 翔太"];

const trainingOptions: { code: string; label: string; productCode: ProductCode }[] = [
  { code: "academia", label: "アカデミア", productCode: "academia" },
  { code: "council", label: "評議会", productCode: "hyogikai" },
  { code: "ai", label: "AI研", productCode: "aiken" },
  { code: "comm", label: "コミュ", productCode: "commu" }
];

type FormState = {
  name: string;
  kana: string;
  industry: string;
  employeeSize: string;
  address: string;
  websiteUrl: string;
  foundedYear: string;
  csOwner: string;
  salesOwner: string;
  trainings: string[];
  expectedAnnualRevenue: string;
  primaryContactName: string;
  primaryContactTitle: string;
  primaryContactEmail: string;
  primaryContactTel: string;
  slackChannel: string;
  memo: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  kana: "",
  industry: "",
  employeeSize: "",
  address: "",
  websiteUrl: "",
  foundedYear: "",
  csOwner: "",
  salesOwner: "",
  trainings: [],
  expectedAnnualRevenue: "",
  primaryContactName: "",
  primaryContactTitle: "",
  primaryContactEmail: "",
  primaryContactTel: "",
  slackChannel: "",
  memo: ""
};

type SaveState = "idle" | "saving" | "saved" | "error";

export default function NewCompanyPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const restoredRef = useRef(false);

  const draftKey = "company:new";
  const { savedAt: localSavedAt, restore, markClean } = useDraftPersistence(
    draftKey,
    form,
    dirty
  );

  // マウント時に localStorage から復元 (一度だけ)
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const restored = restore();
    if (restored) {
      setForm(restored);
      setDirty(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  const toggleTraining = (code: string) => {
    setForm((f) => ({
      ...f,
      trainings: f.trainings.includes(code)
        ? f.trainings.filter((c) => c !== code)
        : [...f.trainings, code]
    }));
    setDirty(true);
  };

  function parseAnnualRevenue(): number {
    const cleaned = form.expectedAnnualRevenue.replace(/[, ]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  async function handleSave(): Promise<void> {
    if (!form.name.trim()) {
      setSaveState("error");
      setSaveError("企業名は必須です");
      return;
    }
    setSaveState("saving");
    setSaveError(null);
    try {
      const annualJpy = parseAnnualRevenue();
      const productCodes: ProductCode[] = form.trainings
        .map((code) => trainingOptions.find((t) => t.code === code)?.productCode)
        .filter((c): c is ProductCode => Boolean(c));

      // memoに本フォーム独自の追加フィールドを集約 (mock Company 型の制約に従う)
      const memoLines = [
        form.memo,
        form.employeeSize ? `従業員規模: ${form.employeeSize}` : "",
        form.websiteUrl ? `URL: ${form.websiteUrl}` : "",
        form.foundedYear ? `設立: ${form.foundedYear}` : "",
        form.salesOwner ? `営業: ${form.salesOwner}` : "",
        form.primaryContactName
          ? `主担当: ${form.primaryContactName}${
              form.primaryContactTitle ? ` (${form.primaryContactTitle})` : ""
            }`
          : "",
        form.primaryContactEmail ? `連絡先: ${form.primaryContactEmail}` : "",
        form.primaryContactTel ? `Tel: ${form.primaryContactTel}` : "",
        form.slackChannel ? `Slack: ${form.slackChannel}` : ""
      ]
        .filter((s) => s.length > 0)
        .join("\n");

      const created = await companyRepo.create({
        organizationId: DEFAULT_ORG_ID,
        name: form.name.trim(),
        kana: form.kana.trim(),
        industry: form.industry || "未設定",
        address: form.address || "",
        ownerName: form.csOwner || "未割当",
        contracts: productCodes,
        mrr: Math.round(annualJpy / 12),
        lastTouchDays: 0,
        memo: memoLines || undefined
      });
      setSaveState("saved");
      setDirty(false);
      markClean();
      router.push(`/companies/${created.id}`);
    } catch (e) {
      setSaveState("error");
      setSaveError(e instanceof Error ? e.message : String(e));
    }
  }

  function handleCancelClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (dirty) {
      e.preventDefault();
      setCancelConfirmOpen(true);
    }
  }

  const trainings = form.trainings;

  const inputCls =
    "w-full px-3 py-2 rounded-lg border border-ink-100 text-sm focus:outline-none focus:border-ink-300";
  const labelCls = "block text-xs text-ink-500 font-medium mb-1";

  return (
    <>
      <TopNav current="/companies" />
      <main className="mx-auto max-w-[1400px] px-6 py-8 space-y-8">
        {/* ヘッダー */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-ink-500 mb-1">
              <Link href="/companies" className="hover:text-ink-700">
                企業
              </Link>
              <span className="mx-1">/</span>
              <span>新規追加</span>
            </div>
            <h1 className="text-2xl font-semibold text-ink-900">企業を追加</h1>
            <p className="text-sm text-ink-500 mt-1">
              新規企業の基本情報・契約・連絡先を登録します
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SaveStatus state={saveState} error={saveError} localSavedAt={localSavedAt} />
            <Link
              href="/companies"
              onClick={handleCancelClick}
              className="px-4 py-2 rounded-full border border-ink-100 text-sm text-ink-700 hover:bg-ink-50"
            >
              キャンセル
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={saveState === "saving" || !form.name.trim()}
              className="px-4 py-2 rounded-full bg-ink-900 text-white text-sm hover:bg-ink-700 shadow-liquid disabled:opacity-50"
            >
              {saveState === "saving" ? "保存中..." : "保存"}
            </button>
          </div>
        </div>

        {/* 基本情報 */}
        <section className="liquid-surface p-6 space-y-4">
          <h2 className="text-sm font-semibold text-ink-900">基本情報</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                企業名 <span className="text-rose-500">*</span>
              </label>
              <input
                className={inputCls}
                placeholder="株式会社サンプル"
                value={form.name}
                onChange={(e) => patch("name", e.target.value)}
                required
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
              <label className={labelCls}>所在地</label>
              <input
                className={inputCls}
                placeholder="東京都渋谷区..."
                value={form.address}
                onChange={(e) => patch("address", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>公式URL</label>
              <input
                className={inputCls}
                placeholder="https://example.com"
                type="url"
                value={form.websiteUrl}
                onChange={(e) => patch("websiteUrl", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>設立年</label>
              <input
                className={inputCls}
                placeholder="2015"
                type="number"
                value={form.foundedYear}
                onChange={(e) => patch("foundedYear", e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* 担当・契約 */}
        <section className="liquid-surface p-6 space-y-4">
          <h2 className="text-sm font-semibold text-ink-900">担当・契約</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>CS担当者</label>
              <select
                className={inputCls}
                value={form.csOwner}
                onChange={(e) => patch("csOwner", e.target.value)}
              >
                <option value="">選択してください</option>
                {csOwners.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>営業担当者</label>
              <select
                className={inputCls}
                value={form.salesOwner}
                onChange={(e) => patch("salesOwner", e.target.value)}
              >
                <option value="">選択してください</option>
                {salesOwners.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>想定研修</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {trainingOptions.map((t) => {
                  const active = trainings.includes(t.code);
                  return (
                    <label
                      key={t.code}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm cursor-pointer transition ${
                        active
                          ? "bg-ink-900 text-white border-ink-900"
                          : "border-ink-100 text-ink-700 hover:bg-ink-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={active}
                        onChange={() => toggleTraining(t.code)}
                      />
                      {t.label}
                    </label>
                  );
                })}
              </div>
            </div>
            <div>
              <label className={labelCls}>契約予定金額(年額・円)</label>
              <input
                className={inputCls}
                placeholder="3,600,000"
                type="text"
                value={form.expectedAnnualRevenue}
                onChange={(e) => patch("expectedAnnualRevenue", e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* 連絡先 */}
        <section className="liquid-surface p-6 space-y-4">
          <h2 className="text-sm font-semibold text-ink-900">連絡先</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>主担当者名</label>
              <input
                className={inputCls}
                placeholder="山田 太郎"
                value={form.primaryContactName}
                onChange={(e) => patch("primaryContactName", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>役職</label>
              <input
                className={inputCls}
                placeholder="人事部長"
                value={form.primaryContactTitle}
                onChange={(e) => patch("primaryContactTitle", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>メール</label>
              <input
                className={inputCls}
                placeholder="taro@example.com"
                type="email"
                value={form.primaryContactEmail}
                onChange={(e) => patch("primaryContactEmail", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>電話</label>
              <input
                className={inputCls}
                placeholder="03-1234-5678"
                type="tel"
                value={form.primaryContactTel}
                onChange={(e) => patch("primaryContactTel", e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Slack 連携先</label>
              <input
                className={inputCls}
                placeholder="#cs-sample-corp"
                value={form.slackChannel}
                onChange={(e) => patch("slackChannel", e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* メモ */}
        <section className="liquid-surface p-6 space-y-4">
          <h2 className="text-sm font-semibold text-ink-900">メモ</h2>
          <textarea
            className={`${inputCls} min-h-[120px] resize-y`}
            placeholder="社内共有メモ・特記事項など"
            value={form.memo}
            onChange={(e) => patch("memo", e.target.value)}
          />
        </section>

        {/* 下部ボタン */}
        <div className="flex items-center justify-end gap-3 flex-wrap">
          <SaveStatus state={saveState} error={saveError} localSavedAt={localSavedAt} />
          <Link
            href="/companies"
            onClick={handleCancelClick}
            className="px-4 py-2 rounded-full border border-ink-100 text-sm text-ink-700 hover:bg-ink-50"
          >
            キャンセル
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveState === "saving" || !form.name.trim()}
            className="px-4 py-2 rounded-full bg-ink-900 text-white text-sm hover:bg-ink-700 shadow-liquid disabled:opacity-50"
          >
            {saveState === "saving" ? "保存中..." : "保存"}
          </button>
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

        <footer className="pt-8 pb-4 text-center text-[11px] text-ink-500">
          NEO CS v2 — 企業追加 / ダミーデータ
        </footer>
      </main>
    </>
  );
}

function SaveStatus({
  state,
  error,
  localSavedAt
}: {
  state: SaveState;
  error: string | null;
  localSavedAt: string | null;
}) {
  if (state === "saving") {
    return <span className="text-[11px] text-ink-500">保存中...</span>;
  }
  if (state === "saved") {
    return <span className="text-[11px] text-emerald-600">✓ 保存しました</span>;
  }
  if (state === "error") {
    return (
      <span className="text-[11px] text-rose-600">
        保存失敗: {error ?? "不明なエラー"}
      </span>
    );
  }
  if (localSavedAt) {
    const t = localSavedAt.slice(11, 16);
    return (
      <span className="text-[11px] text-ink-500">下書き保存 {t}</span>
    );
  }
  return null;
}
