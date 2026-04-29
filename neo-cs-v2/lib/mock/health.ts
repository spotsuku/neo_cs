// 企業のヘルスカラーを契約のhealthScoreから集約算出するヘルパー
import { activeContracts } from "./onboarding";

export function companyHealthColor(companyId: string): "green" | "yellow" | "red" {
  const contracts = activeContracts.filter((c) => c.companyId === companyId);
  const colors = contracts
    .map((c) => c.healthScore?.color)
    .filter(Boolean) as ("green" | "yellow" | "red")[];
  if (colors.includes("red")) return "red";
  if (colors.includes("yellow")) return "yellow";
  return "green";
}
