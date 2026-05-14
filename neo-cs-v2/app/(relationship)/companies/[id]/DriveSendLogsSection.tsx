"use client";

// F4: Drive テンプレ送付履歴 表示セクション (タブ「送付資料」のコンテンツ)
//
// page.tsx (Server) で driveSendLogRepo.listByCompany() を取得し、
// このコンポーネントに props で渡す。手動追加モーダルの開閉のみ
// クライアント状態を持つ。

import { useState } from "react";
import type { DriveSendLog, DriveSendChannel } from "@/lib/repository/types";
import { AddDriveSendLogModal } from "./AddDriveSendLogModal";

const CHANNEL_LABEL: Record<DriveSendChannel, string> = {
  gmail: "Gmail 添付",
  drive_share: "Drive 共有",
  other: "その他"
};

function formatDate(iso: string): string {
  // sentAt は ISO (ex: 2026-05-14T10:30:00Z) を想定。表示は YYYY-MM-DD
  return iso.slice(0, 10);
}

export function DriveSendLogsSection({
  companyId,
  logs
}: {
  companyId: string;
  logs: DriveSendLog[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink-900">送付資料</h2>
          <p className="text-xs text-ink-500 mt-0.5">
            この企業に送付した Drive テンプレ資料の履歴（手動記録 + 自動収集）
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-3 py-1.5 rounded-full text-xs bg-ink-900 text-white hover:bg-ink-800"
        >
          ＋ 資料送付を記録
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="text-sm text-ink-400 py-8 text-center border border-dashed border-ink-200 rounded-lg">
          — 送付履歴はありません —
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-ink-100">
          <table className="min-w-full text-sm">
            <thead className="bg-ink-50 text-ink-600">
              <tr>
                <th className="text-left font-medium px-3 py-2 whitespace-nowrap">送付日</th>
                <th className="text-left font-medium px-3 py-2">資料名</th>
                <th className="text-left font-medium px-3 py-2 whitespace-nowrap">送信先メール</th>
                <th className="text-left font-medium px-3 py-2 whitespace-nowrap">送信者</th>
                <th className="text-left font-medium px-3 py-2 whitespace-nowrap">チャネル</th>
                <th className="text-left font-medium px-3 py-2">メモ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-ink-50/40">
                  <td className="px-3 py-2 text-ink-700 whitespace-nowrap">
                    {formatDate(log.sentAt)}
                  </td>
                  <td className="px-3 py-2 text-ink-900">
                    <span className="font-medium">{log.driveFileName}</span>
                    {log.driveFileVersionLabel && (
                      <span className="ml-1.5 text-[10px] text-ink-500">
                        ({log.driveFileVersionLabel})
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-ink-700 whitespace-nowrap">
                    {log.sentToEmail}
                  </td>
                  <td className="px-3 py-2 text-ink-700 whitespace-nowrap">
                    {log.sentByUserId}
                  </td>
                  <td className="px-3 py-2 text-ink-700 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-ink-100 text-ink-700">
                      {CHANNEL_LABEL[log.sentVia]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-ink-500 text-xs">
                    {log.note ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddDriveSendLogModal
        open={open}
        onClose={() => setOpen(false)}
        companyId={companyId}
      />
    </section>
  );
}
