// user_gmail_connections (Supabase 実装)
// マイグレーション: supabase/migrations/0042_user_gmail_connections.sql

import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import type {
  GmailConnection,
  GmailConnectionRepo,
  GmailConnectionUpsertInput
} from "../types";

type Row = {
  id: string;
  organization_id: string;
  user_id: string;
  email_address: string;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
  granted_scopes: string;
  connected_at: string;
  last_sync_at: string | null;
  last_sync_status: GmailConnection["lastSyncStatus"] | null;
  last_sync_note: string | null;
};

function toConnection(r: Row): GmailConnection {
  return {
    id: r.id,
    organizationId: r.organization_id,
    userId: r.user_id,
    emailAddress: r.email_address,
    refreshToken: r.refresh_token,
    accessToken: r.access_token ?? undefined,
    accessTokenExpiresAt: r.access_token_expires_at ?? undefined,
    grantedScopes: r.granted_scopes,
    connectedAt: r.connected_at,
    lastSyncAt: r.last_sync_at ?? undefined,
    lastSyncStatus: r.last_sync_status ?? undefined,
    lastSyncNote: r.last_sync_note ?? undefined
  };
}

export const supabaseGmailConnectionRepo: GmailConnectionRepo = {
  async getByUserId(userId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("user_gmail_connections")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(`gmail_connections.getByUserId: ${error.message}`);
    if (!data) return null;
    return toConnection(data as Row);
  },

  async upsert(input: GmailConnectionUpsertInput) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("user_gmail_connections")
      .upsert(
        {
          organization_id: input.organizationId,
          user_id: input.userId,
          email_address: input.emailAddress,
          refresh_token: input.refreshToken,
          access_token: input.accessToken ?? null,
          access_token_expires_at: input.accessTokenExpiresAt ?? null,
          granted_scopes: input.grantedScopes
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();
    if (error) throw new Error(`gmail_connections.upsert: ${error.message}`);
    return toConnection(data as Row);
  },

  async updateSyncStatus(userId, patch) {
    const sb = getServiceClient();
    const row: Record<string, unknown> = {};
    if (patch.lastSyncAt !== undefined) row.last_sync_at = patch.lastSyncAt;
    if (patch.lastSyncStatus !== undefined) row.last_sync_status = patch.lastSyncStatus;
    if (patch.lastSyncNote !== undefined) row.last_sync_note = patch.lastSyncNote;
    if (patch.accessToken !== undefined) row.access_token = patch.accessToken;
    if (patch.accessTokenExpiresAt !== undefined)
      row.access_token_expires_at = patch.accessTokenExpiresAt;
    if (Object.keys(row).length === 0) return;
    const { error } = await sb
      .from("user_gmail_connections")
      .update(row)
      .eq("user_id", userId);
    if (error) throw new Error(`gmail_connections.updateSyncStatus: ${error.message}`);
  },

  async delete(userId) {
    const sb = getServiceClient();
    const { error } = await sb
      .from("user_gmail_connections")
      .delete()
      .eq("user_id", userId);
    if (error) throw new Error(`gmail_connections.delete: ${error.message}`);
  }
};
