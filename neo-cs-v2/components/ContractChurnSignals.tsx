"use client";

// 契約単位の解約予兆シグナル一覧 (CompanyDetail から呼ぶ Client Component)

import { useEffect, useState } from "react";
import { churnSignalRepo } from "@/lib/repository";
import type { ChurnSignalRecord } from "@/lib/repository";
import { RULE_LABEL } from "@/lib/domain/churn";
import type { ChurnSignalRule } from "@/lib/domain/churn";

const SEVERITY_BADGE: Record<ChurnSignalRecord["severity"], string> = {
  high: "bg-danger-50 text-danger-700 border-danger-100",
  medium: "bg-warning-50 text-warning-700 border-warning-100",
  low: "bg-info-50 text-info-700 border-info-100"
};

const SEVERITY_LABEL: Record<ChurnSignalRecord["severity"], string> = {
  high: "High",
  medium: "Medium",
  low: "Low"
};

export function ContractChurnSignals({ contractId }: { contractId: string }) {
  const [signals, setSignals] = useState<ChurnSignalRecord[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    churnSignalRepo
      .listByContract(contractId, { unresolvedOnly: true })
      .then((list) => {
        if (cancelled) return;
        setSignals(list);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [contractId]);

  if (!ready) {
    return (
      <div className="text-caption text-neutral-500">解約予兆を読み込み中...</div>
    );
  }
  if (signals.length === 0) {
    return (
      <div className="text-caption text-neutral-500">
        この契約には現在検知中の解約予兆はありません
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {signals.map((s) => (
        <li
          key={s.id}
          className="rounded-md border border-neutral-100 bg-surface px-3 py-2 space-y-1"
        >
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <span
              className={`inline-flex px-2 py-0.5 rounded-pill border text-caption font-medium ${SEVERITY_BADGE[s.severity]}`}
            >
              {SEVERITY_LABEL[s.severity]} · {RULE_LABEL[s.rule as ChurnSignalRule]}
            </span>
            <span className="text-caption text-neutral-500 whitespace-nowrap">
              検知 {s.detectedAt.slice(0, 10)}
              {s.notifiedAt && (
                <span className="ml-2 text-success-700">✓ Slack通知済</span>
              )}
            </span>
          </div>
          <p className="text-body text-neutral-900">{s.reason}</p>
        </li>
      ))}
    </ul>
  );
}
