"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { TopNav } from "@/components/nav/TopNav";
import type { UserNotification, NotificationCategory } from "@/lib/repository/server";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction
} from "./actions";

type Filter = "all" | "unread" | NotificationCategory;

const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "unread", label: "未読のみ" },
  { key: "alert", label: "アラート" },
  { key: "review", label: "週次" },
  { key: "renewal", label: "更新" },
  { key: "onboarding", label: "オンボ" },
  { key: "mail", label: "メール" }
];

const categoryStyle: Record<NotificationCategory, { label: string; color: string; bg: string }> = {
  alert: { label: "アラート", color: "#EF4444", bg: "#EF444414" },
  review: { label: "週次", color: "#3D9EFF", bg: "#3D9EFF14" },
  renewal: { label: "更新", color: "#8B5CF6", bg: "#8B5CF614" },
  onboarding: { label: "オンボ", color: "#F59E0B", bg: "#F59E0B14" },
  mail: { label: "メール", color: "#10B981", bg: "#10B98114" }
};

export type NotificationsClientProps = {
  notifications: UserNotification[];
  unreadCount: number;
};

export default function NotificationsClient({
  notifications,
  unreadCount
}: NotificationsClientProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, startTransition] = useTransition();

  const visible = notifications.filter((n) => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.readAt;
    return n.category === filter;
  });

  const handleMarkOne = (id: string) => {
    startTransition(() => {
      void markNotificationReadAction(id);
    });
  };

  const handleMarkAll = () => {
    startTransition(() => {
      void markAllNotificationsReadAction();
    });
  };

  return (
    <>
      <TopNav current="/" />
      <main className="mx-auto max-w-[1720px] px-6 py-8 space-y-6">
        <section className="flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-ink-500 font-medium">
              <Link href="/" className="hover:text-ink-700">
                ホーム
              </Link>
              <span>/</span>
              <span>通知</span>
            </div>
            <h1 className="mt-1 text-xl font-bold tracking-tight">
              <span className="brand-text-gradient">通知</span>
            </h1>
            <div className="mt-1 text-sm text-ink-500">
              全 {notifications.length} 件 / 未読 {unreadCount} 件
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAll}
              disabled={pending || unreadCount === 0}
              className="px-4 py-2 rounded-full border border-ink-100 text-sm text-ink-700 hover:bg-ink-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              すべて既読にする
            </button>
            <Link
              href="/settings/notifications"
              className="px-4 py-2 rounded-full bg-ink-900 text-white text-sm hover:bg-ink-700 shadow-liquid"
            >
              通知設定
            </Link>
          </div>
        </section>

        <section className="liquid-surface p-3">
          <div className="flex flex-wrap items-center gap-1">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={[
                  "px-3 py-1.5 rounded-full text-xs transition",
                  filter === f.key
                    ? "bg-ink-900 text-white"
                    : "text-ink-700 hover:bg-ink-50"
                ].join(" ")}
              >
                {f.label}
              </button>
            ))}
          </div>
        </section>

        {visible.length === 0 ? (
          <section className="liquid-surface p-12 text-center">
            <div className="text-4xl mb-3">🔔</div>
            <p className="text-sm font-medium text-ink-700">
              {filter === "all"
                ? "通知はまだありません"
                : "該当する通知はありません"}
            </p>
          </section>
        ) : (
          <section className="liquid-surface overflow-hidden">
            <ul className="divide-y divide-ink-50">
              {visible.map((n) => {
                const style = categoryStyle[n.category];
                const unread = !n.readAt;
                const body = (
                  <div className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50/40">
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ color: style.color, background: style.bg }}
                    >
                      {style.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div
                        className={[
                          "text-sm truncate",
                          unread ? "text-ink-900 font-semibold" : "text-ink-700"
                        ].join(" ")}
                      >
                        {n.title}
                      </div>
                      {n.body && (
                        <div className="text-xs text-ink-500 truncate mt-0.5">
                          {n.body}
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] text-ink-400 whitespace-nowrap">
                      {formatRelative(n.createdAt)}
                    </span>
                    {unread && (
                      <span
                        className="w-2 h-2 rounded-full bg-rose-500"
                        title="未読"
                      />
                    )}
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.linkHref ? (
                      <Link
                        href={n.linkHref}
                        onClick={() => unread && handleMarkOne(n.id)}
                      >
                        {body}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => unread && handleMarkOne(n.id)}
                        className="w-full text-left"
                      >
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <footer className="pt-8 pb-4 text-center text-[11px] text-ink-500">
          NEO CS v2 — 通知
        </footer>
      </main>
    </>
  );
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.floor((now - t) / 60000);
  if (diffMin < 1) return "今";
  if (diffMin < 60) return `${diffMin}分前`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}時間前`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}日前`;
  return iso.slice(0, 10);
}
