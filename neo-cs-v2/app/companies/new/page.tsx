"use client";

import { useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/TopNav";

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

const trainingOptions = [
  { code: "academia", label: "アカデミア" },
  { code: "council", label: "評議会" },
  { code: "ai", label: "AI研" },
  { code: "comm", label: "コミュ" }
];

export default function NewCompanyPage() {
  const [trainings, setTrainings] = useState<string[]>([]);

  const toggleTraining = (code: string) => {
    setTrainings((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSave = () => {
    // ダミー: 実際の登録処理は未実装
    console.log("企業を保存（モック）", { trainings });
  };

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
            <Link
              href="/companies"
              className="px-4 py-2 rounded-full border border-ink-100 text-sm text-ink-700 hover:bg-ink-50"
            >
              キャンセル
            </Link>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-full bg-ink-900 text-white text-sm hover:bg-ink-700 shadow-liquid"
            >
              保存
            </button>
          </div>
        </div>

        {/* 基本情報 */}
        <section className="liquid-surface p-6 space-y-4">
          <h2 className="text-sm font-semibold text-ink-900">基本情報</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>企業名</label>
              <input className={inputCls} placeholder="株式会社サンプル" />
            </div>
            <div>
              <label className={labelCls}>カナ</label>
              <input className={inputCls} placeholder="カブシキガイシャサンプル" />
            </div>
            <div>
              <label className={labelCls}>業種</label>
              <select className={inputCls} defaultValue="">
                <option value="" disabled>
                  選択してください
                </option>
                {industries.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>従業員規模</label>
              <select className={inputCls} defaultValue="">
                <option value="" disabled>
                  選択してください
                </option>
                {employeeSizes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>所在地</label>
              <input className={inputCls} placeholder="東京都渋谷区..." />
            </div>
            <div>
              <label className={labelCls}>公式URL</label>
              <input
                className={inputCls}
                placeholder="https://example.com"
                type="url"
              />
            </div>
            <div>
              <label className={labelCls}>設立年</label>
              <input className={inputCls} placeholder="2015" type="number" />
            </div>
          </div>
        </section>

        {/* 担当・契約 */}
        <section className="liquid-surface p-6 space-y-4">
          <h2 className="text-sm font-semibold text-ink-900">担当・契約</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>CS担当者</label>
              <select className={inputCls} defaultValue="">
                <option value="" disabled>
                  選択してください
                </option>
                {csOwners.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>営業担当者</label>
              <select className={inputCls} defaultValue="">
                <option value="" disabled>
                  選択してください
                </option>
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
              <label className={labelCls}>契約予定金額（年額・円）</label>
              <input
                className={inputCls}
                placeholder="3,600,000"
                type="text"
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
              <input className={inputCls} placeholder="山田 太郎" />
            </div>
            <div>
              <label className={labelCls}>役職</label>
              <input className={inputCls} placeholder="人事部長" />
            </div>
            <div>
              <label className={labelCls}>メール</label>
              <input
                className={inputCls}
                placeholder="taro@example.com"
                type="email"
              />
            </div>
            <div>
              <label className={labelCls}>電話</label>
              <input className={inputCls} placeholder="03-1234-5678" type="tel" />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Slack 連携先</label>
              <input
                className={inputCls}
                placeholder="#cs-sample-corp"
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
          />
        </section>

        {/* 下部ボタン */}
        <div className="flex items-center justify-end gap-2">
          <Link
            href="/companies"
            className="px-4 py-2 rounded-full border border-ink-100 text-sm text-ink-700 hover:bg-ink-50"
          >
            キャンセル
          </Link>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-full bg-ink-900 text-white text-sm hover:bg-ink-700 shadow-liquid"
          >
            保存
          </button>
        </div>

        <footer className="pt-8 pb-4 text-center text-[11px] text-ink-500">
          NEO CS v2 — 企業追加 / ダミーデータ
        </footer>
      </main>
    </>
  );
}
