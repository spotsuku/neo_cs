"use client";

// ジャーニー表示の共通コンポーネント
//
// レイアウト:
//   ┌─────────────────────────────────────┬──────────────────┐
//   │ 横並びステッパー (1)─(2)─●─(4)─...   │ 現在のステージ   │
//   │ 全体進捗バー / 滞在期間              │ 説明 + 支援      │
//   └─────────────────────────────────────┴──────────────────┘
//
//   各ステップ円をクリック → 詳細モーダル表示
//     - 説明・支援アクション
//     - 「このステージに移動」ボタン (後退時は警告)

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { JourneyStageDefinition } from "@/lib/repository/types";
import type { JourneySuggestion } from "@/lib/domain/journey/journey";

export type JourneyStageBarProps = {
  title: string;
  subtitle?: string;
  customizeHref: string;
  stages: JourneyStageDefinition[];
  currentStageKey: string | null;
  stageEnteredAt?: string;
  suggestion?: JourneySuggestion;
  onChangeStage: (input: {
    toStageKey: string;
    acknowledgeRegression: boolean;
    note?: string;
  }) => Promise<{ ok: boolean; code?: string; message?: string }>;
  warnOnRegression?: boolean;
};

export function JourneyStageBar(props: JourneyStageBarProps) {
  const {
    title,
    subtitle,
    customizeHref,
    stages: rawStages,
    currentStageKey,
    stageEnteredAt,
    suggestion,
    onChangeStage,
    warnOnRegression = false
  } = props;

  // 防御的 dedup: 上流が同じ stageKey を二重に返した場合に二重描画されないように、
  // 最初に出現したものだけ残し、displayOrder で並び替える。
  // (mock の seed 重複や HMR 起因のデータ重複でステッパー円が二重表示される
  // 不具合の対策。根因が解消されれば常時 no-op として機能する。)
  const stages = useMemo(() => {
    const seen = new Set<string>();
    const dedup: JourneyStageDefinition[] = [];
    for (const s of rawStages) {
      if (seen.has(s.stageKey)) continue;
      seen.add(s.stageKey);
      dedup.push(s);
    }
    return dedup.sort((a, b) => a.displayOrder - b.displayOrder);
  }, [rawStages]);

  const currentDef = useMemo(
    () => stages.find((s) => s.stageKey === currentStageKey) ?? null,
    [stages, currentStageKey]
  );

  const suggestionDef =
    suggestion?.suggestedStageKey
      ? stages.find((s) => s.stageKey === suggestion.suggestedStageKey)
      : undefined;

  const isNested = title === "";

  return (
    <div className={isNested ? "" : "liquid-surface p-5"}>
      {/* ヘッダ */}
      <div className="flex items-start justify-between mb-3 gap-3">
        <div>
          {!isNested && (
            <div className="text-sm font-semibold text-ink-700">{title}</div>
          )}
          {subtitle && (
            <div className="mt-0.5 text-[11px] text-ink-500">{subtitle}</div>
          )}
        </div>
        <a
          href={customizeHref}
          className="text-[11px] text-ink-500 hover:text-ink-700 underline-offset-2 hover:underline"
        >
          ステージをカスタム
        </a>
      </div>

      {/* おすすめバナー */}
      {suggestionDef && suggestionDef.stageKey !== currentStageKey && (
        <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50/60 p-2.5 flex items-start gap-2">
          <span className="text-[11px] font-semibold text-blue-900">
            おすすめ:
          </span>
          <span className="text-[11px] text-blue-900">
            {suggestionDef.name}
          </span>
          {suggestion && suggestion.reasons.length > 0 && (
            <span className="text-[10px] text-blue-900/70">
              ({suggestion.reasons.slice(0, 2).join(" / ")})
            </span>
          )}
          <span className="ml-auto text-[10px] text-blue-700/70">
            ↓ 該当ステップをクリック
          </span>
        </div>
      )}

      {/* 2カラム: 左=ステッパー+進捗メタ / 右=現在のみ。
          minmax(0,...) で右カラムが親幅を超えないように制約 (狭い親で右側が見切れる対策) */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)] gap-4 items-stretch">
        <div className="flex flex-col justify-between min-h-0 min-w-0">
          <Stepper
            stages={stages}
            currentDef={currentDef}
            warnOnRegression={warnOnRegression}
            onChangeStage={onChangeStage}
          />
          <ProgressMeta
            stages={stages}
            currentDef={currentDef}
            stageEnteredAt={stageEnteredAt}
            suggestion={suggestion}
          />
        </div>

        <div className="min-w-0">
          {currentDef ? (
            <StageCard label="現在のステージ" stage={currentDef} tone="current" />
          ) : (
            <div className="rounded-lg border border-dashed border-ink-200 p-3 text-[12px] text-ink-500">
              ステージ未設定。下のステップ円をクリックして設定してください。
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

/* ─────────── 横並びステッパー (ホバーで詳細ポップオーバー) ─────────── */
function Stepper({
  stages,
  currentDef,
  warnOnRegression,
  onChangeStage
}: {
  stages: JourneyStageDefinition[];
  currentDef: JourneyStageDefinition | null;
  warnOnRegression: boolean;
  onChangeStage: (input: {
    toStageKey: string;
    acknowledgeRegression: boolean;
    note?: string;
  }) => Promise<{ ok: boolean; code?: string; message?: string }>;
}) {
  const currentOrder = currentDef?.displayOrder ?? 0;
  return (
    <div className="pb-1 pt-1">
      <div className="flex items-start">
        {stages.map((stage, i) => {
          const isCurrent = stage.stageKey === currentDef?.stageKey;
          const isPast = stage.displayOrder < currentOrder;
          const accent = stage.color ?? "#3D9EFF";
          const labelClass = [
            "mt-2 text-[10px] leading-tight text-center w-full max-w-[88px] truncate",
            isCurrent
              ? "font-semibold text-ink-900"
              : isPast
              ? "text-ink-700"
              : "text-ink-500"
          ].join(" ");

          return (
            <div
              key={stage.stageKey}
              className="flex items-start last:flex-none min-w-0"
              style={{ flex: i === stages.length - 1 ? "0 0 auto" : "1 1 0" }}
            >
              <StageStepWithPopover
                stage={stage}
                currentDef={currentDef}
                warnOnRegression={warnOnRegression}
                isFirst={i === 0}
                isLast={i === stages.length - 1}
                onChangeStage={onChangeStage}
                accent={accent}
                isCurrent={isCurrent}
                isPast={isPast}
                labelClass={labelClass}
              />
              {i < stages.length - 1 && (
                <div
                  className="h-0.5 mt-3.5 mx-1 flex-1 min-w-[16px]"
                  style={{
                    background:
                      stage.displayOrder < currentOrder ? accent : "#E5E7EB"
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────── 1ステップ全体 (trigger + popover) ─────────── */
// JS制御の hover state にすることで CSS group-hover の取りこぼしを回避。
// 200ms の leave delay で trigger ↔ popover の遷移中も popover を維持する。
function StageStepWithPopover({
  stage,
  currentDef,
  warnOnRegression,
  isFirst,
  isLast,
  onChangeStage,
  accent,
  isCurrent,
  isPast,
  labelClass
}: {
  stage: JourneyStageDefinition;
  currentDef: JourneyStageDefinition | null;
  warnOnRegression: boolean;
  isFirst: boolean;
  isLast: boolean;
  onChangeStage: (input: {
    toStageKey: string;
    acknowledgeRegression: boolean;
    note?: string;
  }) => Promise<{ ok: boolean; code?: string; message?: string }>;
  accent: string;
  isCurrent: boolean;
  isPast: boolean;
  labelClass: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 外側クリックで閉じる
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center min-w-0 w-full"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex flex-col items-center cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-300 rounded p-0.5 w-full min-w-0"
        title={`${stage.name} — クリックで詳細`}
      >
        <CircleNode
          order={stage.displayOrder}
          accent={accent}
          isCurrent={isCurrent}
          isPast={isPast}
          hovered={open}
        />
        <div className={labelClass} title={stage.name}>
          {stage.name.replace(/^\d+\.\s*/, "")}
        </div>
      </button>
      {open && (
        <StageHoverPopover
          stage={stage}
          currentDef={currentDef}
          warnOnRegression={warnOnRegression}
          isFirst={isFirst}
          isLast={isLast}
          onChangeStage={onChangeStage}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function CircleNode({
  order,
  accent,
  isCurrent,
  isPast,
  hovered = false
}: {
  order: number;
  accent: string;
  isCurrent: boolean;
  isPast: boolean;
  hovered?: boolean;
}) {
  const base =
    "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold transition shrink-0";
  let style: React.CSSProperties;
  if (isCurrent) {
    style = {
      background: accent,
      color: "#fff",
      boxShadow: hovered
        ? `0 0 0 6px ${accent}66`
        : `0 0 0 4px ${accent}33`
    };
  } else if (isPast) {
    style = {
      background: accent,
      color: "#fff",
      opacity: 0.85,
      boxShadow: hovered ? `0 0 0 4px ${accent}55` : undefined
    };
  } else {
    style = {
      background: "#fff",
      color: "#94A3B8",
      border: "1.5px solid #E2E8F0",
      boxShadow: hovered ? `0 0 0 4px #93C5FD` : undefined
    };
  }
  return (
    <div className={base} style={style}>
      {isPast ? "✓" : order}
    </div>
  );
}

/* ─────────── 進捗メタ (ステッパー下) ─────────── */
function ProgressMeta({
  stages,
  currentDef,
  stageEnteredAt,
  suggestion
}: {
  stages: JourneyStageDefinition[];
  currentDef: JourneyStageDefinition | null;
  stageEnteredAt?: string;
  suggestion?: JourneySuggestion;
}) {
  const currentOrder = currentDef?.displayOrder ?? 0;
  const maxOrder = stages.reduce(
    (m, s) => (s.displayOrder > m ? s.displayOrder : m),
    0
  );
  const progressPct = maxOrder > 0 ? Math.round((currentOrder / maxOrder) * 100) : 0;

  const monthsInStage =
    stageEnteredAt
      ? Math.max(
          0,
          Math.round(
            (Date.now() - new Date(stageEnteredAt).getTime()) /
              (1000 * 60 * 60 * 24 * 30)
          )
        )
      : null;

  const accent = currentDef?.color ?? "#3D9EFF";

  return (
    <div className="mt-4 pt-3 border-t border-ink-100/80 space-y-2.5">
      <div>
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[11px] text-ink-500 font-medium">全体進捗</span>
          <span className="text-[11px] text-ink-700 tabular-nums">
            {currentDef ? `${currentOrder} / ${maxOrder} ステージ` : `0 / ${maxOrder}`}
            <span className="ml-1.5 text-ink-400">({progressPct}%)</span>
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${progressPct}%`,
              background: `linear-gradient(90deg, ${accent}66, ${accent})`
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        {currentDef && monthsInStage !== null && (
          <span className="text-ink-600">
            <span className="text-ink-400">滞在期間: </span>
            <span className="font-semibold text-ink-800">
              {monthsInStage}ヶ月
            </span>
            <span className="text-ink-400 ml-1">
              ({stageEnteredAt}〜)
            </span>
          </span>
        )}
        {currentDef && (
          <span className="text-ink-600">
            <span className="text-ink-400">残りステージ: </span>
            <span className="font-semibold text-ink-800">
              {Math.max(0, maxOrder - currentOrder)}
            </span>
          </span>
        )}
      </div>

      {suggestion && suggestion.reasons.length > 0 && currentDef && suggestion.suggestedStageKey && suggestion.suggestedStageKey !== currentDef.stageKey && (
        <div className="rounded-md bg-ink-50/70 border border-ink-100 px-2 py-1.5 text-[11px] text-ink-700">
          <span className="font-semibold text-ink-800">推奨理由: </span>
          {suggestion.reasons.slice(0, 2).join(" / ")}
        </div>
      )}
    </div>
  );
}

/* ─────────── 右カラム: 現在ステージカード ─────────── */
function StageCard({
  label,
  stage,
  tone
}: {
  label: string;
  stage: JourneyStageDefinition;
  tone: "current";
}) {
  const accent = stage.color ?? "#3D9EFF";
  const containerClass =
    tone === "current" ? "border-ink-200 bg-white" : "border-ink-200 bg-white";
  return (
    <div className={`rounded-xl border p-3 ${containerClass}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full"
          style={{ background: accent }}
        />
        <span className="text-[10px] uppercase tracking-wide text-ink-500 font-semibold">
          {label}
        </span>
      </div>
      <div className="text-sm font-semibold text-ink-900 wrap-break-word">{stage.name}</div>
      <div className="mt-1 text-[12px] text-ink-700 leading-snug wrap-break-word">
        {stage.description}
      </div>
      {stage.keyActions && (
        <div className="mt-2 rounded-md bg-ink-50/70 p-2">
          <div className="text-[10px] text-ink-500 font-semibold mb-0.5">
            この時期の支援
          </div>
          <div className="text-[11px] text-ink-700 leading-snug wrap-break-word">
            {stage.keyActions}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────── ステージ詳細ホバーポップオーバー ─────────── */
// Tailwind の group-hover を使い、ステッパー内の trigger ホバー中は
// 自身もポップオーバー内に滞在中も表示される (group の外に出るまで継続)。
// "このステージに移動" は内部にボタンを置き、操作中も hover 状態が維持される。
function StageHoverPopover({
  stage,
  currentDef,
  warnOnRegression,
  isFirst,
  isLast,
  onChangeStage,
  onClose
}: {
  stage: JourneyStageDefinition;
  currentDef: JourneyStageDefinition | null;
  warnOnRegression: boolean;
  isFirst: boolean;
  isLast: boolean;
  onChangeStage: (input: {
    toStageKey: string;
    acknowledgeRegression: boolean;
    note?: string;
  }) => Promise<{ ok: boolean; code?: string; message?: string }>;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const isCurrent = currentDef?.stageKey === stage.stageKey;
  const isRegression =
    !!currentDef && stage.displayOrder < currentDef.displayOrder;

  const accent = stage.color ?? "#3D9EFF";

  const handleApply = () => {
    setError(null);
    startTransition(async () => {
      const r = await onChangeStage({
        toStageKey: stage.stageKey,
        acknowledgeRegression: isRegression,
        note: note.trim() || undefined
      });
      if (!r.ok) {
        setError(r.message ?? "更新に失敗しました");
      } else {
        setNote("");
        router.refresh();
        onClose();
      }
    });
  };

  // 横位置: 端は寄せて画面外を避ける
  const horizontal = isFirst
    ? "left-0"
    : isLast
    ? "right-0"
    : "left-1/2 -translate-x-1/2";

  return (
    <div
      className={[
        "absolute top-full z-50 w-72 pt-2",
        horizontal
      ].join(" ")}
    >
      <div className="relative rounded-xl border border-ink-200 bg-white shadow-xl">
        {/* 三角ポインタ */}
        <div
          className="absolute -top-1.5 w-3 h-3 bg-white border-t border-l border-ink-200"
          style={{
            left: isFirst ? "1.25rem" : isLast ? "auto" : "50%",
            right: isLast ? "1.25rem" : "auto",
            transform:
              !isFirst && !isLast
                ? "translateX(-50%) rotate(45deg)"
                : "rotate(45deg)"
          }}
        />

        <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold text-white"
            style={{ background: accent }}
          >
            {stage.displayOrder}
          </span>
          <span className="text-sm font-semibold text-ink-900 truncate">
            {stage.name}
          </span>
          {isCurrent && (
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-ink-50 text-ink-700 border border-ink-100">
              現在
            </span>
          )}
        </div>

        <div className="text-[12px] text-ink-700 leading-snug">
          {stage.description}
        </div>

        {stage.keyActions && (
          <div className="mt-2 rounded-md bg-ink-50/70 p-2">
            <div className="text-[10px] text-ink-500 font-semibold mb-0.5">
              この時期の支援
            </div>
            <div className="text-[11px] text-ink-700 leading-snug">
              {stage.keyActions}
            </div>
          </div>
        )}

        {!isCurrent && currentDef && (
          <div className="mt-2 text-[11px] text-ink-600">
            {currentDef.name.replace(/^\d+\.\s*/, "")}
            <span className="mx-1 text-ink-400">→</span>
            <span className="font-semibold">
              {stage.name.replace(/^\d+\.\s*/, "")}
            </span>
            <span className="ml-1.5 text-ink-400">
              ({stage.displayOrder - currentDef.displayOrder >= 0 ? "+" : ""}
              {stage.displayOrder - currentDef.displayOrder})
            </span>
          </div>
        )}

        {isRegression && (
          <div
            className={[
              "mt-2 rounded-md border p-2 text-[11px]",
              warnOnRegression
                ? "border-amber-400 bg-amber-50 text-amber-900"
                : "border-ink-200 bg-ink-50 text-ink-700"
            ].join(" ")}
          >
            {warnOnRegression
              ? "⚠ 後退の変更です。理由を記入してください"
              : "ステージを後退させます"}
          </div>
        )}

        {!isCurrent && (
          <div className="mt-2 space-y-2">
            {(isRegression || !warnOnRegression) && (
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  isRegression ? "変更理由 (必須推奨)" : "メモ (任意)"
                }
                className="w-full rounded-md border border-ink-200 px-2 py-1.5 text-[11px] focus:outline-hidden focus:ring-2 focus:ring-blue-200"
                rows={2}
              />
            )}
            {error && (
              <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded p-1.5">
                {error}
              </div>
            )}
            <button
              type="button"
              onClick={handleApply}
              disabled={
                pending ||
                (isRegression && warnOnRegression && note.trim().length === 0)
              }
              className="w-full px-2 py-1.5 text-[11px] rounded-md bg-ink-900 text-white disabled:opacity-40 hover:bg-ink-800"
            >
              {pending ? "更新中..." : "このステージに移動"}
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
