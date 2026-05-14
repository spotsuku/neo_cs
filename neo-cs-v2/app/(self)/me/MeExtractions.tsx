"use client";

import { useState } from "react";
import Link from "next/link";
import type { AiExtractionType } from "@/lib/repository/types";

// 新 enum (repo) 5 種
const TYPE_LABEL: Record<AiExtractionType, string> = {
  progress_signal: "進捗シグナル",
  risk_signal: "リスク",
  churn_signal: "解約シグナル",
  expansion_signal: "拡張シグナル",
  meeting_request: "ミーティング"
};
const TYPE_COLOR: Record<AiExtractionType, string> = {
  progress_signal: "#10B981",
  risk_signal: "#EF4444",
  churn_signal: "#F59E0B",
  expansion_signal: "#3D9EFF",
  meeting_request: "#8B5CF6"
};

// adapter 後の AI 抽出 shape (page.tsx で組み立てる)
export type AdaptedMeExtraction = {
  id: string;
  threadId: string;
  type: AiExtractionType;
  suggestion: string;
  confidence: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

export type MeExtractionItem = {
  extraction: AdaptedMeExtraction;
  threadSubject?: string;
  threadId?: string;
  companyId?: string;
  companyName?: string;
};

export function MeExtractions({ items }: { items: MeExtractionItem[] }) {
  const [state, setState] = useState(
    () => new Map(items.map((i) => [i.extraction.id, i.extraction.status]))
  );

  const handle = (id: string, status: "approved" | "rejected") => {
    setState((prev) => {
      const next = new Map(prev);
      next.set(id, status);
      return next;
    });
  };

  const pending = items.filter((i) => state.get(i.extraction.id) === "pending");
  const counts: Record<AiExtractionType, number> = {
    progress_signal: 0,
    risk_signal: 0,
    churn_signal: 0,
    expansion_signal: 0,
    meeting_request: 0
  };
  pending.forEach((p) => counts[p.extraction.type]++);
  const highCount = pending.filter((p) => p.extraction.confidence >= 0.9).length;

  const bulkApproveHigh = () => {
    setState((prev) => {
      const next = new Map(prev);
      pending.forEach((p) => {
        if (p.extraction.confidence >= 0.9) next.set(p.extraction.id, "approved");
      });
      return next;
    });
  };

  return (
    <section className="liquid-surface p-4">
      <div className="flex items-center gap-3 flex-wrap mb-2">
        <span className="text-base">🤖</span>
        <h2 className="text-sm font-semibold text-ink-700">
          AI抽出 承認待ち
        </h2>
        <span className="text-sm font-bold text-ink-900">{pending.length} 件</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(Object.keys(counts) as AiExtractionType[]).map((t) =>
            counts[t] > 0 ? (
              <span
                key={t}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{
                  color: TYPE_COLOR[t],
                  background: `${TYPE_COLOR[t]}14`
                }}
              >
                {TYPE_LABEL[t]} {counts[t]}
              </span>
            ) : null
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={bulkApproveHigh}
            disabled={highCount === 0}
            className="px-3 py-1 rounded-full bg-emerald-500 text-white text-[11px] hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            確信度0.9以上を一括承認 ({highCount})
          </button>
          <Link
            href="/inbox/extractions"
            className="text-[11px] text-ink-700 hover:underline"
          >
            承認画面 →
          </Link>
        </div>
      </div>

      {pending.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-100 p-4 text-center text-xs text-ink-500">
          承認待ちはありません 🎉
        </div>
      ) : (
        <ul className="divide-y divide-ink-50 max-h-[260px] overflow-y-auto">
          {pending.map((it) => {
            const ex = it.extraction;
            return (
              <li
                key={ex.id}
                className="flex items-center gap-2 py-2 flex-wrap"
              >
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0"
                  style={{
                    color: TYPE_COLOR[ex.type],
                    background: `${TYPE_COLOR[ex.type]}14`
                  }}
                >
                  {TYPE_LABEL[ex.type]}
                </span>
                {it.companyId && it.companyName && (
                  <Link
                    href={`/companies/${it.companyId}`}
                    className="text-[12px] font-medium text-ink-900 hover:underline shrink-0 truncate max-w-[140px]"
                  >
                    {it.companyName}
                  </Link>
                )}
                <span className="text-[12px] text-ink-700 truncate flex-1 min-w-[160px]">
                  {ex.suggestion}
                </span>
                <span
                  className={[
                    "text-[10px] shrink-0",
                    ex.confidence >= 0.9
                      ? "text-emerald-600"
                      : ex.confidence >= 0.75
                      ? "text-ink-700"
                      : "text-amber-600"
                  ].join(" ")}
                >
                  {Math.round(ex.confidence * 100)}%
                </span>
                <button
                  onClick={() => handle(ex.id, "approved")}
                  className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[11px] hover:opacity-90 shrink-0"
                >
                  承認
                </button>
                <button
                  onClick={() => handle(ex.id, "rejected")}
                  className="px-2.5 py-1 rounded-full bg-white border border-ink-100 text-[11px] text-ink-700 hover:bg-ink-50 shrink-0"
                >
                  却下
                </button>
                {it.threadId && (
                  <Link
                    href={`/inbox?threadId=${it.threadId}`}
                    className="text-[10px] text-ink-500 hover:text-ink-700 shrink-0"
                  >
                    元メール →
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
