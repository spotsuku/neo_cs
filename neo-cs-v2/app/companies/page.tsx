"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { ProductBadge } from "@/components/ProductBadge";
import { CompletenessBadge } from "@/components/CompletenessChecklistCard";
import "@/lib/mock/karute-no-init"; // companies seed に karuteNo を付与 (side-effect)
import { companies, contacts as allContacts } from "@/lib/mock/entities";
import { activeContracts, contractOnboardingItems } from "@/lib/mock/onboarding";
import { stakeholders as allStakeholders } from "@/lib/mock/cycles";
import { companyHealthColor } from "@/lib/mock/health";
import { checkCompanyCompleteness } from "@/lib/domain/completeness";
// コース表示に対応
import { ProductCode, products, yen, hasMultipleCourses, courseShortName, productByCode } from "@/lib/mock/data";

type SortKey = "default" | "completeness_asc" | "completeness_desc";

type HealthFilter = "all" | "green" | "yellow" | "red";

const healthOptions: { value: HealthFilter; label: string; dot: string }[] = [
  { value: "all", label: "すべて", dot: "" },
  { value: "green", label: "Green", dot: "#10B981" },
  { value: "yellow", label: "Yellow", dot: "#F59E0B" },
  { value: "red", label: "Red", dot: "#EF4444" }
];

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

export default function CompaniesPage() {
  const [q, setQ] = useState("");
  const [health, setHealth] = useState<HealthFilter>("all");
  const [productFilter, setProductFilter] = useState<ProductCode[]>([]);
  const [owner, setOwner] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("default");
  // 🚧 デモ非表示トグル (本番開始前は OFF=全表示が合理的)
  const [hideDemo, setHideDemo] = useState<boolean>(false);

  // 企業ごとの完成度スコアを計算 (純関数)。companies は固定なので useMemo
  const completenessByCompany = useMemo(() => {
    const map = new Map<string, number>();
    companies.forEach((c) => {
      const r = checkCompanyCompleteness({
        company: { id: c.id, name: c.name, industry: c.industry },
        contacts: allContacts
          .filter((p) => p.companyId === c.id)
          .map((p) => ({
            isPrimary: p.isPrimary,
            name: p.name,
            email: p.email,
            title: p.title
          })),
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
        stakeholders: allStakeholders
          .filter((s) => s.companyId === c.id)
          .map((s) => ({ type: s.type })),
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
        const has = productFilter.every((p) => c.contracts.includes(p));
        if (!has) return false;
      }
      if (owner !== "all" && c.ownerName !== owner) return false;
      // is_demo: undefined は true 扱い (mock seed が isDemo フィールド持たないため)
      const isDemo = c.isDemo ?? true;
      if (hideDemo && isDemo) return false;
      return true;
    });
  }, [q, health, productFilter, owner, hideDemo]);

  const sorted = useMemo(() => {
    if (sortKey === "default") {
      // デフォルトはカルテNo. 昇順 (= 契約順)
      return [...filtered].sort((a, b) => {
        const ax = a.karuteNo ?? Number.POSITIVE_INFINITY;
        const bx = b.karuteNo ?? Number.POSITIVE_INFINITY;
        if (ax !== bx) return ax - bx;
        return a.id.localeCompare(b.id);
      });
    }
    const dir = sortKey === "completeness_asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const sa = completenessByCompany.get(a.id) ?? 0;
      const sb = completenessByCompany.get(b.id) ?? 0;
      return (sa - sb) * dir;
    });
  }, [filtered, sortKey, completenessByCompany]);

  return (
    <>
      <TopNav current="/companies" />
      <main className="mx-auto max-w-[1400px] px-6 py-8 space-y-6">
        {/* ヘッダ */}
        <section className="flex items-end justify-between">
          <div>
            <div className="text-xs text-ink-500 font-medium">Customer Success</div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              <span className="brand-text-gradient">企業</span>
            </h1>
            <div className="mt-1 text-sm text-ink-500">
              全 {companies.length} 社 / 表示 {filtered.length} 社
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/companies/new"
              className="px-4 py-2 rounded-full bg-white border border-ink-100 text-sm text-ink-700 shadow-liquid hover:bg-ink-50"
            >
              + 企業を追加
            </Link>
          </div>
        </section>

        {/* フィルタ */}
        <section className="liquid-surface p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="企業名・業種で検索"
              className="flex-1 min-w-[240px] px-4 py-2 rounded-full border border-ink-100 bg-white text-sm focus:outline-none focus:border-ink-300"
            />

            <div className="flex items-center gap-1 rounded-full border border-ink-100 bg-white p-1">
              {healthOptions.map((h) => {
                const active = health === h.value;
                return (
                  <button
                    key={h.value}
                    onClick={() => setHealth(h.value)}
                    className={[
                      "px-3 py-1 rounded-full text-xs transition flex items-center gap-1.5",
                      active
                        ? "bg-ink-900 text-white"
                        : "text-ink-700 hover:bg-ink-50"
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

            <select
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="px-3 py-2 rounded-full border border-ink-100 bg-white text-sm text-ink-700"
            >
              <option value="all">担当者: すべて</option>
              {owners.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>

            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="px-3 py-2 rounded-full border border-ink-100 bg-white text-sm text-ink-700"
              title="完成度で並び替え"
            >
              <option value="default">並び替え: 既定</option>
              <option value="completeness_asc">完成度: 低い順</option>
              <option value="completeness_desc">完成度: 高い順</option>
            </select>

            {/* 🚧 デモ非表示トグル (0019_is_demo_flag.sql) */}
            <label className="inline-flex items-center gap-1.5 text-xs text-ink-700 px-3 py-2 rounded-full border border-ink-100 bg-white cursor-pointer">
              <input
                type="checkbox"
                checked={hideDemo}
                onChange={(e) => setHideDemo(e.target.checked)}
              />
              🚧 デモ非表示
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-ink-500">研修:</span>
            {products.map((p) => {
              const active = productFilter.includes(p.code);
              return (
                <button
                  key={p.code}
                  onClick={() => toggleProduct(p.code)}
                  className={[
                    "inline-flex items-center gap-1 rounded-full text-xs px-2.5 py-1 border transition",
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
        </section>

        {/* テーブル */}
        <section className="liquid-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-ink-500 border-b border-ink-100">
                <th className="px-3 py-3 font-medium whitespace-nowrap">No.</th>
                <th className="px-5 py-3 font-medium">企業名</th>
                <th className="px-3 py-3 font-medium">業種</th>
                <th className="px-3 py-3 font-medium">契約研修</th>
                <th className="px-3 py-3 font-medium">Health</th>
                <th className="px-3 py-3 font-medium">完成度</th>
                <th className="px-3 py-3 font-medium text-right">MRR</th>
                <th className="px-3 py-3 font-medium">主担当</th>
                <th className="px-5 py-3 font-medium whitespace-nowrap">最終接点</th>
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
                    <div className="flex items-center gap-1.5">
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
                  <td className="px-3 py-3 text-ink-700">{c.industry}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(() => {
                        // アカデミア契約があれば、評議会は「付帯」扱いで重複表示しない。
                        // 表示用に hyogikai を contracts から除外。
                        const hasActiveAcademia = activeContracts.some(
                          (ac) => ac.companyId === c.id && ac.product === "academia"
                        );
                        const visibleCodes = hasActiveAcademia
                          ? c.contracts.filter((code) => code !== "hyogikai")
                          : c.contracts;
                        return visibleCodes.map((code) => {
                          const acc = productByCode[code].accent;
                          const courseKeys = hasMultipleCourses(code)
                            ? Array.from(
                                new Set(
                                  activeContracts
                                    .filter((ac) => ac.companyId === c.id && ac.product === code)
                                    .map((ac) => ac.courseKey)
                                )
                              )
                            : [];
                          return (
                            <span key={code} className="inline-flex items-center gap-1">
                              <ProductBadge code={code} size="sm" />
                              {/* アカデミアには評議会付帯を明示 */}
                              {code === "academia" && (
                                <span
                                  title="アカデミア契約には評議会参加権が付帯します"
                                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200"
                                >
                                  +評議会
                                </span>
                              )}
                              {courseKeys.map((ck) => (
                                <span
                                  key={ck}
                                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                                  style={{
                                    color: acc,
                                    background: `${acc}14`,
                                    border: `1px solid ${acc}33`
                                  }}
                                >
                                  {courseShortName(code, ck)}
                                </span>
                              ))}
                            </span>
                          );
                        });
                      })()}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <HealthDot color={companyHealthColor(c.id)} />
                  </td>
                  <td className="px-3 py-3">
                    <CompletenessBadge score={completenessByCompany.get(c.id) ?? 0} />
                  </td>
                  <td className="px-3 py-3 text-right text-ink-900 font-medium whitespace-nowrap">
                    {yen(c.mrr)}
                  </td>
                  <td className="px-3 py-3 text-ink-700 whitespace-nowrap">
                    {c.ownerName}
                  </td>
                  <td className="px-5 py-3 text-ink-500 whitespace-nowrap">
                    {c.lastTouchDays}日前
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
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
