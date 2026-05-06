"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { BrandMark } from "./BrandMark";
import type { AppUserRole } from "@/lib/repository/types";
import { VIEW_MODE_STORAGE_KEY } from "@/lib/auth/permissions";
import { setViewMode as setViewModeAction } from "@/lib/auth/actions";
import { fetchMe, invalidateMe } from "@/lib/auth/me-client";

type ViewMode = "manager" | "member";

type NavItem = {
  href: string;
  label: string;
  /** どの effectiveRole に表示するか。未指定は全員 */
  visibleFor?: AppUserRole[];
  /** マネージャー専用画面（admin / manager のみ） */
  managerOnly?: boolean;
  /** external では非表示 */
  hideForExternal?: boolean;
};

// 大項目をシンプルに整理。
//   - To-do (オンボ / 事業別ToDo / 個社ToDo) はサブナビへ
//   - 顧客シグナル (VOC / アンケート / 出席・参加状況) はサブナビへ
//   - 週次は単独
const nav: NavItem[] = [
  { href: "/", label: "ダッシュボード" },
  { href: "/me", label: "マイページ" },
  { href: "/companies", label: "企業" },
  { href: "/tasks", label: "To-do", hideForExternal: true },
  { href: "/weekly", label: "週次", hideForExternal: true },
  { href: "/voc", label: "顧客シグナル", hideForExternal: true },
  { href: "/manager", label: "マネージャー", managerOnly: true }
];

// 大項目のどれが「現在のページ」と紐づくかを判定するためのプレフィクス。
const SECTION_MATCH: { prefix: string; section: string }[] = [
  { prefix: "/companies", section: "/companies" },
  // To-do グループ
  { prefix: "/tasks", section: "/tasks" },
  { prefix: "/onboarding", section: "/tasks" },
  { prefix: "/programs", section: "/tasks" },
  // 週次は単独
  { prefix: "/weekly", section: "/weekly" },
  // 顧客シグナルグループ
  { prefix: "/voc", section: "/voc" },
  { prefix: "/surveys", section: "/voc" },
  { prefix: "/attendance", section: "/voc" },
  { prefix: "/manager", section: "/manager" }
];

function resolveSection(current: string): string {
  if (current === "/" || current === "") return "/";
  for (const { prefix, section } of SECTION_MATCH) {
    if (current === prefix || current.startsWith(prefix + "/")) return section;
  }
  return current;
}

type Notification = {
  id: string;
  category: "alert" | "review" | "renewal" | "onboarding" | "mail";
  title: string;
  body: string;
  time: string;
  href: string;
  unread: boolean;
};

const notifications: Notification[] = [
  {
    id: "n1",
    category: "alert",
    title: "イオン九州がRedに変化",
    body: "契約終了60日前・更新未確定。担当: 古野",
    time: "10分前",
    href: "/companies/c-aeon",
    unread: true
  },
  {
    id: "n2",
    category: "review",
    title: "週次レビュー未提出 (3社)",
    body: "金曜17時の締切までに残り3社が未提出です",
    time: "1時間前",
    href: "/weekly",
    unread: true
  },
  {
    id: "n3",
    category: "renewal",
    title: "九州旅客鉄道 更新60日前",
    body: "アカデミア研修の更新打診タイミングです",
    time: "本日 09:30",
    href: "/companies/c-jrq",
    unread: true
  },
  {
    id: "n4",
    category: "mail",
    title: "新着メール: 西日本鉄道",
    body: "「次回定例の日程調整について」が届きました",
    time: "本日 08:14",
    href: "/companies/c-nishitetsu",
    unread: true
  },
  {
    id: "n5",
    category: "onboarding",
    title: "TOTO株式会社 オンボーディング完了",
    body: "全6ステップ完了。フォローアップ面談を設定推奨",
    time: "昨日 17:42",
    href: "/onboarding",
    unread: true
  },
  {
    id: "n6",
    category: "alert",
    title: "ふくおかフィナンシャル 緊急タグ",
    body: "VOCに『更新見送り検討中』のタグが付与されました",
    time: "昨日 15:08",
    href: "/companies/c-ffg",
    unread: true
  },
  {
    id: "n7",
    category: "review",
    title: "週次レビューAI要約が更新されました",
    body: "今週分のサマリーをご確認ください",
    time: "昨日 12:00",
    href: "/weekly",
    unread: true
  },
  {
    id: "n8",
    category: "renewal",
    title: "ヤマエGHD 更新合意",
    body: "次年度継続が確定しました（金額: 24M）",
    time: "2日前",
    href: "/companies/c-yamae",
    unread: false
  }
];

const categoryStyle: Record<Notification["category"], { label: string; color: string; bg: string }> = {
  alert: { label: "アラート", color: "#EF4444", bg: "#FEE2E2" },
  review: { label: "週次", color: "#3D9EFF", bg: "#DBEAFE" },
  renewal: { label: "更新", color: "#8B5CF6", bg: "#EDE9FE" },
  onboarding: { label: "オンボ", color: "#4CD97B", bg: "#DCFCE7" },
  mail: { label: "メール", color: "#FF9838", bg: "#FFEDD5" }
};

export type TopNavProps = {
  current?: string;
  /** サーバ側で解決された actor のロール。未指定なら admin 扱いで全件表示（後方互換） */
  role?: AppUserRole;
  /** admin が UI トグルで切り替えた表示モード。サーバから cookie 経由で渡される */
  viewModeOverride?: ViewMode;
  userName?: string;
  userEmail?: string;
};

export function TopNav({
  current = "/",
  role,
  viewModeOverride,
  userName,
  userEmail
}: TopNavProps) {
  const [open, setOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [notifs, setNotifs] = useState(notifications);
  const [viewMode, setViewMode] = useState<ViewMode | null>(viewModeOverride ?? null);
  // server から渡されない場合（client page）は /api/me から fetch
  const [resolvedRole, setResolvedRole] = useState<AppUserRole | undefined>(role);
  const [pendingMode, startModeTransition] = useTransition();
  const pathname = usePathname() ?? "/";
  const wrapRef = useRef<HTMLDivElement>(null);
  const userWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (role !== undefined) return; // server から渡された場合はスキップ
    let cancelled = false;
    fetchMe().then((data) => {
      if (cancelled || !data?.user) return;
      setResolvedRole(data.user.role as AppUserRole);
      if (data.viewModeOverride) setViewMode(data.viewModeOverride as ViewMode);
    });
    return () => {
      cancelled = true;
    };
  }, [role]);

  // localStorage にもバックアップ保存（サーバ未対応の画面遷移直後の点滅対策）
  useEffect(() => {
    if (viewMode) {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    }
  }, [viewMode]);

  const activeRole = resolvedRole ?? "admin";
  const effectiveRole: AppUserRole =
    activeRole === "admin" && viewMode ? viewMode : activeRole;

  const visibleNav = nav.filter((n) => {
    if (n.managerOnly && effectiveRole !== "admin" && effectiveRole !== "manager") return false;
    if (n.hideForExternal && effectiveRole === "external") return false;
    if (n.visibleFor && !n.visibleFor.includes(effectiveRole)) return false;
    return true;
  });

  const handleViewModeChange = (next: ViewMode) => {
    // 楽観的更新でナビを即時切替（Server Action 完了を待たない）
    setViewMode(next);
    invalidateMe();
    startModeTransition(async () => {
      try {
        await setViewModeAction(next, pathname);
      } catch {
        // Server Action 失敗時は localStorage が次回 cookie を再現するためそのまま
      }
    });
  };

  useEffect(() => {
    if (!open && !userOpen) return;
    const handler = (e: MouseEvent) => {
      if (open && wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
      if (userOpen && userWrapRef.current && !userWrapRef.current.contains(e.target as Node)) {
        setUserOpen(false);
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setUserOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", esc);
    };
  }, [open, userOpen]);

  const unreadCount = notifs.filter((n) => n.unread).length;

  return (
    <header className="sticky top-0 z-40 w-full bg-white/70 backdrop-blur-xl border-b border-ink-100">
      <div className="w-full px-6 h-14 flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark size={28} />
          <div className="leading-tight">
            <div className="text-[13px] font-bold tracking-tight text-ink-900">NEO CS</div>
            <div className="text-[10px] text-ink-500 -mt-0.5">統合ダッシュボード</div>
          </div>
        </Link>
        <nav className="flex items-center gap-1">
          {visibleNav.map((n) => {
            const activeSection = resolveSection(current);
            const active = n.href === activeSection || n.href === current;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={[
                  "px-3 py-1.5 rounded-full text-sm transition",
                  active
                    ? "bg-ink-900 text-white"
                    : "text-ink-700 hover:bg-ink-50"
                ].join(" ")}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          {effectiveRole !== "external" && (
            <>
              <Link
                href="/inbox"
                aria-label="受信箱"
                title="受信箱"
                className="w-9 h-9 rounded-full hover:bg-ink-50 flex items-center justify-center text-base"
              >
                📥
              </Link>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event("chat:toggle"))}
                aria-label="チャット"
                title="チャット"
                className="w-9 h-9 rounded-full hover:bg-ink-50 flex items-center justify-center text-base"
              >
                💬
              </button>
            </>
          )}
          <div className="relative" ref={wrapRef}>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="relative w-9 h-9 rounded-full hover:bg-ink-50 flex items-center justify-center text-base"
              aria-label="通知"
              title={`通知${unreadCount > 0 ? ` (未読${unreadCount})` : ""}`}
              aria-expanded={open}
            >
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-brand-pink text-white text-[10px] font-semibold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-[380px] rounded-2xl border border-ink-100 bg-white shadow-liquid-lg overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between border-b border-ink-100">
                  <div>
                    <div className="text-sm font-semibold text-ink-900">通知</div>
                    <div className="text-[11px] text-ink-500">未読 {unreadCount} 件</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotifs((ns) => ns.map((n) => ({ ...n, unread: false })))}
                    disabled={unreadCount === 0}
                    className="text-[11px] text-ink-500 hover:text-ink-700 disabled:text-ink-300 disabled:cursor-not-allowed"
                  >
                    すべて既読にする
                  </button>
                </div>

                <ul className="max-h-[420px] overflow-y-auto divide-y divide-ink-50">
                  {notifs.map((n) => {
                    const style = categoryStyle[n.category];
                    return (
                      <li key={n.id}>
                        <Link
                          href={n.href}
                          onClick={() => setOpen(false)}
                          className={[
                            "block px-4 py-3 hover:bg-ink-50 transition",
                            n.unread ? "bg-white" : "bg-ink-50/30"
                          ].join(" ")}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className="mt-1 inline-flex shrink-0 items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                              style={{ color: style.color, background: style.bg }}
                            >
                              {style.label}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-ink-900 truncate">
                                  {n.title}
                                </span>
                                {n.unread && (
                                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-brand-pink" />
                                )}
                              </div>
                              <div className="mt-0.5 text-xs text-ink-500 line-clamp-2">
                                {n.body}
                              </div>
                              <div className="mt-1 text-[10px] text-ink-500">{n.time}</div>
                            </div>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>

                <div className="px-4 py-2.5 border-t border-ink-100 flex items-center justify-between">
                  <Link
                    href="/settings/notifications"
                    onClick={() => setOpen(false)}
                    className="text-[11px] text-ink-500 hover:text-ink-700"
                  >
                    通知設定
                  </Link>
                  <Link
                    href="/notifications"
                    onClick={() => setOpen(false)}
                    className="text-[11px] text-ink-700 font-medium hover:underline"
                  >
                    すべての通知を見る →
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={userWrapRef}>
            <button
              type="button"
              onClick={() => setUserOpen((v) => !v)}
              className="w-8 h-8 rounded-full bg-ink-100 hover:bg-ink-200 flex items-center justify-center text-xs text-ink-700 transition"
              aria-label="ユーザーメニュー"
              aria-expanded={userOpen}
            >
              古
            </button>

            {userOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-ink-100 bg-white shadow-liquid-lg overflow-hidden">
                <div className="px-4 py-4 flex items-center gap-3 border-b border-ink-100">
                  <div className="w-12 h-12 rounded-full bg-ink-100 flex items-center justify-center text-sm font-semibold text-ink-700">
                    古
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink-900 truncate">古野 健太</div>
                    <div className="text-xs text-ink-500 truncate">k_furuno@sportsnation.jp</div>
                    <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100">
                      Admin
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3 grid grid-cols-3 gap-2 border-b border-ink-100">
                  <div className="text-center">
                    <div className="text-sm font-bold text-ink-900">12</div>
                    <div className="text-[10px] text-ink-500">担当社</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-bold text-ink-900">3</div>
                    <div className="text-[10px] text-ink-500">本日タスク</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-bold text-ink-900">2</div>
                    <div className="text-[10px] text-ink-500">未提出週次</div>
                  </div>
                </div>

                {activeRole === "admin" && (
                  <div className="px-4 py-3 border-b border-ink-100">
                    <div className="text-[10px] text-ink-500 mb-1.5">表示モード（管理者用）</div>
                    <div
                      className="inline-flex items-center rounded-full border border-ink-100 bg-white p-0.5 text-[11px] w-full"
                      role="group"
                      aria-label="表示モード"
                    >
                      {(["manager", "member"] as const).map((m) => {
                        const isActive = (viewMode ?? "manager") === m;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => handleViewModeChange(m)}
                            disabled={pendingMode}
                            className={[
                              "flex-1 px-2.5 py-1 rounded-full transition",
                              isActive
                                ? "bg-ink-900 text-white"
                                : "text-ink-600 hover:bg-ink-50"
                            ].join(" ")}
                          >
                            {m === "manager" ? "マネージャー表示" : "メンバー表示"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <ul className="py-1">
                  <li>
                    <Link
                      href="/me"
                      onClick={() => setUserOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-ink-700 hover:bg-ink-50"
                    >
                      <span className="w-5 text-center">🏠</span>
                      <span>マイページ</span>
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/profile"
                      onClick={() => setUserOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-ink-700 hover:bg-ink-50"
                    >
                      <span className="w-5 text-center">👤</span>
                      <span>プロフィール</span>
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/settings"
                      onClick={() => setUserOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-ink-700 hover:bg-ink-50"
                    >
                      <span className="w-5 text-center">⚙️</span>
                      <span>設定</span>
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/settings/notifications"
                      onClick={() => setUserOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-ink-700 hover:bg-ink-50"
                    >
                      <span className="w-5 text-center">🔔</span>
                      <span>通知設定</span>
                    </Link>
                  </li>
                  <li>
                    <button
                      type="button"
                      disabled
                      title="準備中: ダークテーマ切替は別途実装予定"
                      className="w-full flex items-center justify-between px-4 py-2 text-sm text-ink-400 cursor-not-allowed"
                    >
                      <span className="flex items-center gap-3">
                        <span className="w-5 text-center">🌓</span>
                        <span>テーマ（準備中）</span>
                      </span>
                      <span className="text-[10px] text-ink-400">ライト</span>
                    </button>
                  </li>
                  <li>
                    <Link
                      href="/help"
                      onClick={() => setUserOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-ink-700 hover:bg-ink-50"
                    >
                      <span className="w-5 text-center">❓</span>
                      <span>ヘルプ</span>
                    </Link>
                  </li>
                </ul>

                <div className="border-t border-ink-100 py-1">
                  <form action="/api/auth/signout" method="post">
                    <button
                      type="submit"
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
                    >
                      <span className="w-5 text-center">↩</span>
                      <span>ログアウト</span>
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
