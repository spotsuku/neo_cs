"use client";

// 更新マイルストン一覧 + 完了/スキップ/着手中ボタン (G項)
//
// reviews/02_CS責任者.md 指摘の「形骸化していた自動done」を撲滅:
//   - 完了マークには証跡 (note または attachmentUrl) が必須
//   - スキップには理由が必須
//   - overdue は派生表示 (status を変更しない)

import { useEffect, useState } from "react";
import { renewalMilestoneRepo, userRepo } from "@/lib/repository";
import type { AppUser, RenewalMilestone } from "@/lib/repository";
import { renewalMilestoneSpec } from "@/lib/mock/cycles";
import {
  STATUS_LABEL,
  displayState,
  isOverdue,
  progressRate,
  type DerivedDisplayState
} from "@/lib/domain/renewal";

const TODAY = "2026-04-24";

const STATE_BADGE: Record<DerivedDisplayState, string> = {
  pending: "bg-neutral-100 text-neutral-700 border-neutral-300",
  in_progress: "bg-info-50 text-info-700 border-info-100",
  overdue: "bg-danger-50 text-danger-700 border-danger-100",
  done: "bg-success-50 text-success-700 border-success-100",
  skipped: "bg-neutral-50 text-neutral-500 border-neutral-100"
};

const STATE_LABEL: Record<DerivedDisplayState, string> = {
  pending: "未着手",
  in_progress: "対応中",
  overdue: "期日超過",
  done: "完了",
  skipped: "スキップ"
};

type DialogTarget =
  | { kind: "done"; milestone: RenewalMilestone }
  | { kind: "skip"; milestone: RenewalMilestone };

export function RenewalMilestoneList({ contractId }: { contractId: string }) {
  const [milestones, setMilestones] = useState<RenewalMilestone[]>([]);
  const [me, setMe] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);
  const [dialog, setDialog] = useState<DialogTarget | null>(null);
  const [note, setNote] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [skipReason, setSkipReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    renewalMilestoneRepo.listByContract(contractId).then(setMilestones);
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      renewalMilestoneRepo.listByContract(contractId),
      userRepo.getCurrent()
    ]).then(([list, u]) => {
      if (cancelled) return;
      setMilestones(list);
      setMe(u);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [contractId]);

  if (!ready) return <div className="text-caption text-neutral-500">読み込み中...</div>;
  if (milestones.length === 0) {
    return (
      <div className="text-caption text-neutral-500">
        この契約には更新マイルストンがありません (期末日が未設定)
      </div>
    );
  }

  const progress = progressRate(milestones);

  function openDoneDialog(m: RenewalMilestone) {
    setDialog({ kind: "done", milestone: m });
    setNote("");
    setAttachmentUrl("");
    setError(null);
  }
  function openSkipDialog(m: RenewalMilestone) {
    setDialog({ kind: "skip", milestone: m });
    setSkipReason("");
    setError(null);
  }
  async function confirmDone() {
    if (!dialog || dialog.kind !== "done") return;
    if (!note.trim() && !attachmentUrl.trim()) {
      setError("note または attachmentUrl のいずれかが必須です");
      return;
    }
    if (!me) {
      setError("ログインユーザが取得できません");
      return;
    }
    try {
      await renewalMilestoneRepo.markDone(dialog.milestone.id, {
        completedBy: me.id,
        evidence: {
          note: note.trim() || undefined,
          attachmentUrl: attachmentUrl.trim() || undefined
        }
      });
      setDialog(null);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  async function confirmSkip() {
    if (!dialog || dialog.kind !== "skip") return;
    if (!skipReason.trim()) {
      setError("スキップ理由は必須です");
      return;
    }
    try {
      await renewalMilestoneRepo.markSkipped(dialog.milestone.id, {
        reason: skipReason.trim(),
        skippedBy: me?.id
      });
      setDialog(null);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  async function startInProgress(m: RenewalMilestone) {
    try {
      await renewalMilestoneRepo.markInProgress(m.id);
      reload();
    } catch (e) {
      // noop in UI; will not block
      console.error(e);
    }
  }

  return (
    <div className="space-y-3">
      {/* 進捗バー */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-caption text-neutral-500">進捗</span>
        <span className="text-caption text-neutral-700 tabular-nums">
          {Math.round(progress * 100)}%
          <span className="text-neutral-400 ml-1">
            ({milestones.filter((m) => m.status === "done" || m.status === "skipped").length} /{" "}
            {milestones.length})
          </span>
        </span>
      </div>
      <div className="h-1.5 rounded-pill bg-neutral-100 overflow-hidden">
        <div
          className="h-full bg-success-500"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <ul className="space-y-2">
        {milestones.map((m) => {
          const spec = renewalMilestoneSpec.find((s) => s.type === m.type);
          const dState = displayState(m, TODAY);
          const overdue = isOverdue(m, TODAY);
          return (
            <li
              key={m.id}
              className="rounded-md border border-neutral-100 bg-surface p-3 space-y-1.5"
            >
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <div className="flex items-baseline gap-2">
                  <span className="text-caption text-neutral-500 font-medium tabular-nums w-12">
                    {m.type}
                  </span>
                  <span className="text-body font-medium text-neutral-900">
                    {spec?.label ?? m.type}
                  </span>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-pill border text-caption ${STATE_BADGE[dState]}`}
                  >
                    {STATE_LABEL[dState]}
                  </span>
                </div>
                <span className="text-caption text-neutral-500 tabular-nums">
                  期日 {m.dueDate}
                  {overdue && <span className="ml-2 text-danger-700">⚠ 超過</span>}
                </span>
              </div>

              {spec?.description && (
                <p className="text-caption text-neutral-500">{spec.description}</p>
              )}

              {/* 完了 / スキップの証跡表示 */}
              {m.status === "done" && (
                <div className="text-caption text-success-700 bg-success-50 border border-success-100 rounded-sm px-2 py-1">
                  ✓ 完了 {m.completedAt?.slice(0, 10)}
                  {m.completedBy && <span className="ml-2">担当: {m.completedBy}</span>}
                  {m.evidence?.note && (
                    <div className="mt-0.5 text-neutral-700">📝 {m.evidence.note}</div>
                  )}
                  {m.evidence?.attachmentUrl && (
                    <div className="mt-0.5">
                      📎{" "}
                      <a
                        href={m.evidence.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline focus-ring rounded-sm"
                      >
                        添付資料
                      </a>
                    </div>
                  )}
                </div>
              )}
              {m.status === "skipped" && (
                <div className="text-caption text-neutral-700 bg-neutral-50 border border-neutral-100 rounded-sm px-2 py-1">
                  ⊘ スキップ {m.completedAt?.slice(0, 10)}
                  {m.skippedReason && (
                    <div className="mt-0.5">理由: {m.skippedReason}</div>
                  )}
                </div>
              )}

              {/* アクションボタン (pending / in_progress のみ) */}
              {(m.status === "pending" || m.status === "in_progress") && (
                <div className="flex items-center gap-2 pt-1">
                  {m.status === "pending" && (
                    <button
                      type="button"
                      onClick={() => startInProgress(m)}
                      className="px-3 py-1 rounded-pill bg-surface border border-neutral-300 text-caption text-neutral-700 hover:bg-neutral-50 focus-ring"
                    >
                      🛠 着手
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openDoneDialog(m)}
                    className="px-3 py-1 rounded-pill bg-success-500 text-surface text-caption hover:bg-success-600 focus-ring"
                  >
                    ✓ 完了マーク
                  </button>
                  <button
                    type="button"
                    onClick={() => openSkipDialog(m)}
                    className="px-3 py-1 rounded-pill bg-surface border border-neutral-300 text-caption text-neutral-700 hover:bg-neutral-50 focus-ring"
                  >
                    ⊘ スキップ
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* 完了ダイアログ */}
      {dialog?.kind === "done" && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          <button
            type="button"
            aria-label="閉じる"
            onClick={() => setDialog(null)}
            className="absolute inset-0 bg-neutral-900/40 cursor-default"
          />
          <div className="relative bg-surface rounded-xl shadow-cardHover border border-neutral-100 w-[min(520px,92vw)] p-5 space-y-3">
            <h3 className="text-h4 font-semibold text-neutral-900">
              {dialog.milestone.type} を完了マーク
            </h3>
            <p className="text-caption text-neutral-500">
              証跡 (note または attachmentUrl) のいずれかが必須です
            </p>
            <label className="block">
              <span className="text-caption text-neutral-500 font-medium">完了メモ</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例: 田中部長と更新意向ヒアリング実施。Yellow判定、価格交渉あり"
                className="mt-1 w-full px-3 py-2 rounded-md border border-borderc text-body bg-surface focus-ring min-h-[80px]"
              />
            </label>
            <label className="block">
              <span className="text-caption text-neutral-500 font-medium">添付資料URL (任意)</span>
              <input
                type="url"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                placeholder="https://drive.example/..."
                className="mt-1 w-full px-3 py-2 rounded-md border border-borderc text-body bg-surface focus-ring"
              />
            </label>
            {error && (
              <p className="text-caption text-danger-700">{error}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDialog(null)}
                className="px-4 py-2 rounded-pill bg-surface border border-neutral-300 text-body text-neutral-700 hover:bg-neutral-50 focus-ring"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={confirmDone}
                className="px-4 py-2 rounded-pill bg-success-600 text-surface text-body hover:bg-success-700 focus-ring"
              >
                完了として記録
              </button>
            </div>
          </div>
        </div>
      )}

      {/* スキップダイアログ */}
      {dialog?.kind === "skip" && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          <button
            type="button"
            aria-label="閉じる"
            onClick={() => setDialog(null)}
            className="absolute inset-0 bg-neutral-900/40 cursor-default"
          />
          <div className="relative bg-surface rounded-xl shadow-cardHover border border-neutral-100 w-[min(520px,92vw)] p-5 space-y-3">
            <h3 className="text-h4 font-semibold text-neutral-900">
              {dialog.milestone.type} をスキップ
            </h3>
            <p className="text-caption text-neutral-500">理由は必須です</p>
            <label className="block">
              <span className="text-caption text-neutral-500 font-medium">スキップ理由</span>
              <textarea
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                placeholder="例: T-120レビューを省略 — 顧客側の都合で代替面談を実施済"
                className="mt-1 w-full px-3 py-2 rounded-md border border-borderc text-body bg-surface focus-ring min-h-[80px]"
              />
            </label>
            {error && <p className="text-caption text-danger-700">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDialog(null)}
                className="px-4 py-2 rounded-pill bg-surface border border-neutral-300 text-body text-neutral-700 hover:bg-neutral-50 focus-ring"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={confirmSkip}
                className="px-4 py-2 rounded-pill bg-neutral-900 text-surface text-body hover:bg-neutral-700 focus-ring"
              >
                スキップ記録
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 旧表示コードと互換のため STATUS_LABEL を re-export (使うかは今後判断)
export { STATUS_LABEL };
