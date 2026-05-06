"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SectionSubNavItem = {
  href: string;
  label: string;
  /** 完全一致が必要な場合 true。未指定は前方一致 */
  exact?: boolean;
};

export function SectionSubNav({ items }: { items: SectionSubNavItem[] }) {
  const pathname = usePathname() ?? "/";

  const isActive = (item: SectionSubNavItem) => {
    if (item.exact) return pathname === item.href;
    if (pathname === item.href) return true;
    return pathname.startsWith(item.href + "/");
  };

  return (
    <div className="sticky top-14 z-30 border-b border-ink-100 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto max-w-[1720px] px-6">
        <nav className="flex items-center gap-1 -mb-px overflow-x-auto" aria-label="サブナビゲーション">
          {items.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "px-4 py-3 text-sm whitespace-nowrap border-b-2 transition",
                  active
                    ? "border-ink-900 text-ink-900 font-medium"
                    : "border-transparent text-ink-500 hover:text-ink-700"
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

// To-do 配下: オンボ / 事業別 ToDo / 個社 ToDo
export const TODO_SUBNAV: SectionSubNavItem[] = [
  { href: "/onboarding", label: "オンボ" },
  { href: "/programs", label: "事業別ToDo", exact: true },
  { href: "/tasks", label: "個社ToDo" }
];

// 顧客シグナル配下: VOC / アンケート / 出席・参加状況
export const SIGNAL_SUBNAV: SectionSubNavItem[] = [
  { href: "/voc", label: "VOC" },
  { href: "/surveys", label: "アンケート" },
  { href: "/attendance", label: "出席・参加状況" }
];

// 旧名残（/programs/products から参照されている可能性に備えた後方互換）
export const BUSINESS_SUBNAV = TODO_SUBNAV;
