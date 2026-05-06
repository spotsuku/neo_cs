"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { CompletenessBadge } from "@/components/CompletenessChecklistCard";
import "@/lib/mock/karute-no-init"; // companies seed に karuteNo を付与 (side-effect)
import { companies, onboardingTasks } from "@/lib/mock/entities";
import { activeContracts, contractOnboardingItems } from "@/lib/mock/onboarding";
import { companyHealthColor } from "@/lib/mock/health";
import { checkCompanyCompleteness } from "@/lib/domain/completeness";
import type { CompanyWeather } from "@/lib/domain/weather";
import { WeatherIcon } from "@/components/WeatherIcon";
import { seedCompanyJourneys, DEFAULT_COMPANY_STAGES } from "@/lib/mock/journeys";
// コース表示に対応
import { ProductCode, products, yen, hasMultipleCourses, courseShortName, productByCode } from "@/lib/mock/data";

// 一覧の基準日 (mock 環境)。activeContracts の TODAY と揃える
const TODAY = "2026-04-24";

// 列単位ソート: 各列のキー
type SortColumn =
  | "no"
  | "name"
  | "contracts"
  | "journey"
  | "revenue"
  | "renewal"
  | "tasks"
  | "owner"
  | "lastTouch";
type SortDir = "asc" | "desc";

type HealthFilter = "all" | "green" | "yellow" | "red";

// 更新までフィルタ
type RenewalFilter = "all" | "30" | "60" | "90" | "overdue";
const renewalOptions: { value: RenewalFilter; label: string }[] = [
  { value: "all", label: "更新: すべて" },
  { value: "30", label: "更新: 30日以内" },
  { value: "60", label: "更新: 60日以内" },
  { value: "90", label: "更新: 90日以内" },
  { value: "overdue", label: "更新: 期限超過" }
];

// 未対応タスクフィルタ
type TaskFilter = "all" | "has" | "none";
const taskOptions: { value: TaskFilter; label: string }[] = [
  { value: "all", label: "タスク: すべて" },
  { value: "has", label: "タスク: あり" },
  { value: "none", label: "タスク: なし" }
];

const healthOptions: { value: HealthFilter; label: string; dot: string }[] = [
  { value: "all", label: "すべて", dot: "" },
  { value: "green", label: "Green", dot: "#10B981" },
  { value: "yellow", label: "Yellow", dot: "#F59E0B" },
  { value: "red", label: "Red", dot: "#EF4444" }
];

/** 列ヘッダ ソートボタン: クリックで asc → desc → 解除 */
function SortableTh({
  col,
  sortColumn,
  sortDir,
  onSort,
  className,
  align,
  children
}: {
  col: SortColumn;
  sortColumn: SortColumn | null;
  sortDir: SortDir;
  onSort: (col: SortColumn) => void;
  className?: string;
  align?: "right";
  children: React.ReactNode;
}) {
  const active = sortColumn === col;
  const arrow = !active ? "↕" : sortDir === "asc" ? "↑" : "↓";
  return (
    <th className={["font-medium", className ?? ""].join(" ")}>
      <button
        type="button"
        onClick={() => onSort(col)}
        className={[
          "inline-flex items-center gap-1 rounded hover:text-ink-900 transition",
          align === "right" ? "ml-auto" : "",
          active ? "text-ink-900 font-semibold" : "text-ink-500"
        ].join(" ")}
        title="クリックで昇順・降順・解除"
      >
        <span>{children}</span>
        <span className={active ? "text-ink-700" : "text-ink-300 text-[10px]"}>
          {arrow}
        </span>
      </button>
    </th>
  );
}

function HealthDot({ color }: { color: "green" | "yellow" | "red" }) {
  const bg =
    color === "green" ? "#10B981" : color === "yellow" ? "#F59E0B" : "#EF4444";
  return (
    <span
      className="inline-block w-2 h-2 rounded-full"
      style={{ background: bg }}
    />
  );
}

export default function CompaniesView({
  weatherOverrides: weatherOverrideEntries
}: {
  /** server で取得した {companyId: weather} の一覧 */
  weatherOverrides: { companyId: string; weather: CompanyWeather }[];
}) {
  const [q, setQ] = useState("");
  const [health, setHealth] = useState<HealthFilter>("all");
  const [productFilter, setProductFilter] = useState<ProductCode[]>([]);
  const [owner, setOwner] = useState<string>("all");
  const [renewalFilter, setRenewalFilter] = useState<RenewalFilter>("all");
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [journeyFilter, setJourneyFilter] = useState<string>("all");
  // 列ヘッダ クリックで切替: null → asc → desc → null …
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  // 🚧 デモ非表示トグル (本番開始前は OFF=全表示が合理的)
  const [hideDemo, setHideDemo] = useState<boolean>(false);

  const cycleSort = (col: SortColumn) => {
    if (sortColumn !== col) {
      setSortColumn(col);
      setSortDir("asc");
      return;
    }
    if (sortDir === "asc") {
      setSortDir("desc");
      return;
    }
    // desc → 解除
    setSortColumn(null);
    setSortDir("asc");
  };

  // server から渡された手動オーバーライドを Map 化
  const weatherOverrides = useMemo(
    () => new Map(weatherOverrideEntries.map((o) => [o.companyId, o.weather])),
    [weatherOverrideEntries]
  );

  // 企業ごとの完成度スコアを計算 (純関数)。companies は固定なので useMemo
  const completenessByCompany = useMemo(() => {
    const map = new Map<string, number>();
    companies.forEach((c) => {
      const r = checkCompanyCompleteness({
        company: { id: c.id, name: c.name, industry: c.industry },
        contacts: [],
        contracts: activeContracts
          .filter((ac) => ac.companyId === c.id)
          .map((ac) => ({
            status: ac.status,
            courseKey: ac.courseKey,
            mrr: ac.mrr,
            revenue: ac.revenue,
            startDate: ac.startDate,
            endDate: ac.endDate
          })),
        fallbackPrimaryOwnerName: c.ownerName,
        onboarding: {
          taskCount: contractOnboardingItems.filter((i) =>
            activeContracts.some((ac) => ac.id === i.contractId && ac.companyId === c.id)
          ).length
        },
        drive: { folderUrl: c.driveFolderUrl ?? null }
      });
      map.set(c.id, r.score);
    });
    return map;
  }, []);

  const owners = useMemo(() => {
    const set = new Set<string>();
    companies.forEach((c) => set.add(c.ownerName));
    return Array.from(set);
  }, []);

  // 企業ジャーニーの現在ステージ名を companyId → 表示用テキストで Map 化
  const journeyByCompany = useMemo(() => {
    const stageByKey = new Map(DEFAULT_COMPANY_STAGES.map((s) => [s.stageKey, s]));
    const map = new Map<string, { stageKey: string; name: string; displayOrder: number; color?: string }>();
    seedCompanyJourneys.forEach((j) => {
      const stage = stageByKey.get(j.currentStageKey);
      if (stage) {
        map.set(j.companyId, {
          stageKey: j.currentStageKey,
          name: stage.name,
          displayOrder: stage.displayOrder,
          color: stage.color
        });
      }
    });
    return map;
  }, []);

  // 累計売上 (active + renewed の revenue 合計)
  const totalRevenueByCompany = useMemo(() => {
    const map = new Map<string, number>();
    activeContracts.forEach((c) => {
      if (typeof c.revenue !== "number") return;
      map.set(c.companyId, (map.get(c.companyId) ?? 0) + c.revenue);
    });
    return map;
  }, []);

  // 更新まで日数 (アクティブ契約のうち最も近い endDate)
  const renewalDaysByCompany = useMemo(() => {
    const today = Date.parse(TODAY);
    const map = new Map<string, number>();
    activeContracts.forEach((c) => {
      if (!c.endDate) return;
      if (c.status === "churned" || c.status === "renewed") return;
      const t = Date.parse(c.endDate);
      if (isNaN(t)) return;
      const days = Math.round((t - today) / 86_400_000);
      const prev = map.get(c.companyId);
      if (prev === undefined || days < prev) map.set(c.companyId, days);
    });
    return map;
  }, []);

  // 未対応タスク数 (todo + doing + overdue)
  const openTaskCountByCompany = useMemo(() => {
    const map = new Map<string, number>();
    onboardingTasks.forEach((t) => {
      if (t.status === "done") return;
      map.set(t.companyId, (map.get(t.companyId) ?? 0) + 1);
    });
    return map;
  }, []);

  const toggleProduct = (code: ProductCode) => {
    setProductFilter((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const filtered = useMemo(() => {
    return companies.filter((c) => {
      if (q) {
        const lower = q.toLowerCase();
        const hit =
          c.name.toLowerCase().includes(lower) ||
          c.kana.toLowerCase().includes(lower) ||
          c.industry.toLowerCase().includes(lower);
        if (!hit) return false;
      }
      if (health !== "all" && companyHealthColor(c.id) !== health) return false;
      if (productFilter.length > 0) {
        // アカデミア契約には評議会参加権が暗黙に付帯するため、
        // 「評議会」フィルタはアカデミア契約企業もヒットさせる
        const satisfies = (p: ProductCode) => {
          if (c.contracts.includes(p)) return true;
          if (p === "hyogikai" && c.contracts.includes("academia")) return true;
          return false;
        };
        const has = productFilter.every(satisfies);
        if (!has) return false;
      }
      if (owner !== "all" && c.ownerName !== owner) return false;
      // 企業ジャーニー ステージフィルタ
      if (journeyFilter !== "all") {
        if (journeyFilter === "__none__") {
          if (journeyByCompany.has(c.id)) return false;
        } else {
          const j = journeyByCompany.get(c.id);
          if (!j || j.stageKey !== journeyFilter) return false;
        }
      }
      // 更新まで日数フィルタ
      if (renewalFilter !== "all") {
        const days = renewalDaysByCompany.get(c.id);
        if (days === undefined) return false;
        if (renewalFilter === "overdue" && days >= 0) return false;
        if (renewalFilter === "30" && (days < 0 || days > 30)) return false;
        if (renewalFilter === "60" && (days < 0 || days > 60)) return false;
        if (renewalFilter === "90" && (days < 0 || days > 90)) return false;
      }
      // 未対応タスクフィルタ
      if (taskFilter !== "all") {
        const count = openTaskCountByCompany.get(c.id) ?? 0;
        if (taskFilter === "has" && count === 0) return false;
        if (taskFilter === "none" && count > 0) return false;
      }
      // is_demo: undefined は true 扱い (mock seed が isDemo フィールド持たないため)
      const isDemo = c.isDemo ?? true;
      if (hideDemo && isDemo) return false;
      return true;
    });
  }, [
    q,
    health,
    productFilter,
    owner,
    hideDemo,
    renewalFilter,
    taskFilter,
    journeyFilter,
    journeyByCompany,
    renewalDaysByCompany,
    openTaskCountByCompany
  ]);

  const sorted = useMemo(() => {
    const defaultSort = (a: typeof companies[number], b: typeof companies[number]) => {
      const ax = a.karuteNo ?? Number.POSITIVE_INFINITY;
      const bx = b.karuteNo ?? Number.POSITIVE_INFINITY;
      if (ax !== bx) return ax - bx;
      return a.id.localeCompare(b.id);
    };

    if (!sortColumn) {
      return [...filtered].sort(defaultSort);
    }

    const dir = sortDir === "asc" ? 1 : -1;
    // 列ごとのキー取得関数
    const cmp = (a: typeof companies[number], b: typeof companies[number]): number => {
      switch (sortColumn) {
        case "no": {
          const ax = a.karuteNo ?? Number.POSITIVE_INFINITY;
          const bx = b.karuteNo ?? Number.POSITIVE_INFINITY;
          return ax - bx;
        }
        case "name":
          return a.name.localeCompare(b.name, "ja");
        case "contracts": {
          // コース名で比較（複数あれば先頭の表示と同じ最若コース名）
          const courseNameOf = (companyId: string): string => {
            const codes = Array.from(
              new Set(
                activeContracts
                  .filter((ac) => ac.companyId === companyId)
                  .map((ac) => ({ product: ac.product, courseKey: ac.courseKey }))
                  .map((x) => `${x.product}:${x.courseKey}`)
              )
            );
            if (codes.length === 0) return "";
            // ソート用に各 (product, course) → 表示名を作る
            const labels = codes
              .map((k) => {
                const [product, ck] = k.split(":") as [ProductCode, string];
                return hasMultipleCourses(product)
                  ? courseShortName(product, ck)
                  : productByCode[product].shortName;
              })
              .sort((x, y) => x.localeCompare(y, "ja"));
            return labels[0];
          };
          return courseNameOf(a.id).localeCompare(courseNameOf(b.id), "ja");
        }
        case "journey": {
          // 未設定は -1 として最後（asc では先頭、desc では末尾は反転で対応）
          const ax = journeyByCompany.get(a.id)?.displayOrder ?? -1;
          const bx = journeyByCompany.get(b.id)?.displayOrder ?? -1;
          return ax - bx;
        }
        case "revenue": {
          const ax = totalRevenueByCompany.get(a.id) ?? 0;
          const bx = totalRevenueByCompany.get(b.id) ?? 0;
          return ax - bx;
        }
        case "renewal": {
          const ax = renewalDaysByCompany.get(a.id) ?? Number.POSITIVE_INFINITY;
          const bx = renewalDaysByCompany.get(b.id) ?? Number.POSITIVE_INFINITY;
          return ax - bx;
        }
        case "tasks": {
          const ax = openTaskCountByCompany.get(a.id) ?? 0;
          const bx = openTaskCountByCompany.get(b.id) ?? 0;
          return ax - bx;
        }
        case "owner":
          return a.ownerName.localeCompare(b.ownerName, "ja");
        case "lastTouch":
          return (a.lastTouchDays ?? 0) - (b.lastTouchDays ?? 0);
        default:
          return 0;
      }
    };
    return [...filtered].sort((a, b) => {
      const r = cmp(a, b);
      if (r !== 0) return r * dir;
      return defaultSort(a, b);
    });
  }, [
    filtered,
    sortColumn,
    sortDir,
    journeyByCompany,
    totalRevenueByCompany,
    renewalDaysByCompany,
    openTaskCountByCompany
  ]);

  return (
    <>
      <TopNav current="/companies" />
      <main className="mx-auto max-w-[1720px] px-6 py-4 flex flex-col gap-3 h-[calc(100vh-56px)]">
        {/* ヘッダ — 1行コンパクト */}
        <section className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold tracking-tight">
              <span className="brand-text-gradient">企業</span>
            </h1>
            <span className="text-xs text-ink-500">
              全 {companies.length} 社 / 表示 {filtered.length} 社
            </span>
          </div>
          <Link
            href="/companies/new"
            className="px-3 py-1.5 rounded-full bg-white border border-ink-100 text-xs text-ink-700 shadow-liquid hover:bg-ink-50"
          >
            + 企業を追加
          </Link>
        </section>

        {/* フィルタ — 1セクションに集約 */}
        <section className="liquid-surface p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="企業名・業種で検索"
              className="flex-1 min-w-[200px] px-3 py-1.5 rounded-full border border-ink-100 bg-white text-xs focus:outline-none focus:border-ink-300"
            />

            {sortColumn && (
              <button
                onClick={() => {
                  setSortColumn(null);
                  setSortDir("asc");
                }}
                className="text-[11px] text-ink-500 hover:text-ink-700 px-2"
              >
                並び替え解除
              </button>
            )}
          </div>

          {/* フィルタは列の並び順に揃える: 契約事業 → ジャーニー → タスク → 主担当 → アラート
              契約事業は左寄せ、それ以外は右寄せ */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 契約事業 (研修バッジ) — 左寄せ */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-ink-500">契約事業:</span>
              {products.map((p) => {
                const active = productFilter.includes(p.code);
                return (
                  <button
                    key={p.code}
                    onClick={() => toggleProduct(p.code)}
                    className={[
                      "inline-flex items-center gap-1 rounded-full text-xs px-2 py-0.5 border transition",
                      active ? "font-semibold" : "text-ink-700 hover:bg-ink-50"
                    ].join(" ")}
                    style={
                      active
                        ? {
                            color: p.accent,
                            borderColor: `${p.accent}66`,
                            background: `${p.accent}15`
                          }
                        : { borderColor: "#EEF0F3", background: "white" }
                    }
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: p.accent }}
                    />
                    {p.shortName}
                  </button>
                );
              })}
              {productFilter.length > 0 && (
                <button
                  onClick={() => setProductFilter([])}
                  className="text-[11px] text-ink-500 hover:text-ink-700 ml-1"
                >
                  クリア
                </button>
              )}
            </div>

            {/* 右寄せグループ: ジャーニー / タスク / 主担当 / アラート */}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {/* 企業ジャーニー */}
              <select
                value={journeyFilter}
                onChange={(e) => setJourneyFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-full border border-ink-100 bg-white text-xs text-ink-700"
              >
                <option value="all">ジャーニー: すべて</option>
                <option value="__none__">未設定</option>
                {DEFAULT_COMPANY_STAGES.map((s) => (
                  <option key={s.stageKey} value={s.stageKey}>
                    {s.name}
                  </option>
                ))}
              </select>

              {/* タスク */}
              <select
                value={taskFilter}
                onChange={(e) => setTaskFilter(e.target.value as TaskFilter)}
                className="px-2.5 py-1.5 rounded-full border border-ink-100 bg-white text-xs text-ink-700"
              >
                {taskOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              {/* 主担当 */}
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="px-2.5 py-1.5 rounded-full border border-ink-100 bg-white text-xs text-ink-700"
              >
                <option value="all">担当者: すべて</option>
                {owners.map((o) => (
                  <option key={o} value={o}>
                    担当: {o}
                  </option>
                ))}
              </select>

              {/* アラート (Health) */}
              <div className="flex items-center gap-1 rounded-full border border-ink-100 bg-white p-0.5">
                {healthOptions.map((h) => {
                  const active = health === h.value;
                  return (
                    <button
                      key={h.value}
                      onClick={() => setHealth(h.value)}
                      className={[
                        "px-2.5 py-0.5 rounded-full text-xs transition flex items-center gap-1",
                        active ? "bg-ink-900 text-white" : "text-ink-700 hover:bg-ink-50"
                      ].join(" ")}
                    >
                      {h.dot && (
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: h.dot }}
                        />
                      )}
                      {h.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

        </section>

        {/* テーブル — flex-1 で残り高さを占有、内部スクロール + ヘッダ sticky */}
        <section className="liquid-surface flex-1 min-h-0 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
              <tr className="text-left text-[11px] text-ink-500">
                <SortableTh col="no" sortColumn={sortColumn} sortDir={sortDir} onSort={cycleSort} className="px-3 py-2 whitespace-nowrap">No.</SortableTh>
                <SortableTh col="name" sortColumn={sortColumn} sortDir={sortDir} onSort={cycleSort} className="px-5 py-2">企業名</SortableTh>
                <SortableTh col="contracts" sortColumn={sortColumn} sortDir={sortDir} onSort={cycleSort} className="px-3 py-2">契約事業</SortableTh>
                <SortableTh col="journey" sortColumn={sortColumn} sortDir={sortDir} onSort={cycleSort} className="px-3 py-2 whitespace-nowrap">企業ジャーニー</SortableTh>
                <SortableTh col="revenue" sortColumn={sortColumn} sortDir={sortDir} onSort={cycleSort} className="px-3 py-2 text-right whitespace-nowrap" align="right">累計売上</SortableTh>
                <SortableTh col="renewal" sortColumn={sortColumn} sortDir={sortDir} onSort={cycleSort} className="px-3 py-2 whitespace-nowrap">更新まで</SortableTh>
                <SortableTh col="tasks" sortColumn={sortColumn} sortDir={sortDir} onSort={cycleSort} className="px-3 py-2 whitespace-nowrap">未対応タスク</SortableTh>
                <SortableTh col="owner" sortColumn={sortColumn} sortDir={sortDir} onSort={cycleSort} className="px-3 py-2">主担当</SortableTh>
                <SortableTh col="lastTouch" sortColumn={sortColumn} sortDir={sortDir} onSort={cycleSort} className="px-5 py-2 whitespace-nowrap">最終接点 / アラート</SortableTh>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50 transition"
                >
                  <td className="px-3 py-3 text-[11px] font-mono text-ink-500 whitespace-nowrap">
                    {typeof c.karuteNo === "number"
                      ? String(c.karuteNo).padStart(3, "0")
                      : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const weather = weatherOverrides.get(c.id);
                        return (
                          <div className="relative w-7 h-7 shrink-0">
                            {c.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={c.logoUrl}
                                alt=""
                                className="w-7 h-7 rounded-lg border border-ink-100 bg-white object-cover"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-lg border border-ink-100 bg-ink-50 flex items-center justify-center text-[10px] text-ink-500 font-medium">
                                {c.name.slice(0, 1)}
                              </div>
                            )}
                            {weather && (
                              <span className="absolute -top-1.5 -right-1.5 leading-none drop-shadow-sm">
                                <WeatherIcon weather={weather} size="sm" />
                              </span>
                            )}
                          </div>
                        );
                      })()}
                      <Link
                        href={`/companies/${c.id}`}
                        className="font-medium text-ink-900 hover:underline"
                      >
                        {c.name}
                      </Link>
                      {(c.isDemo ?? true) && (
                        <span
                          title="デモデータ (is_demo=true)"
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
                        >
                          🚧
                        </span>
                      )}
                    </div>
                    {c.group && (
                      <div className="text-[11px] text-ink-500 mt-0.5">
                        {c.group}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(() => {
                        // 表示方針:
                        //  - 各事業の「コース名」のみをチップ化（色で事業を判別）
                        //  - 評議会は アカデミア付帯のため通常非表示。
                        //    ただし productFilter に hyogikai が含まれる場合は明示表示
                        const hasActiveAcademia = activeContracts.some(
                          (ac) => ac.companyId === c.id && ac.product === "academia"
                        );
                        const showHyogikai = productFilter.includes("hyogikai");
                        const visibleCodes = c.contracts.filter((code) => {
                          if (code === "hyogikai") {
                            // アカデミア付帯の評議会は通常隠す。
                            // フィルタで明示指定された時のみ表示
                            if (hasActiveAcademia && !showHyogikai) return false;
                          }
                          return true;
                        });
                        const chips: React.ReactNode[] = [];
                        for (const code of visibleCodes) {
                          const acc = productByCode[code].accent;
                          const myCourseKeys = Array.from(
                            new Set(
                              activeContracts
                                .filter(
                                  (ac) =>
                                    ac.companyId === c.id && ac.product === code
                                )
                                .map((ac) => ac.courseKey)
                            )
                          );
                          // コースが取れない（過去契約のみ等）→ 商材名で代替
                          const labels =
                            myCourseKeys.length > 0
                              ? myCourseKeys.map((ck) =>
                                  hasMultipleCourses(code)
                                    ? courseShortName(code, ck)
                                    : productByCode[code].shortName
                                )
                              : [productByCode[code].shortName];
                          for (const label of labels) {
                            chips.push(
                              <span
                                key={`${code}:${label}`}
                                title={productByCode[code].name}
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                                style={{
                                  color: acc,
                                  background: `${acc}14`,
                                  border: `1px solid ${acc}33`
                                }}
                              >
                                {label}
                              </span>
                            );
                          }
                        }
                        return chips;
                      })()}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {(() => {
                      const j = journeyByCompany.get(c.id);
                      if (!j) return <span className="text-[11px] text-ink-400">未設定</span>;
                      return (
                        <span
                          className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border"
                          style={{
                            color: j.color ?? "#4B5563",
                            background: `${j.color ?? "#9CA3AF"}14`,
                            borderColor: `${j.color ?? "#9CA3AF"}55`
                          }}
                          title={j.name}
                        >
                          {j.name}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-3 text-right text-ink-900 font-medium whitespace-nowrap">
                    {(() => {
                      const total = totalRevenueByCompany.get(c.id) ?? 0;
                      return total > 0 ? yen(total) : <span className="text-ink-400 font-normal">—</span>;
                    })()}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {(() => {
                      const days = renewalDaysByCompany.get(c.id);
                      if (days === undefined) return <span className="text-ink-400 text-xs">—</span>;
                      const tone =
                        days < 0
                          ? "text-rose-600 font-semibold"
                          : days <= 60
                          ? "text-rose-600 font-semibold"
                          : days <= 120
                          ? "text-amber-600 font-medium"
                          : "text-ink-700";
                      const label = days < 0 ? `${-days}日超過` : `残${days}日`;
                      return <span className={tone}>{label}</span>;
                    })()}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {(() => {
                      const count = openTaskCountByCompany.get(c.id) ?? 0;
                      if (count === 0) {
                        return <span className="text-ink-400 text-xs">—</span>;
                      }
                      return (
                        <Link
                          href={`/companies/${c.id}?tab=tasks`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ink-50 text-ink-700 text-xs font-medium hover:bg-ink-100"
                          title={`未対応タスク ${count} 件 (クリックで詳細へ)`}
                        >
                          {count}件 →
                        </Link>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-3 text-ink-700 whitespace-nowrap">
                    {c.ownerName}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-ink-500 text-xs">{c.lastTouchDays}日前</span>
                      {(() => {
                        const h = companyHealthColor(c.id);
                        if (h === "green") return null;
                        const tone =
                          h === "red"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-amber-50 text-amber-700 border-amber-200";
                        return (
                          <span
                            className={["text-[10px] font-medium px-1.5 py-0.5 rounded-full border", tone].join(" ")}
                            title={`Health: ${h.toUpperCase()}`}
                          >
                            ⚠ {h === "red" ? "Red" : "Yellow"}
                          </span>
                        );
                      })()}
                    </div>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-12 text-center text-sm text-ink-500"
                  >
                    該当する企業がありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
