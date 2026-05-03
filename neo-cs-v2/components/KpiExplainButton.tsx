"use client";

// KPIカードに付与する「計算根拠」ボタン
// クリックするとモーダルで計算式・内訳・寄与契約一覧を表示する。
//
// reviews/06_財務経理.md 「監査証跡なし」指摘への部分対応:
//   - 計算式 (formula) を可視化
//   - 寄与した contract id 群を一覧表示 (drill-down)

import { useEffect, useRef, useState } from "react";

export type KpiBreakdownEntry = {
  label: string;
  value: string;
  highlight?: boolean;
};

export function KpiExplainButton({
  title,
  formula,
  entries,
  contributingIds,
  asOf
}: {
  title: string;
  formula: string;
  entries: KpiBreakdownEntry[];
  contributingIds?: string[];
  asOf?: string;
}) {
  const [open, setOpen] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    closeBtnRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={`${title} の計算根拠を表示`}
        onClick={() => setOpen(true)}
        className="text-caption text-neutral-500 hover:text-neutral-700 focus-ring rounded-sm leading-none"
      >
        ⓘ 根拠
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="kpi-explain-title"
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          <button
            type="button"
            aria-label="閉じる"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm cursor-default"
          />
          <div className="relative bg-surface rounded-xl shadow-cardHover border border-neutral-100 w-[min(560px,92vw)] max-h-[80vh] overflow-auto">
            <div className="px-5 py-4 border-b border-neutral-100 flex items-baseline justify-between gap-3">
              <h2 id="kpi-explain-title" className="text-h4 font-semibold text-neutral-900">
                {title}
              </h2>
              {asOf && <span className="text-caption text-neutral-500">as of {asOf}</span>}
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <div className="text-caption text-neutral-500 mb-1">計算式</div>
                <code className="block text-body bg-neutral-50 border border-neutral-100 rounded-md px-3 py-2 text-neutral-900 whitespace-pre-wrap break-all">
                  {formula}
                </code>
              </div>
              <div>
                <div className="text-caption text-neutral-500 mb-1">内訳</div>
                <ul className="space-y-1">
                  {entries.map((e, i) => (
                    <li
                      key={i}
                      className={`flex items-baseline justify-between gap-3 text-body ${e.highlight ? "font-semibold text-neutral-900" : "text-neutral-700"}`}
                    >
                      <span>{e.label}</span>
                      <span className="tabular-nums">{e.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {contributingIds && contributingIds.length > 0 && (
                <div>
                  <div className="text-caption text-neutral-500 mb-1">
                    寄与レコード ({contributingIds.length} 件)
                  </div>
                  <div className="text-caption text-neutral-700 max-h-32 overflow-auto bg-neutral-50 border border-neutral-100 rounded-md px-3 py-2 break-all">
                    {contributingIds.join(", ")}
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-neutral-100 flex justify-end">
              <button
                ref={closeBtnRef}
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-pill bg-neutral-900 text-surface text-body hover:bg-neutral-700 focus-ring"
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
