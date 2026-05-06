"use client";

// 企業 Health バッジ
//   - 集約された Health 色を 1 行で表示。クリックでモーダル展開
//   - モーダルでは契約ごとの healthScore (color / score / factors) を内訳表示
//   - 集約ルール: 1つでも red → red、次に yellow → yellow、それ以外は green
//     (lib/mock/health.ts の companyHealthColor と同じ)
//
// 設計理由:
//   一覧では「天気 (CS 主観)」と「Health (自動算出)」が重複しがちなので、
//   一覧から Health 列を外し、企業詳細でだけ天気の隣に並べて両方を提示する。

import { useEffect, useState } from "react";
import type { Contract } from "@/lib/mock/contracts";

type HealthColor = "green" | "yellow" | "red";

const COLOR_STYLE: Record<HealthColor, { bg: string; fg: string; border: string; label: string }> = {
  green: { bg: "#10B98114", fg: "#047857", border: "#10B98155", label: "Green" },
  yellow: { bg: "#F59E0B14", fg: "#B45309", border: "#F59E0B55", label: "Yellow" },
  red: { bg: "#EF444414", fg: "#B91C1C", border: "#EF444455", label: "Red" }
};

const FACTOR_LABEL: Record<string, string> = {
  attendance: "出席率",
  overdueOnboardingTasks: "オンボ遅延タスク",
  weeksSinceLastTouch: "最終接点からの週数",
  negativeSignalCount: "ネガティブシグナル数"
};

export function CompanyHealthBadge({
  color,
  contracts
}: {
  color: HealthColor;
  /** healthScore を含む企業のアクティブ契約一覧 */
  contracts: Contract[];
}) {
  const [open, setOpen] = useState(false);
  const style = COLOR_STYLE[color];

  // ESC で閉じる
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition hover:opacity-80"
        style={{ background: style.bg, color: style.fg, borderColor: style.border }}
        title="クリックで Health の内訳を表示"
        aria-label={`Health: ${style.label} (詳細を開く)`}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: COLOR_STYLE[color].fg }}
        />
        Health: {style.label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white shadow-liquid-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-ink-500">企業 Health（自動算出）</div>
                <h2 className="mt-0.5 text-lg font-semibold text-ink-900 flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: style.fg }}
                  />
                  {style.label}
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="閉じる"
                className="w-8 h-8 rounded-full hover:bg-ink-50 flex items-center justify-center text-ink-600"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-ink-500">
                契約ごとの healthScore を集約した結果です。1つでも Red があれば Red、次に Yellow が優先されます。
              </p>

              {contracts.length === 0 ? (
                <p className="text-sm text-ink-500 py-4 text-center">
                  Health 算出対象のアクティブ契約がありません
                </p>
              ) : (
                <ul className="divide-y divide-ink-100 rounded-xl border border-ink-100 overflow-hidden">
                  {contracts.map((c) => {
                    const hs = c.healthScore;
                    const hc: HealthColor = hs?.color ?? "green";
                    const cs = COLOR_STYLE[hc];
                    return (
                      <li key={c.id} className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border"
                            style={{ background: cs.bg, color: cs.fg, borderColor: cs.border }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: cs.fg }}
                            />
                            {cs.label}
                          </span>
                          <span className="text-sm font-medium text-ink-800">
                            {c.product} / {c.courseKey}
                          </span>
                          {typeof hs?.score === "number" && (
                            <span className="ml-auto text-xs text-ink-500">
                              スコア: <span className="font-semibold text-ink-800">{hs.score}</span>
                            </span>
                          )}
                        </div>
                        {hs?.factors && Object.keys(hs.factors).length > 0 && (
                          <div className="mt-2 grid grid-cols-2 gap-1.5">
                            {Object.entries(hs.factors).map(([k, v]) => (
                              <div
                                key={k}
                                className="text-[11px] text-ink-600 px-2 py-1 rounded bg-ink-50/70"
                              >
                                <span className="text-ink-500">{FACTOR_LABEL[k] ?? k}:</span>{" "}
                                <span className="font-medium text-ink-800">
                                  {typeof v === "number" && k === "attendance"
                                    ? `${Math.round(v * 100)}%`
                                    : String(v)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {hs?.computedAt && (
                          <div className="mt-1.5 text-[10px] text-ink-400">
                            算出: {hs.computedAt}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="px-5 py-3 border-t border-ink-100 bg-ink-50/40 text-[11px] text-ink-500 flex items-center justify-between">
              <span>※ 「天気」は CS 担当者の主観評価、Health は契約データからの自動算出です</span>
              <button
                onClick={() => setOpen(false)}
                className="text-ink-700 font-medium hover:underline"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
