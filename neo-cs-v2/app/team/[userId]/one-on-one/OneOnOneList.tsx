"use client";

import { useState } from "react";
import type { AppUser, OneOnOneLog } from "@/lib/repository";

export function OneOnOneList({
  logs,
  users
}: {
  logs: OneOnOneLog[];
  users: AppUser[];
}) {
  const userById = new Map(users.map((u) => [u.id, u]));
  const [openId, setOpenId] = useState<string | null>(logs[0]?.id ?? null);

  if (logs.length === 0) {
    return (
      <div className="surface p-6 text-center text-body text-neutral-500">
        まだ1on1の記録がありません。最初の記録を上のフォームから登録してください。
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {logs.map((log) => {
        const manager = userById.get(log.managerUserId);
        const open = openId === log.id;
        return (
          <li key={log.id} className="surface overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : log.id)}
              aria-expanded={open}
              className="w-full text-left px-5 py-3 flex items-baseline justify-between gap-3 hover:bg-neutral-50 focus-ring"
            >
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-h4 font-semibold text-neutral-900">
                  {log.occurredAt.slice(0, 10)}
                </span>
                {log.topic && (
                  <span className="text-body text-neutral-700">{log.topic}</span>
                )}
                {log.isPrivate && (
                  <span className="inline-flex px-2 py-0.5 rounded-pill bg-neutral-100 text-caption text-neutral-700 border border-neutral-300">
                    🔒 非公開
                  </span>
                )}
              </div>
              <div className="text-caption text-neutral-500 shrink-0">
                {manager ? manager.name : "—"}
                {log.durationMin ? ` · ${log.durationMin}分` : ""}
                <span className="ml-2 text-neutral-300">{open ? "▲" : "▼"}</span>
              </div>
            </button>
            {open && (
              <div className="px-5 pb-5 pt-1 space-y-3 border-t border-neutral-100">
                {log.summary && (
                  <Section title="サマリー" tone="neutral" body={log.summary} />
                )}
                {log.good && <Section title="Good" tone="success" body={log.good} />}
                {log.more && <Section title="More" tone="warning" body={log.more} />}
                {log.nextAction && (
                  <Section title="Next Action" tone="info" body={log.nextAction} />
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Section({
  title,
  tone,
  body
}: {
  title: string;
  tone: "neutral" | "success" | "warning" | "info";
  body: string;
}) {
  const cls =
    tone === "success"
      ? "bg-success-50 border-success-100 text-neutral-900"
      : tone === "warning"
      ? "bg-warning-50 border-warning-100 text-neutral-900"
      : tone === "info"
      ? "bg-info-50 border-info-100 text-neutral-900"
      : "bg-neutral-50 border-neutral-100 text-neutral-900";
  const titleCls =
    tone === "success"
      ? "text-success-700"
      : tone === "warning"
      ? "text-warning-700"
      : tone === "info"
      ? "text-info-700"
      : "text-neutral-700";

  return (
    <div className={`rounded-md border px-3 py-2 ${cls}`}>
      <div className={`text-caption font-medium ${titleCls}`}>{title}</div>
      <div className="text-body whitespace-pre-wrap">{body}</div>
    </div>
  );
}
