// ブランドマーク: ロゴの"N"をSVGで簡略化したもの（ロゴ画像差し替え前提のプレースホルダー）
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <div
      className="relative flex items-center justify-center rounded-xl overflow-hidden"
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-0 bg-brand-gradient" />
      <svg
        viewBox="0 0 40 40"
        className="relative"
        width={size * 0.7}
        height={size * 0.7}
        fill="none"
      >
        <path
          d="M8 32 V8 L32 32 V8"
          stroke="white"
          strokeWidth="5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
