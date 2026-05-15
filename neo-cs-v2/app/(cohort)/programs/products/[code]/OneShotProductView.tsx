"use client";

// 単発回型 (aiken/commu) の事業別ビュー
//
// 1日程 = 1コース 前提のテーブル:
//   - 縦軸: 企業
//   - 横軸: 各 (回 × コース) を 1列として横並び
//   - 列ヘッダ: 第N回 + コース + 日程 + 単価入力
//   - セル: 参加人数 + ステータス
//   - 右端列: コース別累計参加人数 + 売上内訳

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Company } from "@/lib/mock/entities";
import type { ActiveContract } from "@/lib/master/onboarding";
import {
  yen,
  courseShortName,
  type ProductCode
} from "@/lib/master";

type CellStatus = "consent" | "contracted" | "completed" | "churned";

const CELL_STATUS_LABEL: Record<CellStatus, string> = {
  consent: "内諾",
  contracted: "契約完了",
  completed: "実施完了",
  churned: "解約"
};

const CELL_STATUS_TONE: Record<CellStatus, string> = {
  consent: "bg-amber-50 text-amber-700 border-amber-200",
  contracted: "bg-sky-50 text-sky-700 border-sky-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  churned: "bg-rose-50 text-rose-700 border-rose-200"
};

function deriveCellStatus(c: ActiveContract): CellStatus {
  if (c.status === "churned") return "churned";
  if (c.status === "renewed") return "completed";
  if (c.status === "onboarding" || c.status === "handoff") return "consent";
  return "contracted";
}

function isConfirmed(s: CellStatus): boolean {
  return s === "contracted" || s === "completed";
}

type ColumnKey = string; // `${cycle}:${courseKey}`

type Column = {
  key: ColumnKey;
  cycle: number;
  courseKey: string;
  startDate: string | null;
  endDate: string | null;
  contractsInCol: ActiveContract[];
};

export function OneShotProductView({
  productCode,
  contracts,
  companies,
  cycleLabelFormat,
  cycleUnit,
  accent
}: {
  productCode: ProductCode;
  contracts: ActiveContract[];
  companies: Company[];
  courses: { key: string; name: string; shortName: string }[];
  cycleLabelFormat: string;
  cycleUnit: string;
  accent: string;
}) {
  const companyById = new Map(companies.map((c) => [c.id, c]));

  // (cycle, courseKey) ごとに列をグループ
  const columns: Column[] = useMemo(() => {
    const grouped = new Map<ColumnKey, Column>();
    for (const c of contracts) {
      const k: ColumnKey = `${c.cycleNumber}:${c.courseKey}`;
      const existing = grouped.get(k);
      if (existing) {
        existing.contractsInCol.push(c);
        // 日程: 最初の契約の startDate/endDate を採用
        if (!existing.startDate && c.startDate) existing.startDate = c.startDate;
        if (!existing.endDate && c.endDate) existing.endDate = c.endDate;
      } else {
        grouped.set(k, {
          key: k,
          cycle: c.cycleNumber,
          courseKey: c.courseKey,
          startDate: c.startDate ?? null,
          endDate: c.endDate ?? null,
          contractsInCol: [c]
        });
      }
    }
    return Array.from(grouped.values()).sort((a, b) => {
      // 開始日順 → cycle → course の順で安定ソート
      if (a.startDate && b.startDate && a.startDate !== b.startDate) {
        return a.startDate < b.startDate ? -1 : 1;
      }
      if (a.cycle !== b.cycle) return a.cycle - b.cycle;
      return a.courseKey.localeCompare(b.courseKey);
    });
  }, [contracts]);

  const allCompanyIds = useMemo(
    () => Array.from(new Set(contracts.map((c) => c.companyId))),
    [contracts]
  );

  // 企業×列 マトリクス
  const matrix = useMemo(() => {
    const m = new Map<string, Map<ColumnKey, ActiveContract>>();
    for (const cid of allCompanyIds) m.set(cid, new Map());
    for (const c of contracts) {
      const k: ColumnKey = `${c.cycleNumber}:${c.courseKey}`;
      m.get(c.companyId)?.set(k, c);
    }
    return m;
  }, [allCompanyIds, contracts]);

  // 単価 (列ごと) — ローカルステート
  const initialPrices = useMemo(() => {
    const map: Record<string, number> = {};
    for (const col of columns) {
      const sample = col.contractsInCol[0];
      if (!sample) continue;
      const part = sample.participants ?? 1;
      map[col.key] =
        part > 0 ? Math.round((sample.mrr ?? 0) / part) : sample.mrr ?? 0;
    }
    return map;
  }, [columns]);
  const [prices, setPrices] = useState<Record<string, number>>(initialPrices);

  const setPrice = (k: ColumnKey, val: number) => {
    setPrices((prev) => ({ ...prev, [k]: val }));
  };

  // 全体 KPI
  const totalParticipants = contracts.reduce(
    (s, c) => s + (c.participants ?? 0),
    0
  );
  const totalConfirmed = contracts
    .filter((c) => isConfirmed(deriveCellStatus(c)))
    .reduce((s, c) => s + (c.mrr ?? 0), 0);
  const totalExpected = contracts
    .filter((c) => deriveCellStatus(c) === "consent")
    .reduce((s, c) => s + (c.mrr ?? 0), 0);

  const sortedCompanyIds = useMemo(() => {
    return allCompanyIds.slice().sort((a, b) => {
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
  }, [allCompanyIds, contracts]);

  const cycleSet = useMemo(
    () => Array.from(new Set(columns.map((c) => c.cycle))).sort((a, b) => a - b),
    [columns]
  );

  return (
    <div className="space-y-4">
      {/* 全体 KPI */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label={`実施${cycleUnit}数`} value={`${cycleSet.length}`} accent={accent} />
        <KpiCard label="参加企業" value={`${allCompanyIds.length}社`} accent={accent} />
        <KpiCard label="累計参加" value={`${totalParticipants}名`} accent={accent} />
        <KpiCard
          label="累計売上"
          value={yen(totalConfirmed + totalExpected)}
          subValue={`確定 ${yen(totalConfirmed)} ／ 見込 ${yen(totalExpected)}`}
          accent={accent}
        />
      </section>

      {/* マトリクス */}
      <section className="liquid-surface overflow-x-auto">
        <table className="text-[12px] tabular-nums" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr className="border-b border-ink-100">
              <th className="px-3 py-2 text-left text-[11px] font-medium text-ink-500 sticky left-0 bg-white z-10 min-w-[160px]">
                企業
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-2 py-2 text-left font-normal border-l border-ink-100/70 align-top whitespace-nowrap"
                >
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-bold text-ink-900">
                      {cycleLabelFormat.replace("{n}", String(col.cycle))}
                    </span>
                    <span
                      className="text-[10px] px-1 py-0.5 rounded font-medium"
                      style={{ background: `${accent}14`, color: accent }}
                    >
                      {courseShortName(productCode, col.courseKey)}
                    </span>
                  </div>
                  {(col.startDate || col.endDate) && (
                    <div className="text-[10px] text-ink-500 mt-0.5">
                      {col.startDate ?? "—"}
                      {col.endDate ? ` 〜 ${col.endDate.slice(5)}` : ""}
                    </div>
                  )}
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[10px] text-ink-500">¥</span>
                    <input
                      type="number"
                      value={prices[col.key] ?? 0}
                      onChange={(e) => setPrice(col.key, Number(e.target.value) || 0)}
                      min={0}
                      step={10000}
                      className="w-24 text-[11px] tabular-nums px-1 py-0.5 rounded border border-ink-200 focus:outline-hidden focus:ring-1 focus:ring-blue-300"
                      title={`${cycleLabelFormat.replace("{n}", String(col.cycle))} ${courseShortName(productCode, col.courseKey)} の単価`}
                    />
                  </div>
                </th>
              ))}
              <th className="px-2 py-2 text-left text-[11px] font-medium text-ink-500 border-l-2 border-ink-200 bg-ink-50/40 sticky right-0 z-10 min-w-[140px]">
                累計
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedCompanyIds.map((cid) => {
              const co = companyById.get(cid);
              const row = matrix.get(cid)!;

              const myContracts = contracts.filter((c) => c.companyId === cid);
              const totalsByCourse: Record<string, { participants: number }> = {};
              let confirmed = 0;
              let expected = 0;
              for (const c of myContracts) {
                const status = deriveCellStatus(c);
                if (status === "churned") continue;
                const ck = c.courseKey;
                const t = totalsByCourse[ck] ?? { participants: 0 };
                t.participants += c.participants ?? 0;
                totalsByCourse[ck] = t;
                if (isConfirmed(status)) confirmed += c.mrr ?? 0;
                else if (status === "consent") expected += c.mrr ?? 0;
              }

              return (
                <tr
                  key={cid}
                  className="border-b border-ink-50 last:border-0 hover:bg-ink-50/40"
                >
                  <td className="px-3 py-1.5 sticky left-0 bg-white">
                    <Link
                      href={`/companies/${cid}`}
                      className="text-ink-900 hover:underline font-medium text-[13px]"
                    >
                      {co?.name ?? cid}
                    </Link>
                  </td>

                  {columns.map((col) => {
                    const cell = row.get(col.key);
                    return (
                      <td
                        key={col.key}
                        className="px-2 py-1.5 border-l border-ink-100/70 align-middle whitespace-nowrap"
                      >
                        {cell ? (
                          <CellContent contract={cell} />
                        ) : (
                          <span className="text-[11px] text-ink-300">—</span>
                        )}
                      </td>
                    );
                  })}

                  <td className="px-2 py-1.5 border-l-2 border-ink-200 bg-ink-50/40 sticky right-0 align-top">
                    <div className="space-y-1 min-w-[120px]">
                      {Object.entries(totalsByCourse).length === 0 ? (
                        <span className="text-[10px] text-ink-400">—</span>
                      ) : (
                        Object.entries(totalsByCourse).map(([ck, t]) => (
                          <div
                            key={ck}
                            className="flex items-center justify-between gap-1.5 text-[10px]"
                          >
                            <span
                              className="px-1 py-0.5 rounded font-medium"
                              style={{ background: `${accent}14`, color: accent }}
                            >
                              {courseShortName(productCode, ck)}
                            </span>
                            <span className="text-ink-700">{t.participants}名</span>
                          </div>
                        ))
                      )}
                      <div className="pt-0.5 mt-0.5 border-t border-ink-200 space-y-0.5 text-[10px]">
                        <Row label="確定" value={yen(confirmed)} tone="text-emerald-700" />
                        <Row label="見込" value={yen(expected)} tone="text-amber-700" />
                        <Row label="合計" value={yen(confirmed + expected)} tone="text-ink-900 font-bold" bold />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  bold
}: {
  label: string;
  value: string;
  tone: string;
  bold?: boolean;
}) {
  return (
    <div className={["flex items-center justify-between gap-1.5", bold ? "border-t border-ink-200 pt-0.5" : ""].join(" ")}>
      <span className="text-ink-500">{label}</span>
      <span className={tone}>{value}</span>
    </div>
  );
}

function CellContent({ contract }: { contract: ActiveContract }) {
  const status = deriveCellStatus(contract);
  const participants = contract.participants ?? 0;
  return (
    <div className="space-y-0.5">
      <div className="text-[13px] font-bold text-ink-900">
        {participants}
        <span className="text-[10px] font-normal text-ink-500 ml-0.5">名</span>
      </div>
      <span
        className={[
          "inline-block text-[10px] px-1 py-0.5 rounded border font-medium",
          CELL_STATUS_TONE[status]
        ].join(" ")}
      >
        {CELL_STATUS_LABEL[status]}
      </span>
    </div>
  );
}

function KpiCard({
  label,
  value,
  subValue,
  accent
}: {
  label: string;
  value: string;
  subValue?: string;
  accent: string;
}) {
  return (
    <div className="liquid-surface p-3 relative overflow-hidden">
      <div
        className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-10"
        style={{ background: accent }}
      />
      <div className="text-[10px] text-ink-500">{label}</div>
      <div className="text-lg font-bold text-ink-900 tabular-nums mt-0.5">
        {value}
      </div>
      {subValue && (
        <div className="text-[10px] text-ink-500 mt-0.5">{subValue}</div>
      )}
    </div>
  );
}
