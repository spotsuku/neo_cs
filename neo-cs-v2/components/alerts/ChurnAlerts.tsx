// 解約予兆セクション (ダッシュボード上で実データ駆動)
// Server Component。churnSignalRepo + companyRepo から取得し、
// severity 高い順に表示する。

import Link from "next/link";
import { churnSignalRepo, companyRepo } from "@/lib/repository/server";
import type { ChurnSignalRecord } from "@/lib/repository/server";
import { ProductBadge } from "@/components/contract/ProductBadge";
import { RULE_LABEL } from "@/lib/domain/churn";
import type { ChurnSignalRule } from "@/lib/domain/churn";

const SEVERITY_DOT: Record<ChurnSignalRecord["severity"], string> = {
  high: "bg-danger-500",
  medium: "bg-warning-500",
  low: "bg-info-500"
};

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

const SEVERITY_RANK = { high: 3, medium: 2, low: 1 } as const;

export async function ChurnAlerts({ limit = 8 }: { limit?: number }) {
  const [signals, companies] = await Promise.all([
    churnSignalRepo.list({ unresolvedOnly: true }),
    companyRepo.list()
  ]);
  const companyById = new Map(companies.map((c) => [c.id, c]));

  // (severity desc, weight desc, detectedAt desc) でソート
  const sorted = [...signals].sort((a, b) => {
    const r = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (r !== 0) return r;
    if (b.weight !== a.weight) return b.weight - a.weight;
    return b.detectedAt.localeCompare(a.detectedAt);
  });
  const top = sorted.slice(0, limit);

  const counts = sorted.reduce(
    (acc, s) => {
      acc[s.severity]++;
      return acc;
    },
    { high: 0, medium: 0, low: 0 }
  );

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-h4 font-semibold text-neutral-900">
          解約予兆 ({sorted.length} 件)
        </h2>
        <div className="flex items-center gap-2 text-caption">
          <Counter label="High" value={counts.high} tone="danger" />
          <Counter label="Medium" value={counts.medium} tone="warning" />
          <Counter label="Low" value={counts.low} tone="info" />
          <Link
            href="/companies"
            className="text-neutral-500 hover:text-neutral-700 focus-ring rounded-sm"
          >
            企業一覧 →
          </Link>
        </div>
      </div>

      <div className="surface overflow-hidden">
        {top.length === 0 ? (
          <div className="p-6 text-center text-body text-neutral-500">
            検知中の解約予兆はありません
          </div>
        ) : (
          <table className="w-full text-body">
            <thead>
              <tr className="text-left text-caption text-neutral-500 border-b border-neutral-100">
                <th className="px-5 py-3 font-normal w-4"></th>
                <th className="px-3 py-3 font-normal">企業</th>
                <th className="px-3 py-3 font-normal">研修</th>
                <th className="px-3 py-3 font-normal">ルール</th>
                <th className="px-3 py-3 font-normal">理由</th>
                <th className="px-3 py-3 font-normal whitespace-nowrap">検知日</th>
                <th className="px-3 py-3 font-normal whitespace-nowrap">通知</th>
                <th className="px-5 py-3 font-normal w-24"></th>
              </tr>
            </thead>
            <tbody>
              {top.map((s) => {
                const co = companyById.get(s.companyId);
                return (
                  <tr
                    key={s.id}
                    className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/60"
                  >
                    <td className="px-5 py-3">
                      <span
                        aria-hidden
                        className={`inline-block w-2 h-2 rounded-full ${SEVERITY_DOT[s.severity]}`}
                      />
                      <span className="sr-only">
                        重要度 {SEVERITY_LABEL[s.severity]}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-medium text-neutral-900">
                      {co?.name ?? s.companyId}
                    </td>
                    <td className="px-3 py-3">
                      <ProductBadge code={s.product} size="sm" />
                    </td>
                    <td className="px-3 py-3 text-neutral-700 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-pill border text-caption ${SEVERITY_BADGE[s.severity]}`}
                      >
                        {RULE_LABEL[s.rule as ChurnSignalRule]}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-body text-neutral-700 max-w-md">
                      {s.reason}
                    </td>
                    <td className="px-3 py-3 text-caption text-neutral-500 whitespace-nowrap">
                      {s.detectedAt.slice(0, 10)}
                    </td>
                    <td className="px-3 py-3 text-caption whitespace-nowrap">
                      {s.notifiedAt ? (
                        <span className="text-success-700">✓ 済</span>
                      ) : s.severity === "high" ? (
                        <span className="text-warning-700">未送信</span>
                      ) : (
                        <span className="text-neutral-400">対象外</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/companies/${s.companyId}`}
                        className="text-caption text-neutral-700 hover:underline whitespace-nowrap focus-ring rounded-sm"
                      >
                        対応する →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function Counter({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "danger" | "warning" | "info";
}) {
  const cls =
    tone === "danger"
      ? "bg-danger-50 text-danger-700 border-danger-100"
      : tone === "warning"
      ? "bg-warning-50 text-warning-700 border-warning-100"
      : "bg-info-50 text-info-700 border-info-100";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-pill border ${cls}`}
    >
      {label}
      <span className="font-semibold tabular-nums">{value}</span>
    </span>
  );
}
