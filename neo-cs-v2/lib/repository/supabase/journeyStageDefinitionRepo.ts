// 企業/事業ジャーニーのステージ定義 Supabase リポジトリ
// マイグレーション: supabase/migrations/0028_journey_v2.sql
// 純関数群: lib/mock/journeys.ts (DEFAULT_COMPANY_STAGES / DEFAULT_BUSINESS_STAGES)

import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import { DEFAULT_ORG_ID } from "../types";
import type {
  JourneyStageDefinitionRepo,
  JourneyStageDefinition,
  JourneyStageUpsertInput
} from "../types";
import {
  DEFAULT_COMPANY_STAGES,
  DEFAULT_BUSINESS_STAGES,
  type JourneyType,
  type JourneyCheckpoint
} from "@/lib/mock/journeys";

type Row = {
  id: string;
  organization_id: string;
  journey_type: string;
  stage_key: string;
  display_order: number;
  name: string;
  description: string;
  color: string | null;
  key_actions: string | null;
  checkpoints: JourneyCheckpoint[] | null;
  created_at: string;
  updated_at: string;
};

function toDef(r: Row): JourneyStageDefinition {
  return {
    id: r.id,
    organizationId: r.organization_id,
    journeyType: r.journey_type as JourneyType,
    stageKey: r.stage_key,
    displayOrder: r.display_order,
    name: r.name,
    description: r.description,
    color: r.color ?? undefined,
    keyActions: r.key_actions ?? undefined,
    checkpoints: r.checkpoints ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

export const supabaseJourneyStageDefinitionRepo: JourneyStageDefinitionRepo = {
  async list({ organizationId = DEFAULT_ORG_ID, journeyType }) {
    const sb = getServiceClient();
    // 当該 (org, type) にデータがない場合は既定ステージを auto-seed する。
    // 組織新規作成時に明示的に resetToDefaults を呼ばずに済むように。
    const { count, error: cErr } = await sb
      .from("journey_stage_definitions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("journey_type", journeyType);
    if (cErr) throw new Error(`journey_stage_definitions.count: ${cErr.message}`);
    if (!count) {
      await seedDefaults(organizationId, journeyType);
    }

    const { data, error } = await sb
      .from("journey_stage_definitions")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("journey_type", journeyType)
      .order("display_order", { ascending: true });
    if (error) throw new Error(`journey_stage_definitions.list: ${error.message}`);
    return (data ?? []).map((r) => toDef(r as Row));
  },

  async upsert(input: JourneyStageUpsertInput) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const organizationId = input.organizationId ?? DEFAULT_ORG_ID;
    const lookupKey = input.previousStageKey ?? input.stageKey;

    const { data: before } = await sb
      .from("journey_stage_definitions")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("journey_type", input.journeyType)
      .eq("stage_key", lookupKey)
      .maybeSingle();

    if (before) {
      const { data, error } = await sb
        .from("journey_stage_definitions")
        .update({
          stage_key: input.stageKey,
          display_order: input.displayOrder,
          name: input.name,
          description: input.description,
          color: input.color ?? null,
          key_actions: input.keyActions ?? null
        })
        .eq("id", (before as Row).id)
        .select()
        .single();
      if (error) throw new Error(`journey_stage_definitions.update: ${error.message}`);
      const updated = toDef(data as Row);
      await runAfterWrite({
        entityType: "journey_stage_definitions",
        entityId: updated.id,
        before,
        after: updated,
        action: "update",
        ctx
      });
      return updated;
    }
    const { data, error } = await sb
      .from("journey_stage_definitions")
      .insert({
        organization_id: organizationId,
        journey_type: input.journeyType,
        stage_key: input.stageKey,
        display_order: input.displayOrder,
        name: input.name,
        description: input.description,
        color: input.color ?? null,
        key_actions: input.keyActions ?? null
      })
      .select()
      .single();
    if (error) throw new Error(`journey_stage_definitions.insert: ${error.message}`);
    const created = toDef(data as Row);
    await runAfterWrite({
      entityType: "journey_stage_definitions",
      entityId: created.id,
      after: created,
      action: "create",
      ctx
    });
    return created;
  },

  async delete({ organizationId = DEFAULT_ORG_ID, journeyType, stageKey }) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb
      .from("journey_stage_definitions")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("journey_type", journeyType)
      .eq("stage_key", stageKey)
      .maybeSingle();
    if (!before) return;
    const { error } = await sb
      .from("journey_stage_definitions")
      .delete()
      .eq("id", (before as Row).id);
    if (error) throw new Error(`journey_stage_definitions.delete: ${error.message}`);
    await runAfterWrite({
      entityType: "journey_stage_definitions",
      entityId: (before as Row).id,
      before,
      action: "delete",
      ctx
    });
  },

  async resetToDefaults({ organizationId = DEFAULT_ORG_ID, journeyType }) {
    const sb = getServiceClient();
    // 既存の (org, type) を全削除 (FK は無いので安全)
    const { error: dErr } = await sb
      .from("journey_stage_definitions")
      .delete()
      .eq("organization_id", organizationId)
      .eq("journey_type", journeyType);
    if (dErr) throw new Error(`journey_stage_definitions.reset.delete: ${dErr.message}`);
    await seedDefaults(organizationId, journeyType);
    const { data, error } = await sb
      .from("journey_stage_definitions")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("journey_type", journeyType)
      .order("display_order", { ascending: true });
    if (error) throw new Error(`journey_stage_definitions.reset.list: ${error.message}`);
    return (data ?? []).map((r) => toDef(r as Row));
  }
};

// ─────────────────────────────────────────────
// 既定ステージ seed: lib/mock/journeys.ts の DEFAULT_*_STAGES を使う
// (mock 由来だが「既定値の正本」として共用)
// ─────────────────────────────────────────────
async function seedDefaults(organizationId: string, journeyType: JourneyType): Promise<void> {
  const sb = getServiceClient();
  const seeds = journeyType === "company" ? DEFAULT_COMPANY_STAGES : DEFAULT_BUSINESS_STAGES;
  if (seeds.length === 0) return;
  const rows = seeds.map((s) => ({
    organization_id: organizationId,
    journey_type: journeyType,
    stage_key: s.stageKey,
    display_order: s.displayOrder,
    name: s.name,
    description: s.description,
    color: s.color ?? null,
    key_actions: s.keyActions ?? null,
    checkpoints: s.checkpoints ?? null
  }));
  const { error } = await sb.from("journey_stage_definitions").insert(rows);
  if (error) throw new Error(`journey_stage_definitions.seed: ${error.message}`);
}
