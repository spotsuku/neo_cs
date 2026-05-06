// /companies — Server Component ラッパ
//   weather override (server 側 mock 永続) を取得して CompaniesView (client) に渡す。
//   client 単体だと server action でのストア更新が反映されないため。

import { companyWeatherRepo } from "@/lib/repository/server";
import CompaniesView from "./CompaniesView";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const overrides = await companyWeatherRepo.getAll();
  return (
    <CompaniesView
      weatherOverrides={overrides.map((o) => ({
        companyId: o.companyId,
        weather: o.weather
      }))}
    />
  );
}
