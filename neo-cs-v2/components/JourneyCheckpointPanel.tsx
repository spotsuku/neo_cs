"use client";

// ジャーニーステージのチェックポイント表示・操作コンポーネント
//
// 現在ステージに紐付く 2〜3 個のチェック項目を縦リストで表示。
// チェック切り替えで toggleJourneyCheckpointAction を呼び出して進捗保存。

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  JourneyStageDefinition,
  JourneyCheckpointStatus,
  JourneyType
} from "@/lib/repository/types";
import { toggleJourneyCheckpointAction } from "@/app/companies/[id]/journey-actions";

export function JourneyCheckpointPanel({
  journeyType,
  subjectId,
  companyId,
  stage,
  statuses
}: {
  journeyType: JourneyType;
  subjectId: string;
  companyId: string;
  stage: JourneyStageDefinition | null;
  statuses: JourneyCheckpointStatus[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // 楽観的更新用ローカル状態
  const [localDone, setLocalDone] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const s of statuses) {
      if (stage && s.stageKey === stage.stageKey) {
        map[s.checkpointKey] = s.done;
      }
    }
    return map;
  });

  if (!stage || !stage.checkpoints || stage.checkpoints.length === 0) {
    return null;
  }

  const totalCount = stage.checkpoints.length;
  const doneCount = stage.checkpoints.filter((cp) => localDone[cp.key]).length;

  const toggle = (checkpointKey: string, done: boolean) => {
    setError(null);
    setLocalDone((prev) => ({ ...prev, [checkpointKey]: done }));
    startTransition(async () => {
      const r = await toggleJourneyCheckpointAction({
        journeyType,
        subjectId,
        companyId,
        stageKey: stage.stageKey,
        checkpointKey,
        done
      });
      if (!r.ok) {
        setError(r.message);
        // ロールバック
        setLocalDone((prev) => ({ ...prev, [checkpointKey]: !done }));
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="rounded-lg border border-ink-100 bg-white p-3 space-y-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold text-ink-700">
          ステージ完了チェック
        </span>
        <span className="text-[11px] text-ink-500 tabular-nums">
          {doneCount} / {totalCount}
        </span>
      </div>

      <div className="h-1 rounded-full bg-ink-100 overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{
            width: totalCount > 0 ? `${(doneCount / totalCount) * 100}%` : "0%"
          }}
        />
      </div>

      <ul className="space-y-1.5">
        {stage.checkpoints.map((cp) => {
          const done = localDone[cp.key] ?? false;
          return (
            <li key={cp.key}>
              <label className="flex items-start gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={done}
                  disabled={pending}
                  onChange={(e) => toggle(cp.key, e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-ink-300 text-emerald-600 focus:ring-emerald-300"
                />
                <span
                  className={[
                    "text-[12px] leading-snug",
                    done
                      ? "text-ink-400 line-through"
                      : "text-ink-800 group-hover:text-ink-900"
                  ].join(" ")}
                >
                  {cp.label}
                  {cp.description && (
                    <span className="block text-[10px] text-ink-400 mt-0.5">
                      {cp.description}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {error && (
        <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded px-2 py-1">
          {error}
        </div>
      )}
    </div>
  );
}
