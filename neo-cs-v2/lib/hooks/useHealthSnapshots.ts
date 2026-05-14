"use client";

// 契約のヘルススコア時系列スナップショットを取得するフック
//
// 使い方:
//   const { snapshots, ready } = useHealthSnapshots(contractId);
//
// 実装メモ:
//   旧実装は `@/lib/repository` (mock 固定ファサード) を直接 import していた
//   ため、REPO_DRIVER=supabase に切り替えても Client では mock のままだった。
//   現在は Server Action 経由で driver-aware な repo を呼ぶ。
//   (Server Action は Client から fetch される RPC 扱いになる)

import { useEffect, useState } from "react";
import { getHealthSnapshotsByContract } from "@/app/(relationship)/companies/[id]/_actions/health";
import type { HealthSnapshot } from "@/lib/repository/types";

export function useHealthSnapshots(contractId: string): {
  snapshots: HealthSnapshot[];
  ready: boolean;
} {
  const [snapshots, setSnapshots] = useState<HealthSnapshot[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getHealthSnapshotsByContract(contractId)
      .then((list) => {
        if (cancelled) return;
        setSnapshots(list);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        // 実 DB 障害時: 空配列にして UI を壊さない (Sparkline は空でも描画可)
        setSnapshots([]);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [contractId]);

  return { snapshots, ready };
}
