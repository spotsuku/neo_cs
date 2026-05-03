import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { DEFAULT_ORG_ID } from "../types";
import type { Draft, DraftRepo } from "../types";

type Row = {
  id: string;
  organization_id: string;
  owner_user_id: string;
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown>;
  updated_at: string;
};

function toDraft(r: Row): Draft {
  return {
    id: r.id,
    organizationId: r.organization_id,
    ownerUserId: r.owner_user_id,
    entityType: r.entity_type,
    entityId: r.entity_id,
    payload: r.payload ?? {},
    updatedAt: r.updated_at
  };
}

export const supabaseDraftRepo: DraftRepo = {
  async get(ownerUserId, entityType, entityId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("drafts")
      .select("*")
      .eq("owner_user_id", ownerUserId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .maybeSingle();
    if (error) throw new Error(`drafts.get: ${error.message}`);
    return data ? toDraft(data as Row) : null;
  },

  async upsert(input) {
    const sb = getServiceClient();
    const row = {
      organization_id: input.organizationId ?? DEFAULT_ORG_ID,
      owner_user_id: input.ownerUserId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      payload: input.payload,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await sb
      .from("drafts")
      .upsert(row, { onConflict: "owner_user_id,entity_type,entity_id" })
      .select()
      .single();
    if (error) throw new Error(`drafts.upsert: ${error.message}`);
    return toDraft(data as Row);
  },

  async delete(ownerUserId, entityType, entityId) {
    const sb = getServiceClient();
    const { error } = await sb
      .from("drafts")
      .delete()
      .eq("owner_user_id", ownerUserId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId);
    if (error) throw new Error(`drafts.delete: ${error.message}`);
  },

  async listByOwner(ownerUserId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("drafts")
      .select("*")
      .eq("owner_user_id", ownerUserId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(`drafts.listByOwner: ${error.message}`);
    return (data ?? []).map((r: Row) => toDraft(r));
  }
};
