// 企業天気アイコン
//   ☀ 快晴 / ⛅ 晴れ / ☁ 曇り / 🌧 雨 / ⛈ 大雨

import {
  WEATHER_LABEL,
  WEATHER_ICON,
  WEATHER_TONE,
  type CompanyWeather
} from "@/lib/domain/weather/weather";

export function WeatherIcon({
  weather,
  size = "md"
}: {
  weather: CompanyWeather;
  size?: "sm" | "md";
}) {
  const cls = size === "sm" ? "text-sm" : "text-lg";
  return (
    <span
      title={WEATHER_LABEL[weather]}
      className={[cls, WEATHER_TONE[weather], "leading-none"].join(" ")}
    >
      {WEATHER_ICON[weather]}
    </span>
  );
}
