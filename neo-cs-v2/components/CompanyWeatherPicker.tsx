"use client";

// 企業天気を手動で選択するインラインボタン群
//   5段階 (☀⛅☁🌧⛈) を横並び。クリックで即時切替。
//   選択中をもう一度クリック → 未設定に戻す

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  WEATHER_ICON,
  WEATHER_LABEL,
  type CompanyWeather
} from "@/lib/domain/weather";
import {
  setCompanyWeatherAction,
  clearCompanyWeatherAction
} from "@/app/companies/[id]/weather-actions";

const ALL_WEATHERS: CompanyWeather[] = [
  "sunny",
  "fair",
  "cloudy",
  "rainy",
  "storm"
];

export function CompanyWeatherPicker({
  companyId,
  weather
}: {
  companyId: string;
  /** 設定済みの天気。未設定なら undefined */
  weather?: CompanyWeather;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const apply = (w: CompanyWeather) => {
    startTransition(async () => {
      // 同じ天気を再度クリック → 未設定に戻す
      if (weather === w) {
        const r = await clearCompanyWeatherAction({ companyId });
        if (r.ok) router.refresh();
        return;
      }
      const r = await setCompanyWeatherAction({ companyId, weather: w });
      if (r.ok) router.refresh();
    });
  };

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-md border border-ink-200 bg-white p-0.5"
      role="radiogroup"
      aria-label="企業天気"
    >
      {ALL_WEATHERS.map((w) => {
        const selected = weather === w;
        return (
          <button
            key={w}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => apply(w)}
            disabled={pending}
            title={`${WEATHER_LABEL[w]}${selected ? "（選択中・再クリックで解除）" : ""}`}
            className={[
              "inline-flex items-center justify-center w-8 h-8 rounded transition",
              selected
                ? "bg-blue-50 ring-2 ring-blue-300"
                : "opacity-50 hover:opacity-100 hover:bg-ink-50",
              "disabled:opacity-30 disabled:cursor-not-allowed"
            ].join(" ")}
          >
            {/* 絵文字は自然色のまま表示。色クラスは指定しない */}
            <span className="text-base leading-none">
              {WEATHER_ICON[w]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
