"use client";

// 契約のヘルススコア時系列スナップショットを取得するフック
//
// 使い方:
//   const { snapshots, ready } = useHealthSnapshots(contractId);

import { useEffect, useState } from "react";
import { healthSnapshotRepo } from "@/lib/repository";
import type { HealthSnapshot } from "@/lib/repository";

export function useHealthSnapshots(contractId: string): {
  snapshots: HealthSnapshot[];
  ready: boolean;
} {
  const [snapshots, setSnapshots] = useState<HealthSnapshot[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    healthSnapshotRepo.listByContract(contractId).then((list) => {
      if (cancelled) return;
      setSnapshots(list);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [contractId]);

  return { snapshots, ready };
}
