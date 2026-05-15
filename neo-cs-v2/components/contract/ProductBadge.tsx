import { productByCode, ProductCode } from "@/lib/master";

export function ProductBadge({ code, size = "md" }: { code: ProductCode; size?: "sm" | "md" }) {
  const p = productByCode[code];
  const cls =
    size === "sm"
      ? "text-[10px] px-1.5 py-0.5"
      : "text-xs px-2 py-0.5";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium border ${cls}`}
      style={{
        color: p.accent,
        borderColor: `${p.accent}33`,
        background: `${p.accent}0F`
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.accent }} />
      {p.shortName}
    </span>
  );
}
