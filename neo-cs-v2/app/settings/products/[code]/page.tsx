"use client";

import Link from "next/link";
import { use, useState } from "react";
import { notFound } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { products, productByCode, ProductCode } from "@/lib/mock/data";

type Product = (typeof products)[number];

type TabKey = "basic" | "contract" | "participants" | "schedule" | "onboarding";

const tabs: { key: TabKey; label: string }[] = [
  { key: "basic", label: "基本情報" },
  { key: "contract", label: "契約設定" },
  { key: "participants", label: "参加者" },
  { key: "schedule", label: "面談スケジュール" },
  { key: "onboarding", label: "オンボ項目" }
];

const VALID_CODES: ProductCode[] = ["academia", "hyogikai", "aiken", "commu"];

export default function ProductEditPage({
  params
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  if (!VALID_CODES.includes(code as ProductCode)) {
    notFound();
  }
  const p = productByCode[code as ProductCode];
  const [tab, setTab] = useState<TabKey>("basic");

  return (
    <>
      <TopNav current="/settings" />
      <main className="mx-auto max-w-[1400px] px-6 py-8 space-y-6">
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
              <h1 className="mt-1 text-3xl font-bold tracking-tight flex items-center gap-3">
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
              <button className="px-4 py-2 rounded-full bg-white border border-ink-100 text-sm text-ink-700 hover:bg-ink-50">
                キャンセル
              </button>
              <button className="px-4 py-2 rounded-full bg-ink-900 text-white text-sm hover:bg-ink-700 shadow-liquid">
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
          {tab === "basic" && <BasicTab product={p} />}
          {tab === "contract" && <ContractTab product={p} />}
          {tab === "participants" && <ParticipantsTab product={p} />}
          {tab === "schedule" && <ScheduleTab accent={p.accent} />}
          {tab === "onboarding" && <OnboardingTab accent={p.accent} />}
        </section>

        <footer className="pt-8 pb-4 text-center text-[11px] text-ink-500">
          NEO CS v2 — 研修マスタ編集 / ダミーデータ
        </footer>
      </main>
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
  "w-full px-3 py-2 rounded-xl bg-white border border-ink-100 text-sm text-ink-900 focus:outline-none focus:border-ink-300";

function BasicTab({ product }: { product: Product }) {
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
      <Field label="説明">
        <textarea
          className={`${inputCls} h-24 resize-none`}
          defaultValue={`${product.name}は${product.type === "continuous" ? "12ヶ月継続型" : "単発型"}の研修プログラムです。`}
        />
      </Field>
    </div>
  );
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

function ScheduleTab({ accent }: { accent: string }) {
  const [rows, setRows] = useState([
    { no: 1, name: "Kickoff MTG", offset: 7, required: true },
    { no: 2, name: "1ヶ月目レビュー", offset: 30, required: true },
    { no: 3, name: "中間評価会", offset: 180, required: true },
    { no: 4, name: "四半期振り返り", offset: 270, required: false },
    { no: 5, name: "更新MTG", offset: 330, required: true }
  ]);

  return (
    <div className="space-y-4">
      <div className="liquid-surface p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold">面談マイルストーン テンプレート</div>
            <div className="mt-1 text-xs text-ink-500">
              契約開始日からのオフセット日数で面談を自動スケジュール
            </div>
          </div>
          <button
            className="px-3 py-1.5 rounded-full text-xs text-white shadow-liquid"
            style={{ background: accent }}
          >
            + 追加
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-ink-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-ink-500 bg-ink-50 border-b border-ink-100">
                <th className="px-4 py-2.5 font-medium w-14">回</th>
                <th className="px-3 py-2.5 font-medium">名称</th>
                <th className="px-3 py-2.5 font-medium w-40">offset_days</th>
                <th className="px-3 py-2.5 font-medium w-24">必須</th>
                <th className="px-3 py-2.5 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.no} className="border-b border-ink-50 last:border-0">
                  <td className="px-4 py-2.5 font-medium">{r.no}</td>
                  <td className="px-3 py-2.5">
                    <input className={inputCls} defaultValue={r.name} />
                  </td>
                  <td className="px-3 py-2.5">
                    <input className={inputCls} defaultValue={String(r.offset)} />
                  </td>
                  <td className="px-3 py-2.5">
                    <input type="checkbox" defaultChecked={r.required} className="w-4 h-4" />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      className="text-xs text-rose-500 hover:underline"
                      onClick={() => setRows((rs) => rs.filter((_, i) => i !== idx))}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="liquid-surface p-5 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">既存契約への反映</div>
          <div className="mt-0.5 text-xs text-ink-500">
            この変更を現在進行中のすべての契約に反映します（上書き注意）
          </div>
        </div>
        <button className="px-4 py-2 rounded-full bg-white border border-ink-100 text-sm text-ink-700 hover:bg-ink-50">
          既存契約に反映
        </button>
      </div>
    </div>
  );
}

function OnboardingTab({ accent }: { accent: string }) {
  const phases = [
    { key: "prep", label: "Prep（事前準備）" },
    { key: "kickoff", label: "Kickoff" },
    { key: "run", label: "Run（実施中）" },
    { key: "close", label: "Close（終了/更新）" }
  ];
  const tasksByPhase: Record<string, string[]> = {
    prep: ["参加者リスト受領", "契約書送付", "アカウント発行"],
    kickoff: ["Kickoff MTG実施", "初回アンケート配布"],
    run: ["中間レビュー準備", "講義資料の事前送付"],
    close: ["契約更新意向確認", "修了レポート作成"]
  };

  return (
    <div className="space-y-4">
      <div className="liquid-surface p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold">オンボーディング項目テンプレート</div>
            <div className="mt-1 text-xs text-ink-500">
              フェーズごとのタスクを定義。新規契約時に自動生成されます
            </div>
          </div>
          <button
            className="px-3 py-1.5 rounded-full text-xs text-white shadow-liquid"
            style={{ background: accent }}
          >
            + 追加
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {phases.map((ph) => (
            <div key={ph.key} className="rounded-xl border border-ink-100 bg-ink-50/40 p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-ink-700">{ph.label}</div>
                <span className="text-[10px] text-ink-500">{tasksByPhase[ph.key].length}件</span>
              </div>
              <ul className="mt-3 space-y-2">
                {tasksByPhase[ph.key].map((t, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-ink-100 text-xs"
                  >
                    <span className="text-ink-700">{t}</span>
                    <button className="text-rose-500 text-[10px] hover:underline">削除</button>
                  </li>
                ))}
                <li>
                  <button className="w-full px-3 py-2 rounded-lg text-xs text-ink-500 hover:bg-white border border-dashed border-ink-100">
                    + タスク追加
                  </button>
                </li>
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="liquid-surface p-5 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">既存契約への反映</div>
          <div className="mt-0.5 text-xs text-ink-500">
            この変更を現在進行中のすべての契約に反映します（既存タスクの差分のみ追加）
          </div>
        </div>
        <button className="px-4 py-2 rounded-full bg-white border border-ink-100 text-sm text-ink-700 hover:bg-ink-50">
          既存契約に反映
        </button>
      </div>
    </div>
  );
}
