// karuteNo (カルテNo.) を seed companies に動的にバックフィルする初期化モジュール
//
// 設計:
//   - entities.ts に直接書くと onboarding.ts (contracts) との循環参照になるため、
//     後方の独立モジュールで side-effect として companies 配列を mutate する
//   - 各企業の最初の契約 (min(startDate)) 昇順で 1, 2, 3, ... を採番
//   - 契約のない企業は末尾 (id 昇順)
//   - 既に karuteNo が設定されている場合はそれを尊重 (上書きしない)
//
// 利用側:
//   この import を、companies を読む client component から1度行うだけで反映される
//   (`import "@/lib/mock/karute-no-init"`)

import { companies } from "./entities";
import { allContracts } from "./onboarding";

const earliestContractByCompany = new Map<string, string>();
for (const c of allContracts) {
  const cur = earliestContractByCompany.get(c.companyId);
  if (!cur || c.startDate < cur) {
    earliestContractByCompany.set(c.companyId, c.startDate);
  }
}

const sorted = [...companies].sort((a, b) => {
  const ax = earliestContractByCompany.get(a.id);
  const bx = earliestContractByCompany.get(b.id);
  if (ax && bx) {
    if (ax !== bx) return ax.localeCompare(bx);
    return a.id.localeCompare(b.id);
  }
  if (ax) return -1;
  if (bx) return 1;
  return a.id.localeCompare(b.id);
});

const used = new Set<number>();
for (const c of sorted) {
  if (typeof c.karuteNo === "number") used.add(c.karuteNo);
}
let next = 1;
for (const c of sorted) {
  if (typeof c.karuteNo !== "number") {
    while (used.has(next)) next++;
    c.karuteNo = next;
    used.add(next);
    next++;
  }
}
