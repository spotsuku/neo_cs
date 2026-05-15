"use client";

// 事業切替セグメントコントロール
//   /programs/products/[code] のヘッダ右上に置く商材タブ。
//   全事業を横並びで表示し、現在選択中をホワイト浮き上がりで示す。

import Link from "next/link";
import { products, type ProductCode } from "@/lib/mock/data";

export function ProductSwitcher({ currentCode }: { currentCode: ProductCode }) {
  return (
    <div
      className="inline-flex items-center gap-1 p-1 rounded-full bg-ink-100/70 border border-ink-100"
      role="tablist"
      aria-label="事業切替"
    >
      {products.map((p) => {
        const active = p.code === currentCode;
        return (
          <Link
            key={p.code}
            href={`/programs/products/${p.code}`}
            role="tab"
            aria-selected={active}
            className={[
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition",
              active
                ? "bg-white shadow-xs font-semibold text-ink-900"
                : "text-ink-500 hover:text-ink-700"
            ].join(" ")}
          >
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ background: p.accent }}
            />
            <span>{p.shortName}</span>
          </Link>
        );
      })}
    </div>
  );
}
