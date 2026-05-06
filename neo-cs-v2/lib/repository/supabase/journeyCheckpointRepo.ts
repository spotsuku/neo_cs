// ジャーニーチェックポイント完了状態 Supabase リポジトリ
// マイグレーション: supabase/migrations/0029_journey_v2.sql

import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import type { JourneyCheckpointRepo } from "../types";
import type {
  JourneyCheckpointStatus,
  JourneyType
} from "@/lib/mock/journeys";

type Row = {
  id: string;
  organization_id: string;
  journey_type: string;
  subject_id: string;
  stage_key: string;
  checkpoint_key: string;
  done: boolean;
  completed_at: string | null;
  completed_by: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

function toStatus(r: Row): JourneyCheckpointStatus {
  return {
    organizationId: r.organization_id,
    journeyType: r.journey_type as JourneyType,
    subjectId: r.subject_id,
    stageKey: r.stage_key,
    checkpointKey: r.checkpoint_key,
    done: r.done,
    completedAt: r.completed_at ?? undefined,
    completedBy: r.completed_by ?? undefined,
    note: r.note ?? undefined
  };
}

export const supabaseJourneyCheckpointRepo: JourneyCheckpointRepo = {
  async list({ organizationId, journeyType, subjectId }) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("journey_checkpoint_status")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("journey_type", journeyType)
      .eq("subject_id", subjectId);
    if (error) throw new Error(`journey_checkpoint_status.list: ${error.message}`);
    return (data ?? []).map((r) => toStatus(r as Row));
  },

  async setStatus(input) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const completedAt = input.done ? new Date().toISOString() : null;
    const completedBy = input.done ? input.completedBy ?? null : null;

    const { data: before } = await sb
      .from("journey_checkpoint_status")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("journey_type", input.journeyType)
      .eq("subject_id", input.subjectId)
      .eq("stage_key", input.stageKey)
      .eq("checkpoint_key", input.checkpointKey)
      .maybeSingle();

    const { data, error } = await sb
      .from("journey_checkpoint_status")
      .upsert(
        {
          organization_id: input.organizationId,
          journey_type: input.journeyType,
          subject_id: input.subjectId,
          stage_key: input.stageKey,
          checkpoint_key: input.checkpointKey,
          done: input.done,
          completed_at: completedAt,
          completed_by: completedBy,
          note: input.note ?? null
        },
        {
          onConflict:
            "organization_id,journey_type,subject_id,stage_key,checkpoint_key"
        }
      )
      .select()
      .single();
    if (error) throw new Error(`journey_checkpoint_status.upsert: ${error.message}`);
    const next = toStatus(data as Row);
    await runAfterWrite({
      entityType: "journey_checkpoint_status",
      entityId: (data as Row).id,
      before,
      after: next,
      action: before ? "update" : "create",
      ctx
    });
    return next;
  }
};
