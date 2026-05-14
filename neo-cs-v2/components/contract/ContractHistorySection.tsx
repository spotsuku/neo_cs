// 過去契約履歴セクション
//
// contract_lifecycle_snapshots に凍結された解約・更新成功・期満了の
// 履歴を時系列で表示。読み取り専用。

import type { ContractLifecycleSnapshot } from "@/lib/repository/types";
import type { Company } from "@/lib/mock/entities";
import type { ActiveContract } from "@/lib/mock/onboarding";
import { ProductBadge } from "./ProductBadge";

const ENDED_AS_LABEL: Record<ContractLifecycleSnapshot["endedAs"], string> = {
  renewed: "更新成功",
  churned: "解約",
  expired: "期満了"
};

const ENDED_AS_TONE: Record<ContractLifecycleSnapshot["endedAs"], string> = {
  renewed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  churned: "bg-rose-50 text-rose-700 border-rose-200",
  expired: "bg-ink-50 text-ink-600 border-ink-200"
};

export function ContractHistorySection({
  snapshots,
  contracts
}: {
  snapshots: ContractLifecycleSnapshot[];
  contracts: ActiveContract[];
}) {
  if (snapshots.length === 0) {
    return (
      <div className="text-[11px] text-ink-500">
        過去の契約履歴はありません
      </div>
    );
  }

  const contractById = new Map(contracts.map((c) => [c.id, c]));

  return (
    <div className="space-y-2">
      {snapshots.map((snap) => {
        const c = contractById.get(snap.contractId);
        return (
          <div
            key={snap.contractId}
            className="rounded-lg border border-ink-100 bg-white p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                {c && <ProductBadge code={c.product} size="sm" />}
                <span className="text-sm font-semibold text-ink-900">
                  {c
                    ? `第${c.cycleNumber}期 (${c.startDate} 〜 ${c.endDate ?? "—"})`
                    : snap.contractId}
                </span>
              </div>
              <span
                className={[
                  "text-[11px] px-2 py-0.5 rounded-full border font-medium",
                  ENDED_AS_TONE[snap.endedAs]
                ].join(" ")}
              >
                {ENDED_AS_LABEL[snap.endedAs]} ({snap.endedAt.slice(0, 10)})
              </span>
            </div>

            {/* メトリクス */}
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
              {snap.metrics.finalMrr !== undefined && (
                <Metric
                  label="最終 MRR"
                  value={`¥${snap.metrics.finalMrr.toLocaleString()}`}
                />
              )}
              {snap.metrics.attendanceRate !== undefined && (
                <Metric
                  label="出席率"
                  value={`${Math.round(snap.metrics.attendanceRate * 100)}%`}
                />
              )}
              {snap.metrics.healthColor && (
                <Metric
                  label="最終Health"
                  value={snap.metrics.healthColor.toUpperCase()}
                  color={
                    snap.metrics.healthColor === "green"
                      ? "#10B981"
                      : snap.metrics.healthColor === "yellow"
                      ? "#F59E0B"
                      : "#EF4444"
                  }
                />
              )}
              {snap.metrics.checkpointDoneRatio !== undefined && (
                <Metric
                  label="チェック達成率"
                  value={`${Math.round(snap.metrics.checkpointDoneRatio * 100)}%`}
                />
              )}
            </dl>

            {snap.churnReason && (
              <div className="rounded bg-rose-50/60 border border-rose-100 px-2 py-1.5 text-[11px] text-rose-800">
                <span className="font-semibold">解約理由: </span>
                {snap.churnReason}
              </div>
            )}

            {snap.succeededByContractId && (
              <div className="text-[11px] text-ink-500">
                後継契約:{" "}
                <span className="font-mono">{snap.succeededByContractId}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Metric({
  label,
  value,
  color
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <dt className="text-[10px] text-ink-500">{label}</dt>
      <dd
        className="text-xs font-semibold tabular-nums"
        style={color ? { color } : { color: "#0F172A" }}
      >
        {value}
      </dd>
    </div>
  );
}
