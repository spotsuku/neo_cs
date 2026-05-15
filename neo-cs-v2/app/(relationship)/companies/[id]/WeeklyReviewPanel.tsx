"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ProductCode,
  productByCode,
  courseShortName,
  hasMultipleCourses
} from "@/lib/master";
import {
  CURRENT_WEEK_MONDAY,
  formatWeekRange,
  prevWeek,
  nextWeekDate,
  getWeekRange,
  WeeklyReview,
  WeeklyAction,
  WeeklyNextAction,
  weeksStuck
} from "@/lib/mock/weekly";
import type { ActiveContract } from "@/lib/mock/onboarding";
import { submitWeeklyReviewAction } from "@/app/(cohort)/weekly/actions";
import { useDraftPersistence } from "@/lib/hooks/useDraftPersistence";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { useActiveMembers } from "@/lib/hooks/useActiveMembers";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const FALLBACK_ASSIGNEE = "古野";

type SaveState = "idle" | "saving" | "saved" | "error";

function ProductTab({
  code,
  active,
  onClick,
  count
}: {
  code: ProductCode;
  active: boolean;
  onClick: () => void;
  count: number;
}) {
  const p = productByCode[code];
  return (
    <button
      onClick={onClick}
      className={[
        "px-3 py-1.5 rounded-full text-sm transition flex items-center gap-1.5",
        active
          ? "bg-white shadow-liquid font-medium text-ink-900"
          : "text-ink-500 hover:text-ink-700"
      ].join(" ")}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: p.accent }}
      />
      {p.shortName}
      <span className="text-[10px] text-ink-500">{count}</span>
    </button>
  );
}

export function WeeklyReviewPanel({
  companyId,
  activeContracts,
  weeklyReviews
}: {
  companyId: string;
  activeContracts: ActiveContract[];
  weeklyReviews: WeeklyReview[];
}) {
  const { name: currentUserName } = useCurrentUser();
  // この企業が契約している研修一覧
  const products = useMemo(() => {
    return Array.from(
      new Set(
        activeContracts
          .filter((c) => c.companyId === companyId)
          .map((c) => c.product)
      )
    );
  }, [companyId]);

  const [product, setProduct] = useState<ProductCode>(
    (products[0] ?? "academia") as ProductCode
  );

  // この企業×研修で紐づくコース一覧
  const courses = useMemo(
    () =>
      activeContracts
        .filter((c) => c.companyId === companyId && c.product === product)
        .map((c) => c.courseKey),
    [companyId, product]
  );

  // 対象の週次レビュー（週古い順）
  const reviews = useMemo(
    () =>
      weeklyReviews
        .filter((r) => r.companyId === companyId && r.product === product)
        .sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    [companyId, product]
  );

  // 週タブ: 過去4週 + 今週の5つを表示（存在するレビューから構築）
  // 最新のレビューが「先週」、今週は未入力スロットとして追加
  const weekSlots = useMemo(() => {
    const allStarts = new Set<string>();
    reviews.forEach((r) => allStarts.add(r.weekStart));
    // 今週を必ず含める
    allStarts.add(CURRENT_WEEK_MONDAY);
    // 過去方向に最大4週
    const sorted = Array.from(allStarts).sort();
    // 今週以降はカット
    const cut = sorted.filter((s) => s <= CURRENT_WEEK_MONDAY);
    return cut.slice(-5); // 直近5週
  }, [reviews]);

  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(
    CURRENT_WEEK_MONDAY
  );

  // 選択中週のレビュー（なければ空のドラフト）
  const selectedReview: WeeklyReview | null = useMemo(() => {
    return reviews.find((r) => r.weekStart === selectedWeekStart) ?? null;
  }, [reviews, selectedWeekStart]);

  // 前週のレビュー
  const prevReview: WeeklyReview | null = useMemo(() => {
    const prev = prevWeek(selectedWeekStart);
    return reviews.find((r) => r.weekStart === prev) ?? null;
  }, [reviews, selectedWeekStart]);

  // ドラフト状態（未入力週の編集用）
  const [draft, setDraft] = useState<{
    actions: WeeklyAction[];
    good: string;
    more: string;
    nextActions: WeeklyNextAction[];
  } | null>(null);

  const isCurrentWeek = selectedWeekStart === CURRENT_WEEK_MONDAY;
  const isEditable = isCurrentWeek && !selectedReview?.locked;

  // 今週のドラフト初期化（先週のNextを持ち越しとして含める）
  const ensureDraft = () => {
    if (draft) return draft;
    const carriedActions: WeeklyAction[] = (prevReview?.nextActions ?? []).map((n, i) => ({
      id: `carry-${i}`,
      text: n.text,
      done: false,
      fromPrevWeek: true,
      carriedFromWeek: prevReview?.weekLabel,
      assigneeName: n.assigneeName
    }));
    const d = {
      actions: carriedActions,
      good: "",
      more: "",
      nextActions: [] as WeeklyNextAction[]
    };
    setDraft(d);
    return d;
  };

  // 表示データ: ユーザのドラフト > DB の確定レビュー > 当週なら空ドラフト
  const displayData =
    draft ??
    selectedReview ??
    (isCurrentWeek
      ? {
          actions: (prevReview?.nextActions ?? []).map((n, i) => ({
            id: `carry-${i}`,
            text: n.text,
            done: false,
            fromPrevWeek: true,
            carriedFromWeek: prevReview?.weekLabel,
            assigneeName: n.assigneeName
          })),
          good: "",
          more: "",
          nextActions: []
        }
      : null);

  const p = productByCode[product];
  const selectedRange = getWeekRange(selectedWeekStart);

  // ── 保存配線 ──
  const draftKey = `weekly_review:${companyId}:${product}:${selectedWeekStart}`;
  const dirty = isEditable && draft !== null;
  const { savedAt: localSavedAt, markClean } = useDraftPersistence(
    draftKey,
    draft,
    dirty
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lockConfirmOpen, setLockConfirmOpen] = useState(false);

  async function persist(locked: boolean): Promise<void> {
    if (!isEditable) return;
    const d = draft ?? ensureDraft();
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

  if (products.length === 0) {
    return (
      <div className="liquid-surface p-8 text-center text-sm text-ink-500">
        この企業にはまだ契約がありません
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ヘッダ: 研修切替 + 週タブ。メインタブ直下 (top-[146px]) にスティッキー固定 */}
      <div className="sticky top-[146px] z-10 liquid-surface p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-ink-50 border border-ink-100">
            {products.map((code) => {
              const count = reviews.filter((r) => r.product === code).length;
              // 再計算: この研修の全レビュー件数
              const allCount = weeklyReviews.filter(
                (r) => r.companyId === companyId && r.product === code
              ).length;
              return (
                <ProductTab
                  key={code}
                  code={code}
                  active={code === product}
                  onClick={() => {
                    setProduct(code);
                    setSelectedWeekStart(CURRENT_WEEK_MONDAY);
                    setDraft(null);
                  }}
                  count={allCount}
                />
              );
            })}
          </div>

          {hasMultipleCourses(product) && courses.length > 0 && (
            <div className="text-[11px] text-ink-500">
              コース:{" "}
              {Array.from(new Set(courses))
                .map((ck) => courseShortName(product, ck))
                .join(" / ")}
            </div>
          )}
        </div>

        {/* 週タブ */}
        <div className="flex items-center gap-2 flex-wrap">
          {weekSlots.map((ws) => {
            const range = getWeekRange(ws);
            const hasReview = reviews.some((r) => r.weekStart === ws);
            const isSelected = ws === selectedWeekStart;
            const isCurrent = ws === CURRENT_WEEK_MONDAY;
            return (
              <button
                key={ws}
                onClick={() => {
                  setSelectedWeekStart(ws);
                  setDraft(null);
                }}
                className={[
                  "px-3 py-1.5 rounded-lg text-xs transition text-left",
                  isSelected
                    ? "bg-ink-900 text-white"
                    : hasReview
                    ? "bg-white border border-ink-100 text-ink-700 hover:bg-ink-50"
                    : "border border-dashed border-ink-200 text-ink-500 hover:bg-ink-50"
                ].join(" ")}
              >
                <div className="font-semibold leading-tight">
                  {range.label} {isCurrent && <span className="text-[10px] font-normal">今週</span>}
                </div>
                <div className="text-[10px] opacity-80">
                  {formatWeekRange(range.start, range.end)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 選択週の本文。今週かつ先週レビューがある場合は 2カラム (左=先週read-only / 右=今週入力) */}
      {displayData && (
        <div
          className={[
            isCurrentWeek && prevReview
              ? "grid grid-cols-1 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)] gap-4"
              : ""
          ].join(" ")}
        >
          {isCurrentWeek && prevReview && (
            <PreviousWeekReadColumn review={prevReview} accent={p.accent} />
          )}
        <div
          className="liquid-surface p-6 relative overflow-hidden"
          style={{
            borderTop: `3px solid ${p.accent}`
          }}
        >
          {/* 週ヘッダ */}
          <div className="flex items-baseline justify-between mb-5 flex-wrap gap-3">
            <div>
              <div className="text-[11px] text-ink-500">
                {productByCode[product].shortName} / 週次レビュー
              </div>
              <div className="mt-0.5 text-xl font-bold tracking-tight flex items-baseline gap-2">
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
              記入者 <span className="text-ink-700 font-medium">{selectedReview?.authorName ?? "—"}</span>
              {selectedReview?.updatedAt && (
                <span className="ml-3 text-ink-400">更新: {selectedReview.updatedAt.slice(0, 10)}</span>
              )}
            </div>
          </div>

          {/* 実施事項 */}
          <Section title="実施事項" hint="先週のNextから持ち越された項目にチェックを入れると完了扱い">
            <ActionsList
              actions={displayData.actions}
              editable={isEditable}
              currentWeekLabel={selectedRange.label}
              onToggle={(id) => {
                if (!draft) ensureDraft();
                setDraft((d) =>
                  d
                    ? {
                        ...d,
                        actions: d.actions.map((a) =>
                          a.id === id
                            ? {
                                ...a,
                                done: !a.done,
                                completedAt: !a.done ? new Date().toISOString().slice(0, 10) : undefined
                              }
                            : a
                        )
                      }
                    : d
                );
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
          <Section title={`来週(${getWeekRange(nextWeekDate(selectedWeekStart)).label})やること`} hint="担当者必須。未設定は警告表示されます">
            <NextActionsList
              actions={displayData.nextActions}
              editable={isEditable}
              onChange={(list) => {
                const cur = ensureDraft();
                setDraft({ ...cur, nextActions: list });
              }}
            />
          </Section>

          {/* 保存ボタン (今週のみ) */}
          {isEditable && (
            <div className="flex items-center justify-end gap-3 mt-6 pt-5 border-t border-ink-100 flex-wrap">
              <PanelSaveStatus state={saveState} error={saveError} localSavedAt={localSavedAt} />
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
        </div>
      )}

      {/* 前週の記録 (折りたたみ) — 今週ビュー時は左カラムに inline 表示しているため非表示 */}
      {prevReview && !isCurrentWeek && (
        <PreviousWeekSummary review={prevReview} />
      )}

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

function PanelSaveStatus({
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
      <span className="text-[11px] text-ink-500">自動下書き保存 {t}</span>
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
                    a.done ? "" : "",
                    stuck >= 2 && !a.done ? "border border-rose-200 bg-rose-50/40" : ""
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
                        <span className="text-emerald-600">✓ 完了 {a.completedAt.slice(5).replace("-", "/")}</span>
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
          <div className="text-[11px] text-ink-500 font-medium mb-2">今週追加 {added.length}件</div>
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
                      <span>{a.completedAt.slice(5).replace("-", "/")}</span>
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
            className="flex-1 text-sm rounded-full border border-ink-100 px-4 py-2 bg-white focus:outline-hidden focus:border-ink-300"
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
        <div className="text-center text-xs text-ink-500 py-4">実施事項の記録なし</div>
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
  const bg = tone === "good" ? "bg-emerald-50/40 border-emerald-100" : "bg-amber-50/40 border-amber-100";
  if (!editable) {
    return (
      <div className={`rounded-2xl border ${bg} px-4 py-3 text-sm text-ink-700 min-h-[48px] whitespace-pre-wrap`}>
        {value || <span className="text-ink-400">記録なし</span>}
      </div>
    );
  }
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={tone === "good" ? "うまくいったこと、顧客の前向きな反応、など" : "課題、ブロッカー、次に改善したいこと、など"}
      className={`w-full rounded-2xl border ${bg} px-4 py-3 text-sm text-ink-700 min-h-[80px] focus:outline-hidden focus:ring-1 focus:ring-ink-300`}
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
              hasAssignee ? "border-ink-100 bg-white" : "border-amber-200 bg-amber-50/40"
            ].join(" ")}
          >
            <span className="mt-2 w-1.5 h-1.5 rounded-full bg-ink-500 shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
              {editable ? (
                <input
                  type="text"
                  value={a.text}
                  onChange={(e) => update(a.id, { text: e.target.value })}
                  className="w-full text-sm rounded-md px-2 py-1 bg-white border border-transparent hover:border-ink-100 focus:border-ink-300 focus:outline-hidden"
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
                      onChange={(e) => update(a.id, { assigneeName: e.target.value })}
                      className="rounded-full border border-ink-100 px-2 py-0.5 bg-white"
                    >
                      {assigneeOptions.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-ink-700 font-medium">{a.assigneeName}</span>
                  )}
                  {!hasAssignee && (
                    <span className="text-amber-700 text-[10px]">⚠ 未設定</span>
                  )}
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-ink-500">期限:</span>
                  {editable ? (
                    <input
                      type="date"
                      value={a.dueDate ?? ""}
                      onChange={(e) => update(a.id, { dueDate: e.target.value || undefined })}
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
            className="flex-1 text-sm rounded-full border border-ink-100 px-4 py-2 bg-white focus:outline-hidden focus:border-ink-300"
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
        <div className="text-center text-xs text-ink-500 py-4">来週やることの記録なし</div>
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

/* 今週入力ビュー用の「先週」読み取り専用カラム。
   right column の編集カードと並べる。背景をうすくグレーアウトして read-only を明示。 */
function PreviousWeekReadColumn({
  review,
  accent
}: {
  review: WeeklyReview;
  accent: string;
}) {
  return (
    <div
      className="liquid-surface p-6 relative overflow-hidden bg-ink-50/30"
      style={{ borderTop: `3px dashed ${accent}66` }}
    >
      <div className="flex items-baseline justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="text-[11px] text-ink-500 flex items-center gap-1.5">
            <span aria-hidden>👁</span>
            <span>先週 / 読み取り専用</span>
          </div>
          <div className="mt-0.5 text-xl font-bold tracking-tight flex items-baseline gap-2 text-ink-700">
            {review.weekLabel}
            <span className="text-sm font-normal text-ink-500">
              ({formatWeekRange(review.weekStart, review.weekEnd)})
            </span>
            {review.locked && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-ink-100 text-ink-500 border border-ink-200">
                🔒 ロック済
              </span>
            )}
          </div>
        </div>
        <div className="text-[11px] text-ink-500">
          記入者{" "}
          <span className="text-ink-700 font-medium">
            {review.authorName ?? "—"}
          </span>
        </div>
      </div>

      <Section title="実施事項">
        {review.actions.length === 0 ? (
          <div className="text-center text-xs text-ink-400 py-4">
            実施事項の記録なし
          </div>
        ) : (
          <ul className="space-y-1.5">
            {review.actions.map((a) => (
              <li key={a.id} className="flex items-start gap-2 text-xs">
                <span className="mt-0.5">{a.done ? "✓" : "☐"}</span>
                <span className={a.done ? "text-ink-700" : "text-ink-500"}>
                  {a.text}{" "}
                  <span className="text-ink-400">({a.assigneeName})</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Good（うまくいったこと）">
        {review.good ? (
          <div className="text-xs text-ink-700 whitespace-pre-wrap rounded-lg bg-emerald-50/50 border border-emerald-100 p-3">
            {review.good}
          </div>
        ) : (
          <div className="text-xs text-ink-400">記載なし</div>
        )}
      </Section>

      <Section title="More（改善点・課題）">
        {review.more ? (
          <div className="text-xs text-ink-700 whitespace-pre-wrap rounded-lg bg-amber-50/50 border border-amber-100 p-3">
            {review.more}
          </div>
        ) : (
          <div className="text-xs text-ink-400">記載なし</div>
        )}
      </Section>

      <Section title="Next（来週=今週やる予定だったこと）">
        {review.nextActions.length === 0 ? (
          <div className="text-xs text-ink-400">記載なし</div>
        ) : (
          <ul className="space-y-1.5">
            {review.nextActions.map((n) => (
              <li key={n.id} className="text-xs text-ink-700">
                • {n.text}{" "}
                <span className="text-ink-500">
                  ({n.assigneeName}
                  {n.dueDate
                    ? ` · 期限${n.dueDate.slice(5).replace("-", "/")}`
                    : ""}
                  )
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function PreviousWeekSummary({ review }: { review: WeeklyReview }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full liquid-surface p-4 flex items-center justify-between hover:bg-ink-50/50"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-ink-700">
            前週の記録 ({review.weekLabel} {formatWeekRange(review.weekStart, review.weekEnd)})
          </span>
          <span className="text-[11px] text-ink-500">
            Good {review.good ? "あり" : "なし"} / More {review.more ? "あり" : "なし"} / Next {review.nextActions.length}件
          </span>
        </div>
        <span className="text-ink-500 text-sm">
          {open ? "閉じる ▲" : "開く ▼"}
        </span>
      </button>
      {open && (
        <div className="mt-3 liquid-surface p-5 space-y-4 text-sm">
          <div>
            <div className="text-[11px] text-ink-500 mb-1">実施事項 ({review.actions.length}件)</div>
            <ul className="space-y-1">
              {review.actions.map((a) => (
                <li key={a.id} className="flex items-start gap-2 text-xs">
                  <span>{a.done ? "✓" : "☐"}</span>
                  <span className={a.done ? "text-ink-700" : "text-ink-500"}>
                    {a.text} <span className="text-ink-400">({a.assigneeName})</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {review.good && (
            <div>
              <div className="text-[11px] text-emerald-700 font-medium mb-1">Good</div>
              <div className="text-xs text-ink-700 whitespace-pre-wrap">{review.good}</div>
            </div>
          )}
          {review.more && (
            <div>
              <div className="text-[11px] text-amber-700 font-medium mb-1">More</div>
              <div className="text-xs text-ink-700 whitespace-pre-wrap">{review.more}</div>
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
                      {n.dueDate ? ` · 期限${n.dueDate.slice(5).replace("-", "/")}` : ""})
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
