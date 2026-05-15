"use client";

import { useState } from "react";
import { products, ProductCode } from "@/lib/master";
import { HealthDistribution } from "./HealthDistribution";

// Health対象は継続型のみ
const targetProducts = products.filter((p) => p.type === "continuous");

export type HealthByProduct = Record<
  ProductCode,
  { green: number; yellow: number; red: number }
>;

export function HealthSection({ healthByProduct }: { healthByProduct: HealthByProduct }) {
  const [selected, setSelected] = useState<Set<ProductCode>>(
    new Set(targetProducts.map((p) => p.code))
  );

  const toggle = (code: ProductCode) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        // 最低1つは残す
        if (next.size > 1) next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === targetProducts.length) {
      // 全解除 → 先頭1つだけ残す
      setSelected(new Set([targetProducts[0].code]));
    } else {
      setSelected(new Set(targetProducts.map((p) => p.code)));
    }
  };

  const allSelected = selected.size === targetProducts.length;

  const agg = targetProducts
    .filter((p) => selected.has(p.code))
    .reduce(
      (acc, p) => {
        const h = healthByProduct[p.code];
        acc.green += h.green;
        acc.yellow += h.yellow;
        acc.red += h.red;
        return acc;
      },
      { green: 0, yellow: 0, red: 0 }
    );

  const total = agg.green + agg.yellow + agg.red;

  return (
    <div className="liquid-surface p-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="text-xs text-ink-500 font-medium">Customer Health</div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-2xl font-bold">{total}</span>
            <span className="text-sm text-ink-500">社</span>
          </div>
        </div>
      </div>

      {/* 研修切替ボタン（複数選択可） */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <button
          onClick={toggleAll}
          className={[
            "px-2.5 py-1 rounded-full text-xs transition border",
            allSelected
              ? "bg-ink-900 text-white border-ink-900"
              : "bg-white text-ink-700 border-ink-100 hover:bg-ink-50"
          ].join(" ")}
        >
          全体
        </button>
        {targetProducts.map((p) => {
          const on = selected.has(p.code);
          return (
            <button
              key={p.code}
              onClick={() => toggle(p.code)}
              className={[
                "px-2.5 py-1 rounded-full text-xs transition border flex items-center gap-1.5",
                on
                  ? "text-ink-900 font-medium"
                  : "text-ink-500 hover:text-ink-700"
              ].join(" ")}
              style={{
                background: on ? `${p.accent}14` : "white",
                borderColor: on ? `${p.accent}66` : "#EEF0F3"
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: on ? p.accent : "#C4C7CD" }}
              />
              {p.shortName}
              {on && (
                <span className="text-ink-500 font-normal">
                  {healthByProduct[p.code].green +
                    healthByProduct[p.code].yellow +
                    healthByProduct[p.code].red}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <HealthDistribution green={agg.green} yellow={agg.yellow} red={agg.red} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
          <div className="text-[10px] font-semibold text-emerald-700">🟢 Green</div>
          <div className="mt-1 text-xl font-bold text-emerald-700">{agg.green}</div>
          <div className="text-[10px] text-emerald-700/70">順調</div>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3">
          <div className="text-[10px] font-semibold text-amber-700">🟡 Yellow</div>
          <div className="mt-1 text-xl font-bold text-amber-700">{agg.yellow}</div>
          <div className="text-[10px] text-amber-700/70">注意</div>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3">
          <div className="text-[10px] font-semibold text-rose-700">🔴 Red</div>
          <div className="mt-1 text-xl font-bold text-rose-700">{agg.red}</div>
          <div className="text-[10px] text-rose-700/70">要対応</div>
        </div>
      </div>

      <div className="mt-4 text-[11px] text-ink-500 leading-relaxed">
        Health Score = 出席率 + NPS + 最終接点日数 + 期日超過タスク + メール感情 から合成。
        単発型(AIKEN)は対象外（別指標で管理）。
      </div>
    </div>
  );
}
