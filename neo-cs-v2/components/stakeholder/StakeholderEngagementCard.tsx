"use client";

// 顧客側担当者 (stakeholder) の engagement tier カード + 上書きモーダル
//
// - tier バッジ表示 (4色)
// - 直近接点日 / 30日接点回数を併記
// - クリックで「手動上書き」ダイアログを開く (Server Action 経由で保存)
//
// Phase2-#4 (顧客側担当者エンゲージメント可視化)

import { useState, useTransition } from "react";
import {
  engagementTierBadgeClass,
  engagementTierLabel,
  engagementTierOrder,
  type EngagementTier
} from "@/lib/domain/engagement";
import { setStakeholderEngagementTier } from "@/app/(relationship)/companies/[id]/engagement-actions";

export type StakeholderEngagementMetrics = {
  tier: EngagementTier;
  suggestedTier: EngagementTier;
  score: number;
  lastTouchAt: string | null;
  touchCount30d: number;
  touchCount90d: number;
};

export function EngagementBadge({ tier }: { tier: EngagementTier }) {
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-pill text-caption font-medium ${engagementTierBadgeClass[tier]}`}
    >
      {engagementTierLabel[tier]}
    </span>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

export function StakeholderEngagementBlock({
  stakeholderId,
  stakeholderName,
  companyId,
  metrics,
  currentNote
}: {
  stakeholderId: string;
  stakeholderName: string;
  companyId: string;
  metrics: StakeholderEngagementMetrics;
  currentNote?: string;
}) {
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<EngagementTier | "auto">(
    metrics.suggestedTier === metrics.tier && metrics.suggestedTier !== metrics.tier
      ? "auto"
      : metrics.tier
  );
  const [note, setNote] = useState(currentNote ?? "");
  const [pending, startTransition] = useTransition();
  const overridden = metrics.tier !== metrics.suggestedTier;

  const submit = () => {
    startTransition(async () => {
      await setStakeholderEngagementTier({
        stakeholderId,
        companyId,
        tier: tier === "auto" ? null : tier,
        note: note.trim() || undefined
      });
      setOpen(false);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full text-left rounded-lg border border-ink-100 bg-neutral-50/50 hover:bg-neutral-50 px-2 py-1.5 transition focus-ring"
        aria-label={`${stakeholderName} のエンゲージメントを編集`}
      >
        <div className="flex items-center justify-between gap-2">
          <EngagementBadge tier={metrics.tier} />
          {overridden && (
            <span className="text-[10px] text-ink-500">手動 (自動: {engagementTierLabel[metrics.suggestedTier]})</span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-ink-600">
          <span>直近接点 {fmtDate(metrics.lastTouchAt)}</span>
          <span>·</span>
          <span>30日 {metrics.touchCount30d}件</span>
          <span>·</span>
          <span>90日 {metrics.touchCount90d}件</span>
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold text-ink-900">{stakeholderName} のエンゲージメント tier</div>
            <div className="mt-1 text-[11px] text-ink-500">
              自動算出: <EngagementBadge tier={metrics.suggestedTier} /> (30日 {metrics.touchCount30d}件 / 90日 {metrics.touchCount90d}件)
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-xs font-medium text-ink-700">tier (手動上書き)</label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as EngagementTier | "auto")}
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
                disabled={pending}
              >
                <option value="auto">自動 (suggestedTier に追従)</option>
                {engagementTierOrder.map((t) => (
                  <option key={t} value={t}>
                    {engagementTierLabel[t]} ({t})
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 space-y-2">
              <label className="text-xs font-medium text-ink-700">理由メモ (任意)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
                placeholder="例: 出張で接点取れなかったが意欲は高い"
                disabled={pending}
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-ink-200 text-sm text-ink-700 hover:bg-ink-50"
                disabled={pending}
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="px-3 py-1.5 rounded-lg bg-ink-900 text-white text-sm hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
