"use client";

import Link from "next/link";
import { useState } from "react";
import { TopNav } from "@/components/nav/TopNav";

type ProductType = "continuous" | "spot";

export default function NewProductPage() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [accent, setAccent] = useState("#6366f1");
  const [type, setType] = useState<ProductType>("continuous");
  const [description, setDescription] = useState("");

  const [contractMonths, setContractMonths] = useState(12);
  const [monthlyPrice, setMonthlyPrice] = useState(120000);
  const [lumpSum, setLumpSum] = useState(1200000);
  const [sessions, setSessions] = useState(12);
  const [seatsPerCompany, setSeatsPerCompany] = useState(5);

  const [onboarding, setOnboarding] = useState<string[]>([
    "キックオフMTG設定",
    "事前アンケート送付",
    "学習ポータル招待",
    "初回面談予約",
    "受講者リスト確認",
  ]);

  const [reminderDays, setReminderDays] = useState(3);
  const [celebrate, setCelebrate] = useState(true);

  const updateOnboarding = (i: number, v: string) => {
    const next = [...onboarding];
    next[i] = v;
    setOnboarding(next);
  };

  const handleCreate = () => {
    console.log("create product", {
      code,
      name,
      shortName,
      accent,
      type,
      description,
      contractMonths,
      monthlyPrice,
      lumpSum,
      sessions,
      seatsPerCompany,
      onboarding,
      reminderDays,
      celebrate,
    });
  };

  return (
    <>
      <TopNav current="/settings" />
      <main className="mx-auto max-w-[1720px] px-6 py-8 space-y-8">
        {/* ヘッダー */}
        <section>
          <div className="flex items-center gap-2 text-xs text-ink-500 font-medium">
            <Link href="/settings" className="hover:text-ink-700">
              設定
            </Link>
            <span>/</span>
            <Link href="/settings/products" className="hover:text-ink-700">
              研修マスタ
            </Link>
            <span>/</span>
            <span>新規追加</span>
          </div>
          <div className="mt-1 flex items-end justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">新規研修を追加</h1>
              <div className="mt-1 text-sm text-ink-500">
                基本情報・契約条件・オンボーディング初期テンプレを登録します
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/settings/products"
                className="px-4 py-2 rounded-full border border-ink-100 text-sm text-ink-700 hover:bg-ink-50"
              >
                キャンセル
              </Link>
              <button
                onClick={handleCreate}
                className="px-4 py-2 rounded-full bg-ink-900 text-white text-sm hover:bg-ink-700 shadow-liquid"
              >
                作成
              </button>
            </div>
          </div>
        </section>

        {/* 基本情報 */}
        <section className="liquid-surface p-6 space-y-5">
          <div className="flex items-center gap-3">
            <span
              className="inline-block w-2 h-6 rounded-full"
              style={{ background: accent }}
            />
            <h2 className="text-lg font-bold">基本情報</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-ink-500 font-medium mb-1">
                研修コード（半角英数）
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="例: NEO_LEAD"
                className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm focus:outline-hidden focus:border-ink-300"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-ink-500 font-medium mb-1">
                研修名
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: NEOリーダーシップ研修"
                className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm focus:outline-hidden focus:border-ink-300"
              />
            </div>

            <div>
              <label className="block text-xs text-ink-500 font-medium mb-1">
                略称
              </label>
              <input
                type="text"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                placeholder="例: NEO-L"
                className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm focus:outline-hidden focus:border-ink-300"
              />
            </div>

            <div>
              <label className="block text-xs text-ink-500 font-medium mb-1">
                アクセントカラー
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-ink-100 cursor-pointer"
                />
                <input
                  type="text"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-ink-100 text-sm focus:outline-hidden focus:border-ink-300 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-ink-500 font-medium mb-1">
                タイプ
              </label>
              <div className="flex items-center gap-2 pt-1">
                <label
                  className={`flex-1 cursor-pointer px-3 py-2 rounded-lg border text-sm text-center ${
                    type === "continuous"
                      ? "border-ink-900 bg-ink-50 text-ink-900 font-medium"
                      : "border-ink-100 text-ink-500 hover:bg-ink-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
                    value="continuous"
                    checked={type === "continuous"}
                    onChange={() => setType("continuous")}
                    className="sr-only"
                  />
                  継続型
                </label>
                <label
                  className={`flex-1 cursor-pointer px-3 py-2 rounded-lg border text-sm text-center ${
                    type === "spot"
                      ? "border-ink-900 bg-ink-50 text-ink-900 font-medium"
                      : "border-ink-100 text-ink-500 hover:bg-ink-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
                    value="spot"
                    checked={type === "spot"}
                    onChange={() => setType("spot")}
                    className="sr-only"
                  />
                  単発型
                </label>
              </div>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs text-ink-500 font-medium mb-1">
                説明
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="研修の対象・ゴール・特徴などを記載"
                className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm focus:outline-hidden focus:border-ink-300 resize-none"
              />
            </div>
          </div>
        </section>

        {/* 契約・料金 */}
        <section className="liquid-surface p-6 space-y-5">
          <div className="flex items-center gap-3">
            <span className="inline-block w-2 h-6 rounded-full bg-ink-900" />
            <h2 className="text-lg font-bold">契約・料金</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs text-ink-500 font-medium mb-1">
                契約期間（月）
              </label>
              <input
                type="number"
                value={contractMonths}
                onChange={(e) => setContractMonths(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm focus:outline-hidden focus:border-ink-300"
              />
            </div>
            <div>
              <label className="block text-xs text-ink-500 font-medium mb-1">
                月額単価（円）
              </label>
              <input
                type="number"
                value={monthlyPrice}
                onChange={(e) => setMonthlyPrice(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm focus:outline-hidden focus:border-ink-300"
              />
            </div>
            <div>
              <label className="block text-xs text-ink-500 font-medium mb-1">
                一括金額（円）
              </label>
              <input
                type="number"
                value={lumpSum}
                onChange={(e) => setLumpSum(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm focus:outline-hidden focus:border-ink-300"
              />
            </div>
            <div>
              <label className="block text-xs text-ink-500 font-medium mb-1">
                セッション数
              </label>
              <input
                type="number"
                value={sessions}
                onChange={(e) => setSessions(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm focus:outline-hidden focus:border-ink-300"
              />
            </div>
            <div>
              <label className="block text-xs text-ink-500 font-medium mb-1">
                1社あたり参加枠
              </label>
              <input
                type="number"
                value={seatsPerCompany}
                onChange={(e) => setSeatsPerCompany(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm focus:outline-hidden focus:border-ink-300"
              />
            </div>
          </div>

          <div className="rounded-lg bg-ink-50 px-4 py-3 text-xs text-ink-500">
            目安: 月額 × 契約期間 ={" "}
            <span className="font-mono text-ink-900">
              ¥{(monthlyPrice * contractMonths).toLocaleString()}
            </span>{" "}
            / 一括金額との差額{" "}
            <span className="font-mono text-ink-900">
              ¥{(monthlyPrice * contractMonths - lumpSum).toLocaleString()}
            </span>
          </div>
        </section>

        {/* オンボーディング初期テンプレ */}
        <section className="liquid-surface p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-block w-2 h-6 rounded-full bg-ink-900" />
              <h2 className="text-lg font-bold">オンボーディング初期テンプレ</h2>
            </div>
            <span className="text-xs text-ink-500">
              契約開始時に自動でタスク化されます
            </span>
          </div>

          <ul className="space-y-2">
            {onboarding.map((item, i) => (
              <li
                key={i}
                className="flex items-center gap-3 px-3 py-2 rounded-lg border border-ink-100 hover:bg-ink-50"
              >
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-ink-200 text-[10px] text-ink-500 font-medium">
                  {i + 1}
                </span>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => updateOnboarding(i, e.target.value)}
                  className="flex-1 px-2 py-1 rounded border border-transparent text-sm focus:outline-hidden focus:border-ink-200 bg-transparent"
                />
                <button
                  onClick={() =>
                    setOnboarding(onboarding.filter((_, idx) => idx !== i))
                  }
                  className="text-xs text-ink-400 hover:text-red-500"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>

          <button
            onClick={() => setOnboarding([...onboarding, ""])}
            className="px-3 py-1.5 rounded-full border border-dashed border-ink-200 text-xs text-ink-500 hover:bg-ink-50"
          >
            + タスクを追加
          </button>
        </section>

        {/* 通知初期設定 */}
        <section className="liquid-surface p-6 space-y-5">
          <div className="flex items-center gap-3">
            <span className="inline-block w-2 h-6 rounded-full bg-ink-900" />
            <h2 className="text-lg font-bold">通知初期設定</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-ink-500 font-medium mb-1">
                セッション開始の何日前にリマインドするか
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={reminderDays}
                  onChange={(e) => setReminderDays(Number(e.target.value))}
                  className="w-24 px-3 py-2 rounded-lg border border-ink-100 text-sm focus:outline-hidden focus:border-ink-300"
                />
                <span className="text-sm text-ink-500">日前</span>
              </div>
            </div>

            <div>
              <label className="block text-xs text-ink-500 font-medium mb-1">
                完了時の祝福通知
              </label>
              <button
                onClick={() => setCelebrate(!celebrate)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm w-full ${
                  celebrate
                    ? "border-ink-900 bg-ink-50"
                    : "border-ink-100 text-ink-500"
                }`}
              >
                <span
                  className={`relative inline-block w-9 h-5 rounded-full transition-colors ${
                    celebrate ? "bg-ink-900" : "bg-ink-200"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                      celebrate ? "left-4" : "left-0.5"
                    }`}
                  />
                </span>
                <span className={celebrate ? "text-ink-900 font-medium" : ""}>
                  {celebrate ? "ON: 修了時に祝福メッセージを自動送信" : "OFF"}
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* 下部アクション */}
        <section className="flex items-center justify-end gap-2 pt-2">
          <Link
            href="/settings/products"
            className="px-4 py-2 rounded-full border border-ink-100 text-sm text-ink-700 hover:bg-ink-50"
          >
            キャンセル
          </Link>
          <button
            onClick={handleCreate}
            className="px-4 py-2 rounded-full bg-ink-900 text-white text-sm hover:bg-ink-700 shadow-liquid"
          >
            作成
          </button>
        </section>

        <footer className="pt-8 pb-4 text-center text-[11px] text-ink-500">
          NEO CS v2 — 研修追加 / ダミーデータ
        </footer>
      </main>
    </>
  );
}
