// 年間更新型 (academia/hyogikai) の事業別ビュー
//
// 期 (cycleNumber) ごとに「列」を作り、参加企業を縦に並べる。
// 列間に期遷移の小さな矢印・ステータス（renewed/active/churned）を表示。

import Link from "next/link";
import type { Company } from "@/lib/mock/entities";
import type { ActiveContract } from "@/lib/mock/onboarding";
import { yen, courseShortName, hasMultipleCourses, type ProductCode } from "@/lib/master";

const CYCLE_STATUS_LABEL: Record<string, string> = {
  active: "実施中",
  renewed: "更新済",
  churned: "解約",
  onboarding: "オンボ中",
  renewal_window: "更新期",
  handoff: "引継中",
  expired: "期満了"
};

const CYCLE_STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-100",
  renewed: "bg-sky-50 text-sky-700 border-sky-100",
  churned: "bg-rose-50 text-rose-700 border-rose-100",
  onboarding: "bg-amber-50 text-amber-700 border-amber-100",
  renewal_window: "bg-violet-50 text-violet-700 border-violet-100",
  handoff: "bg-ink-50 text-ink-700 border-ink-200",
  expired: "bg-ink-50 text-ink-500 border-ink-100"
};

export function ContinuousProductView({
  productCode,
  contracts,
  companies,
  courses,
  cycleLabelFormat,
  cycleUnit
}: {
  productCode: ProductCode;
  contracts: ActiveContract[];
  companies: Company[];
  courses: { key: string; name: string; shortName: string }[];
  cycleLabelFormat: string;
  cycleUnit: string;
}) {
  const companyById = new Map(companies.map((c) => [c.id, c]));
  const cycleNumbers = Array.from(
    new Set(contracts.map((c) => c.cycleNumber))
  ).sort((a, b) => a - b);

  // 全契約から「会社×期」マトリクスを作成
  type Cell = ActiveContract | null;
  const allCompanyIds = Array.from(new Set(contracts.map((c) => c.companyId)));
  const matrix = new Map<string, Map<number, Cell>>();
  for (const cid of allCompanyIds) {
    const m = new Map<number, Cell>();
    for (const cn of cycleNumbers) m.set(cn, null);
    matrix.set(cid, m);
  }
  for (const c of contracts) {
    matrix.get(c.companyId)?.set(c.cycleNumber, c);
  }

  // 期ごとのサマリ
  const cycleSummary = cycleNumbers.map((cn) => {
    const list = contracts.filter((c) => c.cycleNumber === cn);
    return {
      cn,
      label: cycleLabelFormat.replace("{n}", String(cn)),
      total: list.length,
      mrr: list.reduce((s, x) => s + (x.mrr ?? 0), 0),
      active: list.filter((c) => c.status !== "churned" && c.status !== "renewed").length,
      churned: list.filter((c) => c.status === "churned").length,
      renewed: list.filter((c) => c.status === "renewed").length
    };
  });

  // 全社向けの「次期遷移率」: 期n と 期n+1 を比較
  const transitions = cycleNumbers.slice(0, -1).map((cn, i) => {
    const next = cycleNumbers[i + 1];
    const fromIds = new Set(
      contracts.filter((c) => c.cycleNumber === cn).map((c) => c.companyId)
    );
    const toIds = new Set(
      contracts.filter((c) => c.cycleNumber === next).map((c) => c.companyId)
    );
    const continued = Array.from(fromIds).filter((x) => toIds.has(x)).length;
    const dropped = fromIds.size - continued;
    const newAdded = Array.from(toIds).filter((x) => !fromIds.has(x)).length;
    return {
      from: cn,
      to: next,
      continuationRate: fromIds.size > 0 ? continued / fromIds.size : 0,
      continued,
      dropped,
      newAdded
    };
  });

  // 会社の表示順: 最新期に参加 → 過去のみ参加
  const sortedCompanyIds = allCompanyIds.slice().sort((a, b) => {
    const aMax = Math.max(
      ...contracts.filter((c) => c.companyId === a).map((c) => c.cycleNumber),
      0
    );
    const bMax = Math.max(
      ...contracts.filter((c) => c.companyId === b).map((c) => c.cycleNumber),
      0
    );
    return bMax - aMax;
  });

  return (
    <div className="space-y-6">
      {/* 期サマリ */}
      <section>
        <h2 className="text-sm font-semibold text-ink-700 mb-2">期サマリ</h2>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cycleNumbers.length}, minmax(0, 1fr))` }}>
          {cycleSummary.map((s) => (
            <div
              key={s.cn}
              className="liquid-surface p-3"
            >
              <div className="text-xs font-semibold text-ink-700">{s.label}</div>
              <div className="mt-1 text-xl font-bold text-ink-900 tabular-nums">
                {s.total}<span className="text-xs font-normal text-ink-500 ml-1">社</span>
              </div>
              <div className="mt-1 text-[11px] text-ink-500">
                MRR <span className="text-ink-700 font-medium">{yen(s.mrr)}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                {s.active > 0 && <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">実施中 {s.active}</span>}
                {s.renewed > 0 && <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-100">更新済 {s.renewed}</span>}
                {s.churned > 0 && <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100">解約 {s.churned}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 期間遷移 */}
      {transitions.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-ink-700 mb-2">期間遷移（継続率）</h2>
          <div className="liquid-surface p-4">
            <div className="flex items-center gap-2 flex-wrap">
              {transitions.map((t) => (
                <div
                  key={`${t.from}-${t.to}`}
                  className="flex items-center gap-2 bg-ink-50/60 border border-ink-100 rounded-md px-3 py-2 text-xs"
                >
                  <span className="text-ink-500 tabular-nums">第{t.from}{cycleUnit}</span>
                  <span className="text-ink-400">→</span>
                  <span className="text-ink-500 tabular-nums">第{t.to}{cycleUnit}</span>
                  <span
                    className={[
                      "ml-2 px-1.5 py-0.5 rounded font-semibold",
                      t.continuationRate >= 0.8
                        ? "bg-emerald-50 text-emerald-700"
                        : t.continuationRate >= 0.5
                        ? "bg-amber-50 text-amber-700"
                        : "bg-rose-50 text-rose-700"
                    ].join(" ")}
                  >
                    継続率 {Math.round(t.continuationRate * 100)}%
                  </span>
                  <span className="text-[10px] text-ink-500">
                    （継続 {t.continued} / 離脱 {t.dropped} / 新規 +{t.newAdded}）
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* マトリクス: 企業 × 期 */}
      <section>
        <h2 className="text-sm font-semibold text-ink-700 mb-2">参加企業 × 期</h2>
        <div className="liquid-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-ink-500 border-b border-ink-100">
                <th className="px-4 py-3 font-medium sticky left-0 bg-white z-10">企業</th>
                {cycleNumbers.map((cn) => (
                  <th key={cn} className="px-3 py-3 font-medium">
                    {cycleLabelFormat.replace("{n}", String(cn))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedCompanyIds.map((cid) => {
                const co = companyById.get(cid);
                const row = matrix.get(cid)!;
                return (
                  <tr key={cid} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/40">
                    <td className="px-4 py-2.5 sticky left-0 bg-white">
                      <Link
                        href={`/companies/${cid}`}
                        className="text-ink-900 hover:underline font-medium"
                      >
                        {co?.name ?? cid}
                      </Link>
                    </td>
                    {cycleNumbers.map((cn) => {
                      const cell = row.get(cn);
                      if (!cell) {
                        return (
                          <td key={cn} className="px-3 py-2.5 text-[11px] text-ink-300">
                            —
                          </td>
                        );
                      }
                      return (
                        <td key={cn} className="px-3 py-2.5">
                          <div className="space-y-1">
                            <span
                              className={[
                                "inline-block text-[10px] px-1.5 py-0.5 rounded border font-medium",
                                CYCLE_STATUS_TONE[cell.status] ?? "bg-ink-50 text-ink-500 border-ink-100"
                              ].join(" ")}
                            >
                              {CYCLE_STATUS_LABEL[cell.status] ?? cell.status}
                            </span>
                            <div className="text-[11px] text-ink-700">
                              {hasMultipleCourses(productCode)
                                ? courseShortName(productCode, cell.courseKey)
                                : null}
                              {cell.participants && (
                                <span className="ml-1 text-[10px] text-ink-400">
                                  {cell.participants}名
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
