// ジャーニーチェックポイント完了状態 (mock)
//
// in-memory でステージごとのチェック項目 done/pending を保持。
// 本番では journey_checkpoint_status テーブルに対応。

import type {
  JourneyCheckpointRepo,
  JourneyCheckpointStatus
} from "../types";
import { useGlobalStore } from "./_global-store";

const store = useGlobalStore<JourneyCheckpointStatus[]>(
  "__journeyCheckpointStore",
  () => []
);

function findIdx(input: {
  organizationId: string;
  journeyType: string;
  subjectId: string;
  stageKey: string;
  checkpointKey: string;
}): number {
  return store.findIndex(
    (s) =>
      s.organizationId === input.organizationId &&
      s.journeyType === input.journeyType &&
      s.subjectId === input.subjectId &&
      s.stageKey === input.stageKey &&
      s.checkpointKey === input.checkpointKey
  );
}

export const mockJourneyCheckpointRepo: JourneyCheckpointRepo = {
  async list(opts) {
    return store
      .filter(
        (s) =>
          s.organizationId === opts.organizationId &&
          s.journeyType === opts.journeyType &&
          s.subjectId === opts.subjectId
      )
      .map((s) => ({ ...s }));
  },

  async setStatus(input) {
    const idx = findIdx(input);
    const now = new Date().toISOString();
    const next: JourneyCheckpointStatus = {
      organizationId: input.organizationId,
      journeyType: input.journeyType,
      subjectId: input.subjectId,
      stageKey: input.stageKey,
      checkpointKey: input.checkpointKey,
      done: input.done,
      completedAt: input.done ? now : undefined,
      completedBy: input.done ? input.completedBy : undefined,
      note: input.note
    };
    if (idx >= 0) store[idx] = next;
    else store.push(next);
    return { ...next };
  }
};
