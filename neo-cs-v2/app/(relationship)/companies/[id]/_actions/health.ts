"use server";

// 企業詳細画面の Client Component (CompanyDetail.tsx) からヘルス系データを
// 取得するための Server Action。
//
// 経緯:
//   旧 useHealthSnapshots フックは @/lib/repository (= mock 固定ファサード) を
//   直接呼んでいたため、REPO_DRIVER=supabase に切り替えても Client 側は mock の
//   ままだった。Server Action を介して @/lib/repository/server (driver-aware)
//   を呼ぶことで、本番では実 DB の health_score_snapshots が読まれる。

import { healthSnapshotRepo } from "@/lib/repository/server";
import type { HealthSnapshot } from "@/lib/repository/types";

/**
 * 指定契約の health_score_snapshots を時系列 (asOf 昇順) で返す。
 * mock ドライバ時は in-memory の決定論的シードを返す。
 */
export async function getHealthSnapshotsByContract(
  contractId: string
): Promise<HealthSnapshot[]> {
  if (!contractId) return [];
  return healthSnapshotRepo.listByContract(contractId);
}
