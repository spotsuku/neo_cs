"use client";

// 週次レビュー一覧ページ用の (企業 × 研修 × 週) 単位のエディタ
// WeeklyReviewPanel の UI を踏襲しつつ、研修・週は親で固定されている前提

import { useEffect, useMemo, useState } from "react";
import {
  ProductCode,
  productByCode,
  courseShortName,
  hasMultipleCourses
} from "@/lib/mock/data";
import {
  weeklyReviews,
  formatWeekRange,
  prevWeek,
  nextWeekDate,
  getWeekRange,
  WeeklyReview,
  WeeklyAction,
  WeeklyNextAction,
  weeksStuck,
  CURRENT_WEEK_MONDAY
} from "@/lib/mock/weekly";
import { activeContracts } from "@/lib/mock/onboarding";
import { submitWeeklyReviewAction } from "./actions";
import { useDraftPersistence } from "@/lib/hooks/useDraftPersistence";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { useActiveMembers } from "@/lib/hooks/useActiveMembers";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type SaveState = "idle" | "saving" | "saved" | "error";

const FALLBACK_ASSIGNEE = "古野";

export type WeeklyDraft = {
  actions: WeeklyAction[];
  good: string;
  more: string;
  nextActions: WeeklyNextAction[];
};

export function buildInitialDraft(prevReview: WeeklyReview | null): WeeklyDraft {
  const carriedActions: WeeklyAction[] = (prevReview?.nextActions ?? []).map(
    (n, i) => ({
      id: `carry-${i}`,
      text: n.text,
      done: false,
      fromPrevWeek: true,
      carriedFromWeek: prevReview?.weekLabel,
      assigneeName: n.assigneeName
    })
  );
  return {
    actions: carriedActions,
    good: "",
    more: "",
    nextActions: []
  };
}

export function CompanyWeeklyEditor({
  companyId,
  product,
  weekStart,
  draft,
  setDraft
}: {
  companyId: string;
  product: ProductCode;
  weekStart: string;
  draft: WeeklyDraft | null;
  setDraft: (d: WeeklyDraft) => void;
}) {
  const p = productByCode[product];
  const { name: currentUserName } = useCurrentUser();

  const courses = useMemo(
    () =>
      activeContracts
        .filter((c) => c.companyId === companyId && c.product === product)
        .map((c) => c.courseKey),
    [companyId, product]
  );

  const reviews = useMemo(
    () =>
      weeklyReviews
        .filter((r) => r.companyId === companyId && r.product === product)
        .sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    [companyId, product]
  );

  const selectedReview: WeeklyReview | null = useMemo(() => {
    return reviews.find((r) => r.weekStart === weekStart) ?? null;
  }, [reviews, weekStart]);

  const prevReview: WeeklyReview | null = useMemo(() => {
    const prev = prevWeek(weekStart);
    return reviews.find((r) => r.weekStart === prev) ?? null;
  }, [reviews, weekStart]);

  const isCurrentWeek = weekStart === CURRENT_WEEK_MONDAY;
  const isEditable = isCurrentWeek && !selectedReview?.locked;

  const ensureDraft = (): WeeklyDraft => {
    if (draft) return draft;
    const d = buildInitialDraft(prevReview);
    setDraft(d);
    return d;
  };

  const displayData: WeeklyDraft | WeeklyReview | null =
    selectedReview ??
    (isCurrentWeek ? draft ?? buildInitialDraft(prevReview) : null);

  const selectedRange = getWeekRange(weekStart);

  // ── 保存配線 (リポジトリ層 + ドラフト永続化 + 離脱警告) ──
  const draftKey = `weekly_review:${companyId}:${product}:${weekStart}`;
  const dirty = isEditable && draft !== null;
  const { savedAt: localSavedAt, markClean } = useDraftPersistence<WeeklyDraft | null>(
    draftKey,
    draft,
    dirty
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  async function persist(locked: boolean): Promise<void> {
    if (!isEditable) return;
    const d = draft ?? buildInitialDraft(prevReview);
    setSaveState("saving");
    setSaveError(null);
    const res = await submitWeeklyReviewAction({
      companyId,
      product,
      weekStart: selectedRange.start,
      actions: d.actions,
      good: d.good,
      more: d.more,
      nextActions: d.nextActions,
      authorName: currentUserName ?? FALLBACK_ASSIGNEE,
      locked
    });
    if (res.ok) {
      setSaveState("saved");
      markClean();
    } else {
      setSaveState("error");
      setSaveError(res.message);
    }
  }

  const [lockConfirmOpen, setLockConfirmOpen] = useState(false);

  if (!displayData) {
    return (
      <div className="p-6 text-center text-sm text-ink-500">
        この週の記録はありません（過去週は入力不可）
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl bg-white border border-ink-100 p-6 relative overflow-hidden"
        style={{ borderTop: `3px solid ${p.accent}` }}
      >
        {/* 週ヘッダ */}
        <div className="flex items-baseline justify-between mb-5 flex-wrap gap-3">
          <div>
            <div className="text-[11px] text-ink-500">
              {p.shortName}
              {hasMultipleCourses(product) && courses.length > 0 && (
                <>
                  {" "}
                  /{" "}
                  {Array.from(new Set(courses))
                    .map((ck) => courseShortName(product, ck))
                    .join(" / ")}
                </>
              )}{" "}
              / 週次レビュー
            </div>
            <div className="mt-0.5 text-xl font-bold tracking-tight flex items-baseline gap-2 flex-wrap">
              {selectedRange.label}
              <span className="text-sm font-normal text-ink-500">
                ({formatWeekRange(selectedRange.start, selectedRange.end)})
              </span>
              {isCurrentWeek && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                  今週
                </span>
              )}
              {selectedReview?.locked && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-ink-50 text-ink-500 border border-ink-100">
                  🔒 ロック済
                </span>
              )}
            </div>
          </div>
          <div className="text-[11px] text-ink-500">
            記入者{" "}
            <span className="text-ink-700 font-medium">
              {selectedReview?.authorName ?? "—"}
            </span>
            {selectedReview?.updatedAt && (
              <span className="ml-3 text-ink-400">
                更新: {selectedReview.updatedAt.slice(0, 10)}
              </span>
            )}
          </div>
        </div>

        {/* 実施事項 */}
        <Section
          title="実施事項"
          hint="先週のNextから持ち越された項目にチェックを入れると完了扱い"
        >
          <ActionsList
            actions={displayData.actions}
            editable={isEditable}
            currentWeekLabel={selectedRange.label}
            onToggle={(id) => {
              const cur = ensureDraft();
              setDraft({
                ...cur,
                actions: cur.actions.map((a) =>
                  a.id === id
                    ? {
                        ...a,
                        done: !a.done,
                        completedAt: !a.done
                          ? new Date().toISOString().slice(0, 10)
                          : undefined
                      }
                    : a
                )
              });
            }}
            onAddNew={(text) => {
              const cur = ensureDraft();
              setDraft({
                ...cur,
                actions: [
                  ...cur.actions,
                  {
                    id: `new-${Date.now()}`,
                    text,
                    done: true,
                    assigneeName: currentUserName ?? FALLBACK_ASSIGNEE,
                    completedAt: new Date().toISOString().slice(0, 10)
                  }
                ]
              });
            }}
          />
        </Section>

        {/* Good */}
        <Section title="Good（うまくいったこと）">
          <GoodMoreArea
            value={displayData.good}
            editable={isEditable}
            tone="good"
            onChange={(v) => {
              const cur = ensureDraft();
              setDraft({ ...cur, good: v });
            }}
          />
        </Section>

        {/* More */}
        <Section title="More（改善点・課題）">
          <GoodMoreArea
            value={displayData.more}
            editable={isEditable}
            tone="more"
            onChange={(v) => {
              const cur = ensureDraft();
              setDraft({ ...cur, more: v });
            }}
          />
        </Section>

        {/* Next Week */}
        <Section
          title={`来週(${getWeekRange(nextWeekDate(weekStart)).label})やること`}
          hint="担当者必須。未設定は警告表示されます"
        >
          <NextActionsList
            actions={displayData.nextActions}
            editable={isEditable}
            onChange={(list) => {
              const cur = ensureDraft();
              setDraft({ ...cur, nextActions: list });
            }}
          />
        </Section>

        {isEditable && (
          <div className="flex items-center justify-end gap-3 mt-6 pt-5 border-t border-ink-100 flex-wrap">
            <SaveStatus state={saveState} error={saveError} localSavedAt={localSavedAt} />
            <button
              type="button"
              onClick={() => persist(false)}
              disabled={saveState === "saving"}
              className="px-4 py-2 rounded-full text-xs text-ink-700 border border-ink-100 hover:bg-ink-50 disabled:opacity-50"
            >
              {saveState === "saving" ? "保存中..." : "下書き保存"}
            </button>
            <button
              type="button"
              onClick={() => setLockConfirmOpen(true)}
              disabled={saveState === "saving"}
              className="px-4 py-2 rounded-full text-xs text-white font-medium hover:opacity-90 disabled:opacity-50"
              style={{ background: p.accent }}
            >
              完了としてロック
            </button>
          </div>
        )}
      </div>

      {prevReview && <PreviousWeekSummary review={prevReview} />}

      <ConfirmDialog
        open={lockConfirmOpen}
        title="この週次レビューをロックしますか?"
        description="ロック後は編集できなくなります。Good / More / 来週やること がすべて埋まっていることを確認してください。"
        confirmLabel="ロックして完了"
        tone="warning"
        onCancel={() => setLockConfirmOpen(false)}
        onConfirm={async () => {
          setLockConfirmOpen(false);
          await persist(true);
        }}
      />
    </div>
  );
}

function SaveStatus({
  state,
  error,
  localSavedAt
}: {
  state: SaveState;
  error: string | null;
  localSavedAt: string | null;
}) {
  if (state === "saving") {
    return <span className="text-[11px] text-ink-500">保存中...</span>;
  }
  if (state === "saved") {
    return <span className="text-[11px] text-emerald-600">✓ 保存しました</span>;
  }
  if (state === "error") {
    return (
      <span className="text-[11px] text-rose-600">
        保存失敗: {error ?? "不明なエラー"}
      </span>
    );
  }
  if (localSavedAt) {
    const t = localSavedAt.slice(11, 16);
    return (
      <span className="text-[11px] text-ink-500">
        自動下書き保存 {t}
      </span>
    );
  }
  return null;
}

function Section({
  title,
  hint,
  children
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-sm font-semibold text-ink-900">{title}</h4>
        {hint && <span className="text-[11px] text-ink-500">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function ActionsList({
  actions,
  editable,
  currentWeekLabel,
  onToggle,
  onAddNew
}: {
  actions: WeeklyAction[];
  editable: boolean;
  currentWeekLabel: string;
  onToggle: (id: string) => void;
  onAddNew: (text: string) => void;
}) {
  const [newText, setNewText] = useState("");
  const carried = actions.filter((a) => a.fromPrevWeek);
  const added = actions.filter((a) => !a.fromPrevWeek);

  return (
    <div className="space-y-3">
      {carried.length > 0 && (
        <div className="rounded-2xl border border-ink-100 bg-ink-50/30 p-3">
          <div className="text-[11px] text-ink-500 font-medium mb-2">
            先週のNextから持ち越し {carried.length}件
          </div>
          <div className="space-y-1.5">
            {carried.map((a) => {
              const stuck = a.carriedFromWeek
                ? weeksStuck(a.carriedFromWeek, currentWeekLabel)
                : 0;
              return (
                <label
                  key={a.id}
                  className={[
                    "flex items-start gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-white/60",
                    stuck >= 2 && !a.done
                      ? "border border-rose-200 bg-rose-50/40"
                      : ""
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    checked={a.done}
                    disabled={!editable}
                    onChange={() => editable && onToggle(a.id)}
                    className="mt-0.5 w-4 h-4 rounded accent-ink-900"
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className={[
                        "text-sm",
                        a.done
                          ? "text-ink-500 line-through"
                          : "text-ink-400"
                      ].join(" ")}
                    >
                      {a.text}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-ink-500">
                      <span>担当: {a.assigneeName ?? "—"}</span>
                      {a.completedAt && (
                        <span className="text-emerald-600">
                          ✓ 完了{" "}
                          {a.completedAt.slice(5).replace("-", "/")}
                        </span>
                      )}
                      {stuck >= 2 && !a.done && (
                        <span className="text-rose-500 font-semibold">
                          ⚠ {stuck}週持ち越し
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {added.length > 0 && (
        <div>
          <div className="text-[11px] text-ink-500 font-medium mb-2">
            今週追加 {added.length}件
          </div>
          <div className="space-y-1.5">
            {added.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-white border border-ink-100"
              >
                <span className="mt-0.5 text-emerald-600 text-xs">✓</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink-900">{a.text}</div>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-ink-500">
                    <span>担当: {a.assigneeName ?? "—"}</span>
                    {a.completedAt && (
                      <span>
                        {a.completedAt.slice(5).replace("-", "/")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editable && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="実施したことを追加..."
            className="flex-1 text-sm rounded-full border border-ink-100 px-4 py-2 bg-white focus:outline-none focus:border-ink-300"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newText.trim()) {
                onAddNew(newText.trim());
                setNewText("");
              }
            }}
          />
          <button
            onClick={() => {
              if (newText.trim()) {
                onAddNew(newText.trim());
                setNewText("");
              }
            }}
            className="px-3 py-2 rounded-full text-xs text-ink-700 border border-ink-100 hover:bg-ink-50"
          >
            + 追加
          </button>
        </div>
      )}

      {actions.length === 0 && !editable && (
        <div className="text-center text-xs text-ink-500 py-4">
          実施事項の記録なし
        </div>
      )}
    </div>
  );
}

function GoodMoreArea({
  value,
  editable,
  tone,
  onChange
}: {
  value: string;
  editable: boolean;
  tone: "good" | "more";
  onChange: (v: string) => void;
}) {
  const bg =
    tone === "good"
      ? "bg-emerald-50/40 border-emerald-100"
      : "bg-amber-50/40 border-amber-100";
  if (!editable) {
    return (
      <div
        className={`rounded-2xl border ${bg} px-4 py-3 text-sm text-ink-700 min-h-[48px] whitespace-pre-wrap`}
      >
        {value || <span className="text-ink-400">記録なし</span>}
      </div>
    );
  }
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={
        tone === "good"
          ? "うまくいったこと、顧客の前向きな反応、など"
          : "課題、ブロッカー、次に改善したいこと、など"
      }
      className={`w-full rounded-2xl border ${bg} px-4 py-3 text-sm text-ink-700 min-h-[80px] focus:outline-none focus:ring-1 focus:ring-ink-300`}
    />
  );
}

function NextActionsList({
  actions,
  editable,
  onChange
}: {
  actions: WeeklyNextAction[];
  editable: boolean;
  onChange: (list: WeeklyNextAction[]) => void;
}) {
  const { names: assigneeOptions } = useActiveMembers();
  const [newText, setNewText] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [newDue, setNewDue] = useState("");
  const [removeTarget, setRemoveTarget] = useState<WeeklyNextAction | null>(null);

  useEffect(() => {
    if (!newAssignee && assigneeOptions.length > 0) {
      setNewAssignee(assigneeOptions[0]);
    }
  }, [assigneeOptions, newAssignee]);

  const update = (id: string, patch: Partial<WeeklyNextAction>) => {
    onChange(actions.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };
  const remove = (id: string) => onChange(actions.filter((a) => a.id !== id));
  const add = () => {
    if (!newText.trim()) return;
    onChange([
      ...actions,
      {
        id: `next-${Date.now()}`,
        text: newText.trim(),
        assigneeName: newAssignee,
        dueDate: newDue || undefined
      }
    ]);
    setNewText("");
    setNewDue("");
  };

  return (
    <div className="space-y-2">
      {actions.map((a) => {
        const hasAssignee = Boolean(a.assigneeName);
        return (
          <div
            key={a.id}
            className={[
              "flex items-start gap-2 px-3 py-2 rounded-xl border",
              hasAssignee
                ? "border-ink-100 bg-white"
                : "border-amber-200 bg-amber-50/40"
            ].join(" ")}
          >
            <span className="mt-2 w-1.5 h-1.5 rounded-full bg-ink-500 shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
              {editable ? (
                <input
                  type="text"
                  value={a.text}
                  onChange={(e) => update(a.id, { text: e.target.value })}
                  className="w-full text-sm rounded-md px-2 py-1 bg-white border border-transparent hover:border-ink-100 focus:border-ink-300 focus:outline-none"
                />
              ) : (
                <div className="text-sm text-ink-900 px-2">{a.text}</div>
              )}
              <div className="flex items-center gap-3 text-[11px] flex-wrap">
                <label className="flex items-center gap-1">
                  <span className="text-ink-500">担当:</span>
                  {editable ? (
                    <select
                      value={a.assigneeName}
                      onChange={(e) =>
                        update(a.id, { assigneeName: e.target.value })
                      }
                      className="rounded-full border border-ink-100 px-2 py-0.5 bg-white"
                    >
                      {assigneeOptions.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-ink-700 font-medium">
                      {a.assigneeName}
                    </span>
                  )}
                  {!hasAssignee && (
                    <span className="text-amber-700 text-[10px]">
                      ⚠ 未設定
                    </span>
                  )}
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-ink-500">期限:</span>
                  {editable ? (
                    <input
                      type="date"
                      value={a.dueDate ?? ""}
                      onChange={(e) =>
                        update(a.id, { dueDate: e.target.value || undefined })
                      }
                      className="rounded-full border border-ink-100 px-2 py-0.5 bg-white text-[11px]"
                    />
                  ) : (
                    <span className="text-ink-700">{a.dueDate ?? "—"}</span>
                  )}
                </label>
              </div>
            </div>
            {editable && (
              <button
                type="button"
                aria-label={`「${a.text || "未入力"}」を削除`}
                onClick={() => setRemoveTarget(a)}
                className="text-ink-300 hover:text-rose-500 text-sm mt-1"
              >
                ×
              </button>
            )}
          </div>
        );
      })}

      {editable && (
        <div className="flex items-stretch gap-2 mt-3">
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="来週やることを追加..."
            className="flex-1 text-sm rounded-full border border-ink-100 px-4 py-2 bg-white focus:outline-none focus:border-ink-300"
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <select
            value={newAssignee}
            onChange={(e) => setNewAssignee(e.target.value)}
            className="text-xs rounded-full border border-ink-100 px-3 py-2 bg-white"
          >
            {assigneeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={newDue}
            onChange={(e) => setNewDue(e.target.value)}
            className="text-xs rounded-full border border-ink-100 px-3 py-2 bg-white"
          />
          <button
            onClick={add}
            className="px-3 rounded-full text-xs text-ink-700 border border-ink-100 hover:bg-ink-50"
          >
            + 追加
          </button>
        </div>
      )}

      {actions.length === 0 && !editable && (
        <div className="text-center text-xs text-ink-500 py-4">
          来週やることの記録なし
        </div>
      )}

      <ConfirmDialog
        open={removeTarget !== null}
        title="この項目を削除しますか?"
        description={removeTarget?.text || "(未入力)"}
        confirmLabel="削除"
        tone="danger"
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) remove(removeTarget.id);
          setRemoveTarget(null);
        }}
      />
    </div>
  );
}

function PreviousWeekSummary({ review }: { review: WeeklyReview }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full rounded-2xl bg-white border border-ink-100 p-4 flex items-center justify-between hover:bg-ink-50/50"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-ink-700">
            前週の記録 ({review.weekLabel}{" "}
            {formatWeekRange(review.weekStart, review.weekEnd)})
          </span>
          <span className="text-[11px] text-ink-500">
            Good {review.good ? "あり" : "なし"} / More{" "}
            {review.more ? "あり" : "なし"} / Next{" "}
            {review.nextActions.length}件
          </span>
        </div>
        <span className="text-ink-500 text-sm">
          {open ? "閉じる ▲" : "開く ▼"}
        </span>
      </button>
      {open && (
        <div className="mt-3 rounded-2xl bg-white border border-ink-100 p-5 space-y-4 text-sm">
          <div>
            <div className="text-[11px] text-ink-500 mb-1">
              実施事項 ({review.actions.length}件)
            </div>
            <ul className="space-y-1">
              {review.actions.map((a) => (
                <li key={a.id} className="flex items-start gap-2 text-xs">
                  <span>{a.done ? "✓" : "☐"}</span>
                  <span
                    className={a.done ? "text-ink-700" : "text-ink-500"}
                  >
                    {a.text}{" "}
                    <span className="text-ink-400">({a.assigneeName})</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {review.good && (
            <div>
              <div className="text-[11px] text-emerald-700 font-medium mb-1">
                Good
              </div>
              <div className="text-xs text-ink-700 whitespace-pre-wrap">
                {review.good}
              </div>
            </div>
          )}
          {review.more && (
            <div>
              <div className="text-[11px] text-amber-700 font-medium mb-1">
                More
              </div>
              <div className="text-xs text-ink-700 whitespace-pre-wrap">
                {review.more}
              </div>
            </div>
          )}
          {review.nextActions.length > 0 && (
            <div>
              <div className="text-[11px] text-ink-500 mb-1">Next Actions</div>
              <ul className="space-y-1">
                {review.nextActions.map((n) => (
                  <li key={n.id} className="text-xs text-ink-700">
                    • {n.text}{" "}
                    <span className="text-ink-500">
                      ({n.assigneeName}
                      {n.dueDate
                        ? ` · 期限${n.dueDate.slice(5).replace("-", "/")}`
                        : ""})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
