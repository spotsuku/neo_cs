// 企業の総合的な「天気」状態（5段階）
//
// 既存の healthColor (green/yellow/red) と churn 兆候・lifecycleState から
// 派生させる純関数。表示は ☀ ⛅ ☁ 🌧 ⛈ 等のアイコンで一目把握。
//
//   快晴 (sunny)   : 全契約 green、解約懸念なし
//   晴れ (fair)    : ほぼ green、軽微な注意あり
//   曇り (cloudy)  : yellow が混在 / 改善余地あり
//   雨 (rainy)     : red 契約あり / lifecycleState=at_risk
//   大雨 (storm)   : churned 直前 / 複数の red + at_risk

export type CompanyWeather = "sunny" | "fair" | "cloudy" | "rainy" | "storm";

export const WEATHER_LABEL: Record<CompanyWeather, string> = {
  sunny: "快晴",
  fair: "晴れ",
  cloudy: "曇り",
  rainy: "雨",
  storm: "大雨"
};

export const WEATHER_ICON: Record<CompanyWeather, string> = {
  sunny: "☀",
  fair: "⛅",
  cloudy: "☁",
  rainy: "🌧",
  storm: "⛈"
};

export const WEATHER_TONE: Record<CompanyWeather, string> = {
  sunny: "text-amber-500",
  fair: "text-amber-400",
  cloudy: "text-ink-400",
  rainy: "text-sky-600",
  storm: "text-rose-600"
};

export type WeatherInput = {
  /** 各契約の Health 色 */
  healthColors: Array<"green" | "yellow" | "red" | undefined>;
  /** 各契約の lifecycleState */
  lifecycleStates: Array<"active" | "at_risk" | "churned" | "re_approach" | undefined>;
};

export function deriveCompanyWeather(input: WeatherInput): CompanyWeather {
  const greens = input.healthColors.filter((c) => c === "green").length;
  const yellows = input.healthColors.filter((c) => c === "yellow").length;
  const reds = input.healthColors.filter((c) => c === "red").length;
  const total = input.healthColors.length;

  const atRisks = input.lifecycleStates.filter((s) => s === "at_risk").length;
  const churnedAny = input.lifecycleStates.some((s) => s === "churned");

  // 大雨: 解約決定 or 複数の at_risk + red
  if (churnedAny) return "storm";
  if (atRisks >= 1 && reds >= 1) return "storm";
  if (reds >= 2) return "storm";

  // 雨: red あり or at_risk あり
  if (reds >= 1 || atRisks >= 1) return "rainy";

  // 曇り: yellow 半数以上
  if (total > 0 && yellows >= Math.ceil(total / 2)) return "cloudy";
  if (yellows >= 1) return "fair";

  // 全部 green or データなし
  if (total === 0) return "cloudy"; // 契約なし = 曇り
  if (greens === total) return "sunny";
  return "fair";
}
