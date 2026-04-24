"use client";

import Link from "next/link";
import { BrandMark } from "./BrandMark";

const nav = [
  { href: "/", label: "ダッシュボード" },
  { href: "/companies", label: "企業" },
  { href: "/onboarding", label: "オンボ" },
  { href: "/weekly", label: "週次" },
  { href: "/pipeline", label: "パイプライン" },
  { href: "/settings", label: "設定" }
];

export function TopNav({ current = "/" }: { current?: string }) {
  return (
    <header className="sticky top-0 z-40 w-full bg-white/70 backdrop-blur-xl border-b border-ink-100">
      <div className="mx-auto max-w-[1400px] px-6 h-14 flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark size={28} />
          <div className="leading-tight">
            <div className="text-[13px] font-bold tracking-tight text-ink-900">NEO CS</div>
            <div className="text-[10px] text-ink-500 -mt-0.5">統合ダッシュボード</div>
          </div>
        </Link>
        <nav className="flex items-center gap-1">
          {nav.map((n) => {
            const active = n.href === current;
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
        <div className="ml-auto flex items-center gap-3">
          <button
            className="px-3 py-1.5 rounded-full text-xs text-ink-700 hover:bg-ink-50 border border-ink-100"
            aria-label="通知"
          >
            🔔 通知 <span className="ml-1 text-brand-pink font-semibold">7</span>
          </button>
          <div className="w-8 h-8 rounded-full bg-ink-100 flex items-center justify-center text-xs text-ink-700">
            古
          </div>
        </div>
      </div>
    </header>
  );
}
