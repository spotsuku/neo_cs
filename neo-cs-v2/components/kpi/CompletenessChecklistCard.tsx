"use client";

// 未入力チェックリストカード
// /companies/[id] の上部に配置し、企業データの完成度と未入力項目を可視化する。
// 計算は純関数 lib/domain/completeness.ts に委譲。

import { useState } from "react";
import Link from "next/link";
import {
  CHECKLIST_CATEGORY_LABEL,
  completenessLevel,
  type ChecklistCategory,
  type CompletenessResult
} from "@/lib/domain/completeness/completeness";

const LEVEL_COLOR: Record<ReturnType<typeof completenessLevel>, { fg: string; bg: string; ring: string }> = {
  high: { fg: "#10B981", bg: "#10B98114", ring: "#10B98133" },
  medium: { fg: "#F59E0B", bg: "#F59E0B14", ring: "#F59E0B33" },
  low: { fg: "#EF4444", bg: "#EF444414", ring: "#EF444433" }
};

const CATEGORY_ORDER: ChecklistCategory[] = [
  "basic",
  "contract",
  "assign",
  "onboard",
  "drive"
];

export function CompletenessChecklistCard({
  result,
  defaultOpen = true,
  compact = false
}: {
  result: CompletenessResult;
  /** カードを開いた状態で初期化するか (false なら折りたたみ) */
  defaultOpen?: boolean;
  /** サイドバー向けの幅狭レイアウト (1カラム / 余白縮小) */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const level = completenessLevel(result.score);
  const palette = LEVEL_COLOR[level];

  const missingTotal = result.totalCount - result.filledCount;

  return (
    <section
      className={compact ? "rounded-2xl border bg-white p-3" : "liquid-surface p-5"}
      style={{ borderColor: palette.ring }}
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={[
              "relative rounded-full flex items-center justify-center font-bold",
              compact ? "w-9 h-9 text-xs" : "w-12 h-12 text-sm"
            ].join(" ")}
            style={{
              background: palette.bg,
              color: palette.fg,
              boxShadow: `inset 0 0 0 2px ${palette.ring}`
            }}
            aria-label={`完成度 ${result.score}%`}
          >
            {result.score}
          </div>
          <div className="min-w-0">
            <div className={compact ? "text-[11px] font-semibold text-ink-700" : "text-sm font-semibold text-ink-700"}>
              未入力チェック
            </div>
            <div className={compact ? "mt-0.5 text-[10px] text-ink-500" : "mt-0.5 text-xs text-ink-500"}>
              {result.filledCount}/{result.totalCount} 入力済
              {missingTotal > 0 && (
                <span className="ml-1.5" style={{ color: palette.fg }}>
                  残 {missingTotal}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-ink-500 hover:text-ink-700"
        >
          {open ? "閉じる" : "詳細を見る"}
        </button>
      </header>

      {/* プログレスバー */}
      <div className="mt-3 h-1.5 w-full rounded-full bg-ink-50 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${result.score}%`, background: palette.fg }}
        />
      </div>

      {open && (
        <div className={compact ? "mt-3 space-y-2" : "mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"}>
          {CATEGORY_ORDER.map((cat) => {
            const missing = result.missingByCategory[cat];
            const total = result.items.filter((i) => i.category === cat).length;
            const done = total - missing.length;
            const allDone = missing.length === 0;
            return (
              <div
                key={cat}
                className="rounded-xl border border-ink-100 bg-white p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-ink-700">
                    {CHECKLIST_CATEGORY_LABEL[cat]}
                  </div>
                  <div className="text-[10px] text-ink-500">
                    {done}/{total}
                  </div>
                </div>
                {allDone ? (
                  <div className="mt-2 text-[11px] text-emerald-600">
                    すべて入力済み
                  </div>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {missing.map((it) => (
                      <li key={it.key} className="flex items-start gap-1.5">
                        <span
                          className="mt-1 inline-block w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: palette.fg }}
                          aria-hidden
                        />
                        <Link
                          href={it.editHref}
                          className="text-[12px] text-ink-700 hover:text-ink-900 hover:underline"
                          title={it.hint}
                        >
                          {it.label}
                          {it.scoreOptional && (
                            <span className="ml-1 text-[10px] text-ink-500">(任意)</span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// 一覧 (/companies) 用の小バッジ
export function CompletenessBadge({ score }: { score: number }) {
  const level = completenessLevel(score);
  const palette = LEVEL_COLOR[level];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
      style={{
        color: palette.fg,
        background: palette.bg,
        border: `1px solid ${palette.ring}`
      }}
      title={`完成度 ${score}%`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: palette.fg }}
      />
      {score}%
    </span>
  );
}
