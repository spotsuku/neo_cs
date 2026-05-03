"use client";

// 月次トレンドの CSV エクスポート (クライアント生成 + Blob ダウンロード)
// 監査用エビデンスを CS が即座に出せるようにする

import type { ReportRow } from "./page";

function escapeCsv(v: string | number): string {
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(rows: ReportRow[]): string {
  const header = ["month", "mrr_jpy", "mrr_change_jpy", "churn_rate_30d", "nrr_rate_30d"];
  const body = rows.map((r) =>
    [
      r.month,
      r.mrr,
      r.mrrChange,
      r.churnRate.toFixed(4),
      r.nrrRate.toFixed(4)
    ]
      .map(escapeCsv)
      .join(",")
  );
  return [header.join(","), ...body].join("\n") + "\n";
}

function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ReportExportButtons({ rows }: { rows: ReportRow[] }) {
  const today = new Date().toISOString().slice(0, 10);

  const exportCsv = () => {
    download(
      `neo-cs-monthly-report-${today}.csv`,
      "﻿" + rowsToCsv(rows), // BOM で Excel が UTF-8 を正しく開く
      "text/csv;charset=utf-8"
    );
  };

  const exportJson = () => {
    download(
      `neo-cs-monthly-report-${today}.json`,
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          rows
        },
        null,
        2
      ),
      "application/json"
    );
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={exportCsv}
        className="px-4 py-2 rounded-pill bg-neutral-900 text-surface text-body hover:bg-neutral-700 focus-ring"
      >
        CSV エクスポート
      </button>
      <button
        type="button"
        onClick={exportJson}
        className="px-4 py-2 rounded-pill bg-surface border border-neutral-300 text-body text-neutral-700 hover:bg-neutral-50 focus-ring"
      >
        JSON
      </button>
    </div>
  );
}
