"use client";

// 契約単位のエクスパンション機会一覧 + 営業引き継ぎボタン
//
// reviews/05_事業営業責任者.md 対応:
//   - CS から営業へ「機会を引き継いだ」記録を残す (handOff)
//   - 引き継ぎ履歴 (handedOffAt / handedOffTo / handedOffNote) を表示

import { useEffect, useState } from "react";
import {
  listExpansionsForContractAction,
  listActiveUsersAction,
  handOffExpansionAction
} from "@/app/(relationship)/companies/[id]/expansion-actions";
import type { AppUser, ExpansionOpportunityRecord } from "@/lib/repository";
import {
  EXPANSION_KIND_LABEL,
  EXPANSION_RULE_LABEL
} from "@/lib/domain/expansion/expansion";

const KIND_BADGE: Record<string, string> = {
  upsell_higher_plan: "bg-info-50 text-info-700 border-info-100",
  cross_sell_other_product: "bg-brand-purple/10 text-brand-purple border-brand-purple/20",
  seat_expansion: "bg-success-50 text-success-700 border-success-100",
  renewal_uplift: "bg-warning-50 text-warning-700 border-warning-100"
};

function yen(v: number): string {
  return `¥${v.toLocaleString("ja-JP")}`;
}

export function ContractExpansionOpportunities({ contractId }: { contractId: string }) {
  const [items, setItems] = useState<ExpansionOpportunityRecord[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [ready, setReady] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<ExpansionOpportunityRecord | null>(null);
  const [pickedUserId, setPickedUserId] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const reload = () => {
    listExpansionsForContractAction(contractId).then((list) => {
      setItems(list);
      setReady(true);
    });
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listExpansionsForContractAction(contractId),
      listActiveUsersAction()
    ]).then(([list, us]) => {
      if (cancelled) return;
      setItems(list);
      setUsers(us);
      setPickedUserId(us[0]?.id ?? "");
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [contractId]);

  if (!ready) {
    return (
      <div className="text-caption text-neutral-500">機会データを読み込み中...</div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="text-caption text-neutral-500">
        この契約には現在検知中のエクスパンション機会はありません
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {items.map((op) => {
          const owner = users.find((u) => u.id === op.handedOffTo);
          return (
            <li
              key={op.id}
              className="rounded-md border border-neutral-100 bg-surface px-3 py-2 space-y-1"
            >
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <span
                  className={`inline-flex px-2 py-0.5 rounded-pill border text-caption font-medium ${KIND_BADGE[op.kind] ?? ""}`}
                >
                  {EXPANSION_KIND_LABEL[op.kind]} · {EXPANSION_RULE_LABEL[op.rule]}
                </span>
                <span className="text-caption text-neutral-500 tabular-nums">
                  score{" "}
                  <span className="font-semibold text-neutral-900">{op.score}</span>
                </span>
              </div>
              <p className="text-body text-neutral-900">{op.reason}</p>
              <p className="text-caption text-neutral-700">
                推奨アクション: {op.suggestedAction}
                {op.estimatedUpsellJpy && (
                  <span className="ml-2 text-success-700">
                    想定 +{yen(op.estimatedUpsellJpy)}
                  </span>
                )}
              </p>

              {op.handedOffAt && (
                <div className="text-caption text-info-700">
                  ✓ 営業引継済 ({op.handedOffAt.slice(0, 10)}
                  {owner ? ` / ${owner.name}` : ""})
                  {op.handedOffNote && ` — ${op.handedOffNote}`}
                </div>
              )}
              {op.closedAt && (
                <div className="text-caption text-neutral-500">
                  終了: {op.closedAt.slice(0, 10)} ({op.closedReason})
                </div>
              )}

              {!op.handedOffAt && !op.closedAt && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setConfirmTarget(op)}
                    className="px-3 py-1 rounded-pill bg-info-500 text-surface text-caption hover:bg-info-600 focus-ring"
                  >
                    🤝 営業に引き継ぎ
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {confirmTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          <button
            type="button"
            aria-label="閉じる"
            onClick={() => setConfirmTarget(null)}
            className="absolute inset-0 bg-neutral-900/40 cursor-default"
          />
          <div className="relative bg-surface rounded-xl shadow-cardHover border border-neutral-100 w-[min(480px,92vw)] p-5 space-y-3">
            <h3 className="text-h4 font-semibold text-neutral-900">
              営業に引き継ぎ
            </h3>
            <p className="text-body text-neutral-700">
              {confirmTarget.reason}
            </p>
            <label className="block">
              <span className="text-caption text-neutral-500 font-medium">引き継ぎ先</span>
              <select
                value={pickedUserId}
                onChange={(e) => setPickedUserId(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-md border border-borderc text-body bg-surface focus-ring"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-caption text-neutral-500 font-medium">メモ</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="引き継ぎの背景・期待する次アクション"
                className="mt-1 w-full px-3 py-2 rounded-md border border-borderc text-body bg-surface focus-ring min-h-[80px]"
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className="px-4 py-2 rounded-pill bg-surface border border-neutral-300 text-body text-neutral-700 hover:bg-neutral-50 focus-ring"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handOffExpansionAction(confirmTarget.id, {
                    handedOffTo: pickedUserId,
                    note: note.trim() || undefined
                  });
                  setConfirmTarget(null);
                  setNote("");
                  reload();
                }}
                className="px-4 py-2 rounded-pill bg-neutral-900 text-surface text-body hover:bg-neutral-700 focus-ring"
              >
                引き継ぐ
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
